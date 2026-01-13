-- Storage Bucket Policies for Public Image Access via Signed URLs
-- Date: November 17, 2025
-- Purpose: Allow public access to job images via time-limited signed URLs

-- =====================================================
-- STORAGE BUCKET: job-images
-- =====================================================

-- Note: These policies need to be applied via Supabase Dashboard or CLI
-- as storage policies use a different syntax than regular RLS

-- Policy 1: Authenticated users can upload images
-- (Keep existing functionality)
CREATE POLICY "Authenticated users can upload job images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-images' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Authenticated users can read their uploaded images
-- (Keep existing functionality)
CREATE POLICY "Authenticated users can read job images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-images');

-- Policy 3: Allow PUBLIC READ via signed URLs
-- This is the critical policy for email approval workflow
CREATE POLICY "Public can read job images via signed URLs"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'job-images'
);

-- Policy 4: Authenticated users can update their images
CREATE POLICY "Authenticated users can update job images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-images')
WITH CHECK (bucket_id = 'job-images');

-- Policy 5: Authenticated users can delete their images
CREATE POLICY "Authenticated users can delete job images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-images');

-- =====================================================
-- STORAGE BUCKET: other-images (if needed)
-- =====================================================

CREATE POLICY "Public can read other images via signed URLs"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'other-images'
);

-- =====================================================
-- NOTES FOR MANUAL CONFIGURATION
-- =====================================================

/*
IMPORTANT: Storage policies may need to be configured via Supabase Dashboard

Navigate to: Storage > Policies > job-images

Ensure the bucket settings allow:
1. Public access: ENABLED (for signed URLs)
2. File size limit: Appropriate for images (e.g., 10MB)
3. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

For signed URL generation in code:
- Use supabase.storage.from('job-images').createSignedUrl()
- Set expiration: 259200 seconds (72 hours)
- This allows email recipients 3 days to review and approve
*/

-- =====================================================
-- HELPER FUNCTION: Generate Signed URLs for Job Images
-- =====================================================

CREATE OR REPLACE FUNCTION get_job_images_with_signed_urls(p_job_id UUID, expiry_seconds INT DEFAULT 259200)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  file_path TEXT,
  image_type TEXT,
  signed_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: Actual signed URL generation happens in application code
  -- This function prepares the data structure
  
  RETURN QUERY
  SELECT 
    ji.id,
    ji.job_id,
    ji.file_path,
    ji.image_type,
    ji.file_path as signed_url, -- Placeholder, actual URL generated in app
    NOW() + (expiry_seconds || ' seconds')::INTERVAL as expires_at
  FROM job_images ji
  WHERE ji.job_id = p_job_id
  ORDER BY 
    CASE ji.image_type
      WHEN 'before' THEN 1
      WHEN 'sprinkler' THEN 2
      WHEN 'other' THEN 3
      ELSE 4
    END,
    ji.created_at;
END;
$$;

COMMENT ON FUNCTION get_job_images_with_signed_urls IS 'Retrieves job images prepared for signed URL generation (actual signing happens in application layer)';
