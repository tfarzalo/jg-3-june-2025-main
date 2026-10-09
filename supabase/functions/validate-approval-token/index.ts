import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ApprovalUnavailableReason =
  | 'completed'
  | 'preview'
  | 'invalidated'
  | 'cancelled'
  | 'manually_approved'
  | 'job_changed'
  | 'superseded'
  | null;

function getApprovalUnavailableReason(input: {
  approvalType: string;
  usedAt?: string | null;
  decision?: string | null;
  invalidatedAt?: string | null;
  jobPhase?: string | null;
  hasNewerRequest: boolean;
  manualApprovalRecorded: boolean;
}): ApprovalUnavailableReason {
  if (input.usedAt || input.decision) return 'completed';
  if (input.approvalType !== 'extra_charges') return 'preview';
  if (input.invalidatedAt) return 'invalidated';
  if (input.hasNewerRequest) return 'superseded';
  if (input.jobPhase === 'Cancelled') return 'cancelled';
  if (input.manualApprovalRecorded) return 'manually_approved';
  if (input.jobPhase !== 'Pending Work Order') return 'job_changed';
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const approvalImageCategories = [
  'before', 'before_images', 'after', 'after_images',
  'sprinkler', 'sprinkler_images',
  'sprinkler_with_cover', 'sprinkler_with_cover_images',
  'sprinkler_without_cover', 'sprinkler_without_cover_images',
  'sprinkler_form', 'sprinkler_form_images',
  'other', 'other_files', 'job_files',
];

const imageExtensionPattern = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;

function isImageFile(file: { type?: string | null; name?: string | null; path?: string | null; storage_path?: string | null }) {
  if ((file.type || '').toLowerCase().startsWith('image/')) return true;
  return imageExtensionPattern.test(file.name || file.storage_path || file.path || '');
}

function normalizedImageType(category?: string | null, name?: string | null, path?: string | null) {
  const value = `${category || ''} ${name || ''} ${path || ''}`.toLowerCase();
  if (value.includes('before')) return 'before';
  if (value.includes('after')) return 'after';
  if (value.includes('sprinkler') && value.includes('without') && value.includes('cover')) {
    return 'sprinkler_without_cover';
  }
  if (value.includes('sprinkler') && value.includes('with') && value.includes('cover')) {
    return 'sprinkler_with_cover';
  }
  if (value.includes('sprinkler')) return 'sprinkler';
  return 'other';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Create Supabase client with service role (bypasses RLS for internal operations)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { token } = await req.json();
    
    if (!token) {
      throw new Error("Token is required");
    }

    // Fetch the token without expiry/used filters so we can apply custom logic
    const { data: approval, error: validationError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (validationError || !approval) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: "Invalid token"
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
          },
          status: 404,
        }
      );
    }

    const { data: newerApproval, error: newerApprovalError } = await supabase
      .from('approval_tokens')
      .select('id')
      .eq('job_id', approval.job_id)
      .eq('approval_type', approval.approval_type)
      .gt('created_at', approval.created_at)
      .is('invalidated_at', null)
      .limit(1)
      .maybeSingle();

    if (newerApprovalError) {
      throw new Error(`Error checking approval request history: ${newerApprovalError.message}`);
    }

    const extraChargesData = approval.extra_charges_data || {};
    const hasDedicatedApprovalSelection = Object.prototype.hasOwnProperty.call(
      extraChargesData,
      'approval_page_image_entries',
    );
    // New tokens use an approval-page-specific selection. Older tokens fall
    // back to the former shared attachment/page selection for compatibility.
    const selectedEntries = hasDedicatedApprovalSelection
      ? (Array.isArray(extraChargesData.approval_page_image_entries)
        ? extraChargesData.approval_page_image_entries
        : [])
      : (Array.isArray(extraChargesData.selected_image_entries)
        ? extraChargesData.selected_image_entries
        : []);
    const selectedImageIds = new Set<string>(
      hasDedicatedApprovalSelection
        ? (extraChargesData.approval_page_images || [])
        : (extraChargesData.selected_images || []),
    );
    
    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        property:properties(*),
        unit_size:unit_sizes(*),
        job_type:job_types(*),
        job_phase:job_phases(*)
      `)
      .eq('id', approval.job_id)
      .single();

    if (jobError) {
      throw new Error(`Error fetching job: ${jobError.message}`);
    }

    const { data: latestPhaseChange, error: phaseChangeError } = await supabase
      .from('job_phase_changes')
      .select('change_reason, changed_at')
      .eq('job_id', approval.job_id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (phaseChangeError) {
      console.error('Unable to inspect latest phase change:', phaseChangeError);
    }
    // A typed name/email is collected for both customer-link responses and
    // internal manual approvals, so identity alone cannot identify the source.
    // The manual admin flow records an explicit audit event. Scope the lookup
    // to this token's approval cycle so an older manual approval cannot be
    // applied to a later request for updated charges.
    let manualApprovalQuery = supabase
      .from('job_phase_changes')
      .select('id')
      .eq('job_id', approval.job_id)
      .ilike('change_reason', 'Extra charges approved manually%')
      .gte('changed_at', approval.created_at)
      .order('changed_at', { ascending: false })
      .limit(1);

    if (approval.decision_at) {
      const decisionWindowEnd = new Date(
        new Date(approval.decision_at).getTime() + 5 * 60 * 1000,
      ).toISOString();
      manualApprovalQuery = manualApprovalQuery.lte('changed_at', decisionWindowEnd);
    }

    const { data: manualApprovalEvent, error: manualApprovalError } = await manualApprovalQuery.maybeSingle();
    if (manualApprovalError) {
      console.error('Unable to inspect manual approval history:', manualApprovalError);
    }
    const latestChangeIsManualApproval = /extra charges approved manually/i.test(
      latestPhaseChange?.change_reason || '',
    );
    const manualApprovalRecorded = approval.decision
      ? Boolean(manualApprovalEvent)
      : latestChangeIsManualApproval;

    const actionUnavailableReason = getApprovalUnavailableReason({
      approvalType: approval.approval_type,
      usedAt: approval.used_at,
      decision: approval.decision,
      invalidatedAt: approval.invalidated_at,
      jobPhase: job?.job_phase?.job_phase_label,
      hasNewerRequest: Boolean(newerApproval),
      manualApprovalRecorded,
    });
    const actionAvailable = actionUnavailableReason === null;

    const { data: workOrders, error: workOrderError } = await supabase
      .from('work_orders')
      .select('id')
      .eq('job_id', approval.job_id);
    if (workOrderError) console.error('Error loading work orders for approval images:', workOrderError);
    const workOrderIds = (workOrders || []).map((row) => row.id);

    const [legacyResult, jobFilesResult, workOrderFilesResult] = await Promise.all([
      supabase.from('job_images').select('*').eq('job_id', approval.job_id).order('created_at', { ascending: true }),
      supabase.from('files')
        .select('id, name, path, storage_path, category, type, created_at')
        .eq('job_id', approval.job_id)
        .in('category', approvalImageCategories)
        .order('created_at', { ascending: true }),
      workOrderIds.length
        ? supabase.from('files')
          .select('id, name, path, storage_path, category, type, created_at')
          .in('work_order_id', workOrderIds)
          .in('category', approvalImageCategories)
          .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (legacyResult.error) console.error('Error loading legacy approval images:', legacyResult.error);
    if (jobFilesResult.error) console.error('Error loading job approval files:', jobFilesResult.error);
    if (workOrderFilesResult.error) console.error('Error loading work-order approval files:', workOrderFilesResult.error);

    const availableJobImages = [
      ...(legacyResult.data || []).map((image) => ({
        id: image.id,
        file_path: image.file_path,
        file_name: image.file_name || image.file_path?.split('/').pop() || 'Job photo',
        image_type: normalizedImageType(image.image_type, image.file_name, image.file_path),
        mime_type: image.mime_type || 'image/jpeg',
        bucket: 'job-images',
        source: 'job_images',
        created_at: image.created_at,
      })),
      ...[...(jobFilesResult.data || []), ...(workOrderFilesResult.data || [])]
        .filter(isImageFile)
        .map((file) => ({
          id: file.id,
          file_path: file.storage_path || file.path,
          file_name: file.name || file.storage_path?.split('/').pop() || file.path?.split('/').pop() || 'Job photo',
          image_type: normalizedImageType(file.category, file.name, file.storage_path || file.path),
          mime_type: file.type || 'image/jpeg',
          bucket: 'files',
          source: 'files',
          created_at: file.created_at,
        }))
        .filter((image) => Boolean(image.file_path)),
    ].sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));

    const availableByStorageLocation = new Map(
      availableJobImages.map((image) => [`${image.bucket}:${image.file_path}`.toLowerCase(), image]),
    );
    const candidates = selectedEntries.length > 0
      ? selectedEntries
          .map((entry) => {
            const bucket = entry.bucket || (entry.source === 'files' ? 'files' : 'job-images');
            return availableByStorageLocation.get(`${bucket}:${entry.file_path}`.toLowerCase()) || null;
          })
          .filter((image): image is (typeof availableJobImages)[number] => image !== null)
      : availableJobImages.filter((image) => selectedImageIds.has(image.id));

    const seenImages = new Set<string>();
    const uniqueImages = candidates.filter((image) => {
      const key = `${image.bucket}:${image.file_path}`.toLowerCase();
      if (seenImages.has(key)) return false;
      seenImages.add(key);
      return true;
    });

    const imagesWithSignedUrls = await Promise.all(uniqueImages.map(async (image) => {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(image.bucket)
        .createSignedUrl(image.file_path, 259200);
      if (signedUrlError) console.error(`Error creating approval image URL for ${image.file_path}:`, signedUrlError);
      return {
        id: image.id,
        file_path: image.file_path,
        file_name: image.file_name,
        image_type: image.image_type,
        mime_type: image.mime_type,
        signedUrl: signedUrlData?.signedUrl || null,
        source: image.source,
        selected: true,
      };
    }));

    // Determine the actual status
    let resolvedStatus: string;
    if (approval.decision) {
      resolvedStatus = approval.decision === 'declined' ? 'declined' : 'approved';
    } else if (approval.used_at) {
      // Look up real status from the approvals table via job_id and approval_type
      const { data: approvalRecord } = await supabase
        .from('approvals')
        .select('status')
        .eq('job_id', approval.job_id)
        .eq('approval_type', approval.approval_type)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedStatus = approvalRecord?.status || 'approved';
    } else if (actionUnavailableReason === 'cancelled') {
      resolvedStatus = 'cancelled';
    } else if (actionUnavailableReason === 'superseded') {
      resolvedStatus = 'superseded';
    } else if (actionUnavailableReason === 'invalidated') {
      resolvedStatus = 'invalidated';
    } else if (actionUnavailableReason === 'job_changed' || actionUnavailableReason === 'manually_approved') {
      resolvedStatus = 'invalidated';
    } else {
      resolvedStatus = 'pending';
    }

    const jobDetails = approval.extra_charges_data?.job_details || {};
    const normalizedJob = {
      ...job,
      property: {
        ...(job?.property || {}),
        name: job?.property?.property_name || jobDetails.property_name || 'Property',
        address: job?.property?.address || jobDetails.property_address || '',
        address_2: job?.property?.address_2 || '',
        city: job?.property?.city || '',
        state: job?.property?.state || '',
        zip: job?.property?.zip || '',
      },
    };

    // Return success response with all data from approval_tokens
    return new Response(
      JSON.stringify({ 
        valid: true,
        approval: {
          id: approval.id,
          type: approval.approval_type,
          status: resolvedStatus,
          expiresAt: approval.expires_at,
          usedAt: approval.used_at,
          decision: approval.decision,
          decisionAt: approval.decision_at,
          recipientName: approval.approver_name,
          recipientEmail: approval.approver_email,
          approverName: approval.decision_maker_name || approval.approver_name,
          approverEmail: approval.decision_maker_email || approval.approver_email,
          actionAvailable,
          actionUnavailableReason,
          amount: approval.extra_charges_data?.total,
          description: approval.extra_charges_data?.items?.[0]?.description
        },
        token: {
          ...approval,
          action_available: actionAvailable,
          action_unavailable_reason: actionUnavailableReason,
          decision_source: manualApprovalRecorded ? 'internal_manual' : 'approval_link',
        },
        job: normalizedJob,
        images: imagesWithSignedUrls
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error validating token:", error);
    
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: error.message || "Unknown error occurred"
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
