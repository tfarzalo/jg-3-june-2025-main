-- 1. First, ensure all billing_categories have corresponding job_categories
INSERT INTO job_categories (name, description, sort_order)
SELECT DISTINCT name, description, sort_order
FROM billing_categories bc
WHERE NOT EXISTS (
    SELECT 1 FROM job_categories jc WHERE jc.name = bc.name
);

-- 2. Clean up duplicate billing categories per property
DO $$ 
DECLARE
    v_property_id uuid;
    v_category_name text;
    v_keep_category_id uuid;
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

            -- Update billing details to use the kept category
            UPDATE billing_details
            SET category_id = v_keep_category_id
            WHERE category_id IN (
                SELECT id
                FROM billing_categories
                WHERE property_id = v_property_id
                AND name = v_category_name
                AND id != v_keep_category_id
            );

            -- Delete duplicate categories
            DELETE FROM billing_categories
            WHERE property_id = v_property_id
            AND name = v_category_name
            AND id != v_keep_category_id;
        END LOOP;
    END LOOP;
END $$;

-- 3. Add constraints to prevent future issues
ALTER TABLE billing_categories
ADD CONSTRAINT unique_property_category_name UNIQUE (property_id, name);

ALTER TABLE billing_categories
ADD CONSTRAINT fk_job_category_name
FOREIGN KEY (name) REFERENCES job_categories(name)
ON DELETE RESTRICT;

-- 4. Add trigger to ensure billing categories are always linked to job categories
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