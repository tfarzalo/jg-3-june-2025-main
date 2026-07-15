import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

    // Extract selected images from extra_charges_data
    const selectedImageIds = approval.extra_charges_data?.selected_images || [];
    
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

    let imagesWithSignedUrls: Array<{ id: string; file_path: string; image_type: string; signedUrl: string | null; source?: string }> = [];
    const selectedEntries = approval.extra_charges_data?.selected_image_entries;

    if (selectedEntries && Array.isArray(selectedEntries) && selectedEntries.length > 0) {
      for (const entry of selectedEntries) {
        const bucket = entry.bucket || (entry.source === 'files' ? 'files' : 'job-images');
        try {
          const { data: signedUrlData, error: signedUrlError } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(entry.file_path, 259200);

          if (signedUrlError) {
            console.error('Error creating signed URL for entry', entry.file_path, signedUrlError);
            imagesWithSignedUrls.push({
              id: entry.id,
              file_path: entry.file_path,
              file_name: entry.file_name,
              image_type: entry.normalized_type || entry.source || 'photo',
              signedUrl: null,
              selected: true,
            });
          } else {
            imagesWithSignedUrls.push({
              id: entry.id,
              file_path: entry.file_path,
              file_name: entry.file_name,
              image_type: entry.normalized_type || entry.source || 'photo',
              signedUrl: signedUrlData?.signedUrl || null,
              selected: true,
            });
          }
        } catch (signedError) {
          console.error('Exception creating signed URL for entry', entry.file_path, signedError);
          imagesWithSignedUrls.push({
            id: entry.id,
            file_path: entry.file_path,
            file_name: entry.file_name,
            image_type: entry.normalized_type || entry.source || 'photo',
            signedUrl: null,
            selected: true,
          });
        }
      }
    } else {
      // Fetch only selected job images or all if no selection
      let images = [];
      if (selectedImageIds.length > 0) {
        const { data: selectedImages, error: imagesError } = await supabase
          .from('job_images')
          .select('*')
          .in('id', selectedImageIds);

        if (imagesError) {
          console.error("Error fetching selected images:", imagesError);
        } else {
          images = selectedImages || [];
        }
      } else {
        const { data: allImages, error: imagesError } = await supabase
          .from('job_images')
          .select('*')
          .eq('job_id', approval.job_id)
          .order('created_at', { ascending: true });

        if (imagesError) {
          console.error("Error fetching all images:", imagesError);
        } else {
          images = allImages || [];
        }
      }

      imagesWithSignedUrls = await Promise.all(
        (images || []).map(async (image) => {
          try {
            const { data: signedUrlData, error: signedUrlError } = await supabase
              .storage
              .from('job-images')
              .createSignedUrl(image.file_path, 259200); // 72 hours

            if (signedUrlError) {
              console.error(`Error creating signed URL for ${image.file_path}:`, signedUrlError);
              return {
                ...image,
                signedUrl: null,
                error: signedUrlError.message,
                selected: selectedImageIds.length === 0 || selectedImageIds.includes(image.id),
              };
            }

            return {
              ...image,
              signedUrl: signedUrlData.signedUrl,
              selected: selectedImageIds.length === 0 || selectedImageIds.includes(image.id),
            };
          } catch (err) {
            console.error(`Exception creating signed URL:`, err);
            return {
              ...image,
              signedUrl: null,
              error: err.message,
              selected: selectedImageIds.length === 0 || selectedImageIds.includes(image.id),
            };
          }
        })
      );
    }

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
