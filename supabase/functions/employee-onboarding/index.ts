import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PDFDocument from "npm:pdfkit@0.16.0";
import { Buffer } from "node:buffer";
import { corsHeaders } from "../_shared/cors.ts";
import {
  EMPLOYEE_FORM_KEYS,
  EMPLOYEE_FORM_MAP,
  SMS_OPT_IN_EFFECTIVE_DATE,
  SMS_OPT_IN_FIELD_IDS,
  SMS_OPT_IN_FORM_KEY,
  SMS_OPT_IN_METADATA_KEY,
  SMS_OPT_IN_POLICY_VERSION,
  buildEmployeeFieldDefaults,
  buildEmployeeOnboardingUrl,
  extractEmployeeSmsOptInSnapshot,
  formatEmployeeFormValue,
  type EmployeeBasicInfo,
  type EmployeeFormStatus,
} from "../../../shared/employeeOnboarding.ts";

type EmployeeRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  position_title: string;
  start_date: string;
  onboarding_packet_sent_at: string | null;
  linked_subcontractor_profile_id?: string | null;
};

type EmployeeSubmissionRecord = {
  id: string;
  employee_id: string;
  form_key: string;
  form_title: string;
  status: EmployeeFormStatus;
  sent_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  form_payload: Record<string, unknown>;
  form_structure_snapshot: Record<string, unknown>;
  pdf_revision: number;
  latest_pdf_file_id: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const getSupabaseAdmin = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const hashToken = async (token: string) => {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const generateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeUsPhoneToE164 = (value: unknown) => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

const extractClientIp = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || null;
};

const buildDefaultSmsSettingsByRole = (role: string | null) => {
  const adminLike = role === "admin" || role === "is_super_admin" || role === "jg_management";
  const subcontractor = role === "subcontractor";

  return {
    sms_enabled: true,
    notify_chat_received: adminLike || subcontractor,
    notify_job_assigned: subcontractor,
    notify_charges_approved: adminLike || subcontractor,
    notify_work_order_submitted: adminLike,
    notify_job_accepted: adminLike,
  };
};

const syncSmsConsentToLinkedProfile = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  employee: EmployeeRecord,
  formKey: string,
  values: Record<string, unknown>,
) => {
  if (formKey !== SMS_OPT_IN_FORM_KEY) {
    return values;
  }

  const snapshot = extractEmployeeSmsOptInSnapshot(values);
  const phoneE164 = normalizeUsPhoneToE164(snapshot.phone);

  if (!snapshot.consented) {
    throw new Error("SMS consent acknowledgement is required.");
  }

  if (!phoneE164) {
    throw new Error("A valid U.S. mobile number is required for SMS consent.");
  }

  const consentedAt = new Date().toISOString();
  const consentIp = extractClientIp(req);
  const nextValues = {
    ...values,
    [SMS_OPT_IN_METADATA_KEY]: {
      consented_at: consentedAt,
      consent_ip: consentIp,
      phone_e164: phoneE164,
      policy_version: SMS_OPT_IN_POLICY_VERSION,
      effective_date: SMS_OPT_IN_EFFECTIVE_DATE,
    },
  };

  if (!employee.linked_subcontractor_profile_id) {
    return nextValues;
  }

  const { data: linkedProfile, error: linkedProfileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", employee.linked_subcontractor_profile_id)
    .maybeSingle();

  if (linkedProfileError) {
    throw new Error(`Unable to load linked user profile: ${linkedProfileError.message}`);
  }

  if (!linkedProfile) {
    return nextValues;
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      sms_phone: phoneE164,
      sms_consent_given: true,
      sms_consent_given_at: consentedAt,
      sms_consent_ip: consentIp,
    })
    .eq("id", linkedProfile.id);

  if (profileUpdateError) {
    throw new Error(`Unable to sync SMS consent to the linked profile: ${profileUpdateError.message}`);
  }

  const { data: existingSettings, error: existingSettingsError } = await supabase
    .from("user_sms_notification_settings")
    .select("*")
    .eq("user_id", linkedProfile.id)
    .maybeSingle();

  if (existingSettingsError) {
    throw new Error(`Unable to load SMS notification settings: ${existingSettingsError.message}`);
  }

  const defaults = buildDefaultSmsSettingsByRole((linkedProfile.role as string | null) ?? null);
  const writeSettings = existingSettings
    ? {
        user_id: linkedProfile.id,
        sms_enabled: true,
        notify_chat_received: existingSettings.notify_chat_received,
        notify_job_assigned: existingSettings.notify_job_assigned,
        notify_charges_approved: existingSettings.notify_charges_approved,
        notify_work_order_submitted: existingSettings.notify_work_order_submitted,
        notify_job_accepted: existingSettings.notify_job_accepted,
      }
    : {
        user_id: linkedProfile.id,
        ...defaults,
      };

  const { error: settingsUpsertError } = await supabase
    .from("user_sms_notification_settings")
    .upsert(writeSettings, { onConflict: "user_id" });

  if (settingsUpsertError) {
    throw new Error(`Unable to enable SMS notifications for the linked profile: ${settingsUpsertError.message}`);
  }

  return nextValues;
};

