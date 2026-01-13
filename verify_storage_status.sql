DO $$
DECLARE
    bucket_exists boolean;
    storage_policies_count int;
    files_policies_count int;
    constraint_exists boolean;
BEGIN
    -- Check Bucket
    SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') INTO bucket_exists;
    
    -- Check Storage Policies
    SELECT COUNT(*) INTO storage_policies_count 
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname IN (
        'Public Access', 
        'Authenticated users can upload files', 
        'Authenticated users can update files', 
        'Authenticated users can delete files'
    );

    -- Check Files Policies
    SELECT COUNT(*) INTO files_policies_count 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'files' AND policyname IN (
        'Authenticated users can view files', 
        'Authenticated users can insert files', 
        'Authenticated users can update files', 
        'Authenticated users can delete files'
    );

    -- Check Constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_file_type' AND table_name = 'files'
    ) INTO constraint_exists;

    -- Output Results
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'VERIFICATION RESULTS:';
    RAISE NOTICE '------------------------------------------------';
    
    IF bucket_exists THEN
        RAISE NOTICE '✅ Bucket "files": EXISTS';
    ELSE
        RAISE NOTICE '❌ Bucket "files": MISSING';
    END IF;

    IF storage_policies_count >= 4 THEN
        RAISE NOTICE '✅ Storage Policies: %/4 FOUND', storage_policies_count;
    ELSE
        RAISE NOTICE '⚠️ Storage Policies: %/4 FOUND (Check ensure_storage_ready.sql)', storage_policies_count;
    END IF;

    IF files_policies_count >= 4 THEN
        RAISE NOTICE '✅ Files Table Policies: %/4 FOUND', files_policies_count;
    ELSE
        RAISE NOTICE '⚠️ Files Table Policies: %/4 FOUND (Check ensure_storage_ready.sql)', files_policies_count;
    END IF;

    IF constraint_exists THEN
        RAISE NOTICE '❌ Constraint "valid_file_type": STILL EXISTS (Should be dropped)';
    ELSE
        RAISE NOTICE '✅ Constraint "valid_file_type": DROPPED (Correct)';
    END IF;
    
    RAISE NOTICE '------------------------------------------------';
END $$;