-- Insert default job categories if they don't exist
INSERT INTO job_categories (name, description, sort_order)
SELECT 'Regular Paint', 'Standard interior and exterior painting services', 1
WHERE NOT EXISTS (
    SELECT 1 FROM job_categories WHERE name = 'Regular Paint'
);

INSERT INTO job_categories (name, description, sort_order)
SELECT 'Ceiling Paint', 'Specialized ceiling painting services', 2
WHERE NOT EXISTS (
    SELECT 1 FROM job_categories WHERE name = 'Ceiling Paint'
);

INSERT INTO job_categories (name, description, sort_order)
SELECT 'Extra Charges', 'Additional charges for special services or materials', 3
WHERE NOT EXISTS (
    SELECT 1 FROM job_categories WHERE name = 'Extra Charges'
); 