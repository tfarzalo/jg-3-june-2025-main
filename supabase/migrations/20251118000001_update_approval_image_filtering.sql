-- Migration: Update Approval Image Filtering with Approval Tokens
-- Date: November 18, 2025
-- Purpose: Update RLS policies to use approval_tokens instead of approvals table

-- =====================================================
-- STEP 1: Drop old RLS policy for job_images
-- =====================================================

DROP POLICY IF EXISTS "Public can view job images via approval token" ON job_images;

-- =====================================================
-- STEP 2: Create new RLS policy using approval_tokens
-- =====================================================

CREATE POLICY "Public can view job images via approval_tokens"
ON job_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM approval_tokens 
    WHERE approval_tokens.job_id = job_images.job_id 
      AND approval_tokens.used_at IS NULL 
      AND approval_tokens.expires_at > NOW()
  )
);

-- =====================================================
-- STEP 3: Ensure storage policies allow public read
-- =====================================================

-- Note: Storage policies for job-images bucket should already exist
-- from add_storage_policies_for_approval_images.sql
-- Skip the comment if the policy doesn't exist (it may be configured via Dashboard)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can read job images via signed URLs'
  ) THEN
    COMMENT ON POLICY "Public can read job images via signed URLs" ON storage.objects IS 
    'Allows public access to job-images bucket via signed URLs for approval workflow';
  ELSE
    RAISE NOTICE 'Storage policy "Public can read job images via signed URLs" not found - may need to be created via Supabase Dashboard';
  END IF;
END $$;

-- =====================================================
-- STEP 4: Add metadata column to approval_tokens (if not exists)
-- =====================================================

-- The extra_charges_data column already supports JSONB, so it can store:
-- - selected_images: array of image IDs
-- - selected_image_types: array of image type strings for categorization

-- Add a check to ensure extra_charges_data is properly structured
DO $$
BEGIN
  -- No schema changes needed - extra_charges_data is already JSONB
  -- Just ensure the column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'approval_tokens' 
    AND column_name = 'extra_charges_data'
  ) THEN
    RAISE EXCEPTION 'approval_tokens.extra_charges_data column not found - migration may have failed';
  END IF;
END $$;

-- =====================================================
-- STEP 5: Create helper function for debugging
-- =====================================================

CREATE OR REPLACE FUNCTION get_approval_token_images(p_token TEXT)
RETURNS TABLE (
  image_id UUID,
  file_path TEXT,
  image_type TEXT,
  selected BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_selected_ids UUID[];
BEGIN
  -- Get job_id and selected image IDs from token
  SELECT 
    at.job_id,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(at.extra_charges_data->'selected_images'))::UUID[],
      ARRAY[]::UUID[]
    )
  INTO v_job_id, v_selected_ids
  FROM approval_tokens at
  WHERE at.token = p_token
    AND at.used_at IS NULL
    AND at.expires_at > NOW();

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  RETURN QUERY
  SELECT 
    ji.id AS image_id,
    ji.file_path,
    ji.image_type,
    ji.id = ANY(v_selected_ids) AS selected
  FROM job_images ji
  WHERE ji.job_id = v_job_id;
END;
$$;

-- =====================================================
-- FINAL STEP: Grant execute on the function
-- =====================================================
GRANT EXECUTE ON FUNCTION get_approval_token_images(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_approval_token_images(TEXT) TO anon;

COMMENT ON FUNCTION get_approval_token_images IS 
'Debug helper: returns all job images with selected flag for a given approval token';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- To verify the policy is working, run:
-- SELECT * FROM get_approval_token_images('your-token-here');

-- To verify RLS is properly configured:
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual
-- FROM pg_policies
-- WHERE tablename = 'job_images';
