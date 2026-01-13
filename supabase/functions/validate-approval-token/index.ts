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

    // Validate the token directly from approval_tokens table
    const { data: approval, error: validationError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (validationError || !approval) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: "Invalid or expired token"
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
              image_type: entry.normalized_type || entry.source || 'photo',
              signedUrl: null,
            });
          } else {
            imagesWithSignedUrls.push({
              id: entry.id,
              file_path: entry.file_path,
              image_type: entry.normalized_type || entry.source || 'photo',
              signedUrl: signedUrlData?.signedUrl || null,
            });
          }
        } catch (signedError) {
          console.error('Exception creating signed URL for entry', entry.file_path, signedError);
          imagesWithSignedUrls.push({
            id: entry.id,
            file_path: entry.file_path,
            image_type: entry.normalized_type || entry.source || 'photo',
            signedUrl: null,
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
                error: signedUrlError.message
              };
            }

            return {
              ...image,
              signedUrl: signedUrlData.signedUrl
            };
          } catch (err) {
            console.error(`Exception creating signed URL:`, err);
            return {
              ...image,
              signedUrl: null,
              error: err.message
            };
          }
        })
      );
    }

    // Return success response with all data from approval_tokens
    return new Response(
      JSON.stringify({ 
        valid: true,
        approval: {
          id: approval.id,
          type: approval.approval_type,
          status: 'pending', // Tokens don't have used_at, so they're always pending
          expiresAt: approval.expires_at,
          amount: approval.extra_charges_data?.total,
          description: approval.extra_charges_data?.items?.[0]?.description
        },
        job: job,
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
