-- Fix the normalize_property_storage_name function that has invalid regex
-- This is the REAL cause of the error!

CREATE OR REPLACE FUNCTION normalize_property_storage_name(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN '';
    END IF;

    -- Strip straight/curly apostrophes, allow spaces, normalize other symbols
    -- FIXED: Moved dash to end of character class to avoid invalid range
    v_clean := regexp_replace(input_text, '[' || chr(39) || chr(8217) || chr(8216) || ']', '', 'g');
    v_clean := regexp_replace(v_clean, '[^A-Za-z0-9 -]', '_', 'g');
    v_clean := regexp_replace(v_clean, '_{2,}', '_', 'g');
    v_clean := regexp_replace(v_clean, E'\\s{2,}', ' ', 'g');
    v_clean := trim(BOTH ' ' FROM trim(BOTH '_' FROM v_clean));

    IF v_clean = '' THEN
        v_clean := 'property_' || replace(gen_random_uuid()::text, '-', '');
    END IF;

    RETURN v_clean;
END;
$$;

-- Also update the alias function
CREATE OR REPLACE FUNCTION sanitize_for_storage(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT normalize_property_storage_name(input_text);
$$;

-- Test it
SELECT normalize_property_storage_name('Test Property');
-- Should return: Test Property
