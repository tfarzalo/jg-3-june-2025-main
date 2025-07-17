-- Clean up duplicate billing categories and establish proper relationships
DO $$ 
DECLARE
    v_property_id uuid;
    v_category_name text;
    v_keep_category_id uuid;
    v_duplicate_category_id uuid;
    v_work_order_count integer;
BEGIN
    -- For each property
    FOR v_property_id IN SELECT DISTINCT property_id FROM billing_categories LOOP
        -- For each unique category name in this property
        FOR v_category_name IN 
            SELECT DISTINCT name 
            FROM billing_categories 
            WHERE property_id = v_property_id 
            GROUP BY name 
            HAVING COUNT(*) > 1
        LOOP
            -- Get the most recently created category to keep
            SELECT id INTO v_keep_category_id
            FROM billing_categories
            WHERE property_id = v_property_id
            AND name = v_category_name
            ORDER BY created_at DESC
            LIMIT 1;

            -- For each duplicate category
            FOR v_duplicate_category_id IN
                SELECT id
                FROM billing_categories
                WHERE property_id = v_property_id
                AND name = v_category_name
                AND id != v_keep_category_id
            LOOP
                -- Update billing details to use the kept category
                UPDATE billing_details
                SET category_id = v_keep_category_id
                WHERE category_id = v_duplicate_category_id;

                -- Delete the duplicate category
                DELETE FROM billing_categories
                WHERE id = v_duplicate_category_id;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Add unique constraint to prevent future duplicates
ALTER TABLE billing_categories
ADD CONSTRAINT unique_property_category_name UNIQUE (property_id, name);

-- Add foreign key constraint to ensure job_categories exist
ALTER TABLE billing_categories
ADD CONSTRAINT fk_job_category_name
FOREIGN KEY (name) REFERENCES job_categories(name)
ON DELETE RESTRICT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_billing_categories_property_name 
ON billing_categories(property_id, name);

-- Add trigger to ensure billing categories are always linked to job categories
CREATE OR REPLACE FUNCTION ensure_job_category_exists()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM job_categories WHERE name = NEW.name
    ) THEN
        RAISE EXCEPTION 'Job category "%" does not exist', NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_job_category_exists_trigger
BEFORE INSERT OR UPDATE ON billing_categories
FOR EACH ROW
EXECUTE FUNCTION ensure_job_category_exists(); 