const getAdminUser = async (supabase: ReturnType<typeof getSupabaseAdmin>, req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Authentication failed.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !["admin", "is_super_admin"].includes(profile.role)) {
    throw new Error("Admin access is required.");
  }

  return user;
};

const getEmployeeRecord = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string,
) => {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .single();

  if (error || !data) {
    throw new Error("Employee record was not found.");
  }

  return data as EmployeeRecord;
};

const getEmployeeSubmission = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string,
  formKey: string,
) => {
  const { data, error } = await supabase
    .from("employee_form_submissions")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("form_key", formKey)
    .single();

  if (error || !data) {
    throw new Error("Employee form submission was not found.");
  }

  return data as EmployeeSubmissionRecord;
};

const buildOnboardingEmailHtml = (
  employee: EmployeeRecord,
  links: Array<{ title: string; url: string }>,
) => {
  const linkItems = links
    .map(
      (item) => `
        <li style="margin-bottom: 12px;">
          <a href="${item.url}" style="color: #0f766e; font-weight: 600; text-decoration: none;">${item.title}</a>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Secure employee-specific link</div>
        </li>
      `,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 32px;">
      <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #0f766e, #1d4ed8); color: white;">
          <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; opacity: 0.9;">JG Painting Pros</div>
          <h1 style="margin: 14px 0 8px; font-size: 28px; line-height: 1.1;">Welcome to the team</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; opacity: 0.95;">Your onboarding packet is ready. Each form link below is unique to you and remains active for 30 days.</p>
        </div>
        <div style="padding: 28px 32px;">
          <p style="margin-top: 0; font-size: 15px; color: #111827;">Hello ${employee.full_name},</p>
          <p style="font-size: 15px; line-height: 1.7; color: #374151;">
            Please complete the required onboarding paperwork for your role as ${employee.position_title}. Submit each item using the secure links below. Your responses will be automatically matched to your employee record inside the JG Painting Pros portal.
          </p>
          <div style="margin: 24px 0; padding: 20px; border-radius: 14px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Required forms</div>
            <ol style="margin: 0; padding-left: 18px; color: #111827;">
              ${linkItems}
            </ol>
          </div>
          <p style="font-size: 14px; line-height: 1.7; color: #4b5563;">
            If you have any trouble accessing a form, reply to this email and the admin team will resend a fresh link.
          </p>
          <p style="font-size: 14px; line-height: 1.7; color: #4b5563; margin-bottom: 0;">
            Thank you,<br />
            JG Painting Pros Admin
          </p>
        </div>
      </div>
    </div>
  `;
};

const renderSubmissionPdf = async (params: {
  employee: EmployeeRecord;
  formKey: string;
  values: Record<string, unknown>;
  submittedAt: string;
}) => {
  const formDefinition = EMPLOYEE_FORM_MAP[params.formKey];
  if (!formDefinition) {
    throw new Error("Unsupported onboarding form.");
  }

  const mergedValues = buildEmployeeFieldDefaults(params.employee as EmployeeBasicInfo, params.values);

  return await new Promise<Uint8Array>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 48,
      size: "LETTER",
      bufferPages: true,
    });

    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor("#0f172a").fontSize(22).text("JG Painting Pros", { continued: false });
    doc.fillColor("#475569").fontSize(11).text("Employee onboarding submission", { paragraphGap: 4 });
    doc.moveDown(0.3);
    doc.fillColor("#111827").fontSize(18).text(formDefinition.title);
    doc.moveDown(0.5);

    doc
      .lineWidth(1)
      .strokeColor("#cbd5e1")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();

    doc.moveDown(0.8);
    doc.fontSize(11).fillColor("#334155").text(`Employee: ${params.employee.full_name}`);
    doc.text(`Email: ${params.employee.email}`);
    doc.text(`Position: ${params.employee.position_title}`);
    doc.text(`Start Date: ${params.employee.start_date}`);
    doc.moveDown(0.8);

    for (const section of formDefinition.sections) {
      doc.fillColor("#0f172a").fontSize(13).text(section.title, { underline: false });
      if (section.description) {
        doc.fillColor("#64748b").fontSize(10).text(section.description);
      }
      doc.moveDown(0.3);

      for (const field of section.fields) {
        const value = mergedValues[field.id];
        doc.fillColor("#111827").fontSize(10).text(field.label, { continued: false });

        if (field.type === "signature" && typeof value === "string" && value.startsWith("data:image")) {
          try {
            const base64 = value.split(",")[1] || "";
            const imageBuffer = Buffer.from(base64, "base64");
            doc.moveDown(0.2);
            doc.image(imageBuffer, {
              fit: [240, 80],
              align: "left",
            });
            doc.moveDown(0.5);
          } catch {
            doc.fillColor("#475569").fontSize(10).text("Signature image unavailable");
          }
        } else {
          doc.fillColor("#475569").fontSize(10).text(formatEmployeeFormValue(value));
        }

        doc.moveDown(0.45);
      }

      doc.moveDown(0.4);
    }

    const pageRange = doc.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc.fontSize(9).fillColor("#64748b").text(
        `Submitted ${new Date(params.submittedAt).toLocaleString()} | ${formDefinition.title} | ${params.employee.full_name}`,
        doc.page.margins.left,
        doc.page.height - 42,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
        },
      );
    }

    doc.end();
  });
};

const createSignedPdfUrl = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storagePath: string,
) => {
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    throw new Error("Unable to create a signed PDF URL.");
  }

  return data.signedUrl;
};

const resolveTokenAccess = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  token: string,
) => {
  const tokenHash = await hashToken(token);

  const { data: tokenRecord, error: tokenError } = await supabase
    .from("employee_form_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("invalidated_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (tokenError || !tokenRecord) {
    throw new Error("This onboarding link is invalid or has expired.");
  }

  const employee = await getEmployeeRecord(supabase, tokenRecord.employee_id as string);
  const submission = await getEmployeeSubmission(
    supabase,
    tokenRecord.employee_id as string,
    tokenRecord.form_key as string,
  );

  await supabase
    .from("employee_form_tokens")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", tokenRecord.id);

  return {
    tokenRecord,
    employee,
    submission,
  };
};

const createPreviewTokenLink = async (params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  employeeId: string;
  formKey: string;
  baseUrl: string;
  actorId: string | null;
}) => {
  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await params.supabase
    .from("employee_form_tokens")
    .insert({
      employee_id: params.employeeId,
      form_key: params.formKey,
      token_hash: tokenHash,
      token_preview: rawToken.slice(0, 8),
      expires_at: expiresAt,
      created_by: params.actorId,
    });

  if (error) {
    throw new Error("Unable to create preview token.");
  }

  return {
    url: buildEmployeeOnboardingUrl(params.baseUrl, rawToken),
    expiresAt,
  };
};

const handleSendPacket = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  body: Record<string, unknown>,
) => {
  const adminUser = await getAdminUser(supabase, req);
  if (!adminUser) {
    throw new Error("Admin access is required.");
  }

  const employeeId = String(body.employeeId || "");
  const requestedFormKey = body.formKey ? String(body.formKey) : null;
  const regenerate = body.regenerate !== false;
  const baseUrl = String(body.baseUrl || "");

  if (!employeeId || !baseUrl) {
    throw new Error("Employee ID and base URL are required.");
  }

  if (requestedFormKey && !EMPLOYEE_FORM_MAP[requestedFormKey]) {
    throw new Error("Unsupported onboarding form.");
  }

  const employee = await getEmployeeRecord(supabase, employeeId);
  const formKeys = requestedFormKey ? [requestedFormKey] : EMPLOYEE_FORM_KEYS;
  const links: Array<{ title: string; url: string }> = [];

  for (const formKey of formKeys) {
    const submission = await getEmployeeSubmission(supabase, employeeId, formKey);
    const submissionTitle = EMPLOYEE_FORM_MAP[formKey]?.title || submission.form_title;

    if (regenerate) {
      await supabase
        .from("employee_form_tokens")
        .update({ invalidated_at: new Date().toISOString() })
        .eq("employee_id", employeeId)
        .eq("form_key", formKey)
        .is("invalidated_at", null);
    }

    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sentAt = new Date().toISOString();

    const { data: tokenRecord, error: tokenInsertError } = await supabase
      .from("employee_form_tokens")
      .insert({
        employee_id: employeeId,
        form_key: formKey,
        token_hash: tokenHash,
        token_preview: rawToken.slice(0, 8),
        expires_at: expiresAt,
        sent_at: sentAt,
        created_by: adminUser.id,
      })
      .select("*")
      .single();

    if (tokenInsertError || !tokenRecord) {
      throw new Error(`Unable to create onboarding token for ${submissionTitle}.`);
    }

    const nextStatus: EmployeeFormStatus =
      submission.status === "submitted" || submission.status === "complete" ? submission.status : "sent";

    await supabase
      .from("employee_form_submissions")
      .update({
        status: nextStatus,
        sent_at: sentAt,
        last_token_id: tokenRecord.id,
        last_saved_by: adminUser.id,
      })
      .eq("id", submission.id);

    links.push({
      title: submissionTitle,
      url: buildEmployeeOnboardingUrl(baseUrl, rawToken),
    });
  }

  const subject = requestedFormKey
    ? `JG Painting Pros onboarding form: ${links[0]?.title || "Secure link"}`
    : "Welcome to JG Painting Pros - onboarding packet";

  const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      to: employee.email,
      subject,
      html: buildOnboardingEmailHtml(employee, links),
      replyTo: "info@jgpaintingprosinc.com",
    }),
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    throw new Error(`Failed to send onboarding email: ${errorText}`);
  }

  await supabase
    .from("employees")
    .update({
      onboarding_packet_sent_at: new Date().toISOString(),
      onboarding_packet_sent_by: adminUser.id,
      updated_by: adminUser.id,
    })
    .eq("id", employeeId);

  return json({
    success: true,
    linksSent: links.length,
    message: requestedFormKey ? "Form link sent." : "Onboarding packet sent.",
  });
};

const handleValidateToken = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  body: Record<string, unknown>,
) => {
  const token = String(body.token || "");
  if (!token) {
    throw new Error("Token is required.");
  }

  const access = await resolveTokenAccess(supabase, token);

  return json({
    success: true,
    employee: access.employee,
    formKey: access.submission.form_key,
    status: access.submission.status,
    submittedAt: access.submission.submitted_at,
    payload: access.submission.form_payload || {},
    alreadySubmitted: ["submitted", "complete"].includes(access.submission.status),
    expiresAt: access.tokenRecord.expires_at,
  });
};

const handlePreviewEmail = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  body: Record<string, unknown>,
) => {
  const adminUser = await getAdminUser(supabase, req);
  if (!adminUser) {
    throw new Error("Admin access is required.");
  }

  const employeeId = String(body.employeeId || "");
  const baseUrl = String(body.baseUrl || "");
  if (!employeeId || !baseUrl) {
    throw new Error("Employee ID and base URL are required.");
  }

  const employee = await getEmployeeRecord(supabase, employeeId);
  const links: Array<{ title: string; url: string }> = [];

  for (const formKey of EMPLOYEE_FORM_KEYS) {
    const submission = await getEmployeeSubmission(supabase, employeeId, formKey);
    const previewLink = await createPreviewTokenLink({
      supabase,
      employeeId,
      formKey,
      baseUrl,
      actorId: adminUser.id,
    });

    links.push({
      title: EMPLOYEE_FORM_MAP[formKey]?.title || submission.form_title,
      url: previewLink.url,
    });
  }

  return json({
    success: true,
    subject: "Welcome to JG Painting Pros - onboarding packet",
    html: buildOnboardingEmailHtml(employee, links),
  });
};

const handlePreviewLink = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  body: Record<string, unknown>,
) => {
  const adminUser = await getAdminUser(supabase, req);
  if (!adminUser) {
    throw new Error("Admin access is required.");
  }

  const employeeId = String(body.employeeId || "");
  const formKey = String(body.formKey || "");
  const baseUrl = String(body.baseUrl || "");
  if (!employeeId || !formKey || !baseUrl) {
    throw new Error("Employee ID, form key, and base URL are required.");
  }

  if (!EMPLOYEE_FORM_MAP[formKey]) {
    throw new Error("Unsupported onboarding form.");
  }

  const previewLink = await createPreviewTokenLink({
    supabase,
    employeeId,
    formKey,
    baseUrl,
    actorId: adminUser.id,
  });

  return json({
    success: true,
    url: previewLink.url,
    expiresAt: previewLink.expiresAt,
  });
};

const handleSaveSubmission = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  body: Record<string, unknown>,
) => {
  const token = body.token ? String(body.token) : null;
  const payload = (body.payload as Record<string, unknown>) || {};

  let employee: EmployeeRecord;
  let submission: EmployeeSubmissionRecord;
  let actorId: string | null = null;
  let targetStatus: EmployeeFormStatus;

  if (token) {
    const access = await resolveTokenAccess(supabase, token);
    employee = access.employee;
    submission = access.submission;

    if (["submitted", "complete"].includes(submission.status)) {
      throw new Error("This onboarding form has already been submitted.");
    }

    targetStatus = "submitted";
  } else {
    const adminUser = await getAdminUser(supabase, req);
    if (!adminUser) {
      throw new Error("Admin access is required.");
    }

    const employeeId = String(body.employeeId || "");
    const formKey = String(body.formKey || "");
    if (!employeeId || !formKey) {
      throw new Error("Employee ID and form key are required.");
    }

    employee = await getEmployeeRecord(supabase, employeeId);
    submission = await getEmployeeSubmission(supabase, employeeId, formKey);
    actorId = adminUser.id;

    const requestedStatus = String(body.status || submission.status) as EmployeeFormStatus;
    if (!["sent", "submitted", "complete"].includes(requestedStatus)) {
      throw new Error("Unsupported submission status.");
    }

    targetStatus = requestedStatus;
  }

  const formDefinition = EMPLOYEE_FORM_MAP[submission.form_key];
  if (!formDefinition) {
    throw new Error("Unsupported onboarding form.");
  }

  const now = new Date().toISOString();
  const nextRevision = (submission.pdf_revision || 0) + 1;
  let mergedValues = buildEmployeeFieldDefaults(employee as EmployeeBasicInfo, payload);
  mergedValues = await syncSmsConsentToLinkedProfile(
    supabase,
    req,
    employee,
    submission.form_key,
    mergedValues,
  );
  const pdfBytes = await renderSubmissionPdf({
    employee,
    formKey: submission.form_key,
    values: mergedValues,
    submittedAt: now,
  });

  const fileName = `${submission.form_key}-revision-${nextRevision}.pdf`;
  const storagePath = `employees/${employee.id}/onboarding/${submission.form_key}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Unable to upload generated PDF: ${uploadError.message}`);
  }

  const { data: pdfRow, error: pdfRowError } = await supabase
    .from("employee_form_pdf_files")
    .insert({
      employee_id: employee.id,
      form_key: submission.form_key,
      revision: nextRevision,
      storage_bucket: "files",
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "application/pdf",
      byte_size: pdfBytes.byteLength,
      created_by: actorId,
    })
    .select("*")
    .single();

  if (pdfRowError || !pdfRow) {
    throw new Error("Unable to create the PDF reference record.");
  }

  const updatePayload: Record<string, unknown> = {
    status: targetStatus,
    form_payload: mergedValues,
    form_structure_snapshot: formDefinition,
    latest_pdf_file_id: pdfRow.id,
    pdf_revision: nextRevision,
    last_saved_by: actorId,
  };

  if (!submission.submitted_at) {
    updatePayload.submitted_at = now;
  }

  if (targetStatus === "complete") {
    updatePayload.completed_at = submission.completed_at || now;
  } else if (submission.completed_at && targetStatus !== "complete") {
    updatePayload.completed_at = null;
  }

  const { error: submissionUpdateError } = await supabase
    .from("employee_form_submissions")
    .update(updatePayload)
    .eq("id", submission.id);

  if (submissionUpdateError) {
    throw new Error(`Unable to save form submission: ${submissionUpdateError.message}`);
  }

  return json({
    success: true,
    status: targetStatus,
    submittedAt: updatePayload.submitted_at || submission.submitted_at || now,
  });
};

const handlePdfUrl = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  req: Request,
  body: Record<string, unknown>,
) => {
  await getAdminUser(supabase, req);

  const employeeId = String(body.employeeId || "");
  const formKey = String(body.formKey || "");
  if (!employeeId || !formKey) {
    throw new Error("Employee ID and form key are required.");
  }

  const submission = await getEmployeeSubmission(supabase, employeeId, formKey);
  if (!submission.latest_pdf_file_id) {
    throw new Error("No generated PDF is available for this form yet.");
  }

  const { data: pdfRow, error: pdfError } = await supabase
    .from("employee_form_pdf_files")
    .select("*")
    .eq("id", submission.latest_pdf_file_id)
    .single();

  if (pdfError || !pdfRow) {
    throw new Error("The latest PDF reference could not be loaded.");
  }

  const signedUrl = await createSignedPdfUrl(supabase, pdfRow.storage_path as string);
  return json({
    success: true,
    signedUrl,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const action = String(body.action || "");

    switch (action) {
      case "send_packet":
        return await handleSendPacket(supabase, req, body);
      case "validate_token":
        return await handleValidateToken(supabase, body);
      case "save_submission":
        return await handleSaveSubmission(supabase, req, body);
      case "pdf_url":
        return await handlePdfUrl(supabase, req, body);
      case "preview_email":
        return await handlePreviewEmail(supabase, req, body);
      case "preview_link":
        return await handlePreviewLink(supabase, req, body);
      default:
        return json({ success: false, error: "Unsupported action." }, 400);
    }
  } catch (error) {
    console.error("employee-onboarding error", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown employee onboarding error.",
      },
      500,
    );
  }
});
