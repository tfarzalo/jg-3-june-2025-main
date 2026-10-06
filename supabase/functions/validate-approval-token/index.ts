import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function normalizedImageType(category?: string | null, name?: string | null) {
  const value = `${category || ''} ${name || ''}`.toLowerCase();
  if (value.includes('before')) return 'before';
  if (value.includes('after')) return 'after';
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

    const now = new Date();
    const expiresAt = new Date(approval.expires_at);
    const actionExpired = !approval.used_at && now > expiresAt;

    // Email attachment selection is intentionally independent from the public
    // approval gallery. The gallery always shows every applicable job image.
    const selectedImageIds = new Set<string>(approval.extra_charges_data?.selected_images || []);
    
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

    const candidates = [
      ...(legacyResult.data || []).map((image) => ({
        id: image.id,
        file_path: image.file_path,
        file_name: image.file_name || image.file_path?.split('/').pop() || 'Job photo',
        image_type: normalizedImageType(image.image_type, image.file_name),
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
          image_type: normalizedImageType(file.category, file.name),
          mime_type: file.type || 'image/jpeg',
          bucket: 'files',
          source: 'files',
          created_at: file.created_at,
        }))
        .filter((image) => Boolean(image.file_path)),
    ].sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));

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
        selected: selectedImageIds.has(image.id),
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
    } else if (actionExpired) {
      resolvedStatus = 'expired';
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
          approverName: approval.approver_name,
          approverEmail: approval.approver_email,
          actionExpired,
          amount: approval.extra_charges_data?.total,
          description: approval.extra_charges_data?.items?.[0]?.description
        },
        token: approval,
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
