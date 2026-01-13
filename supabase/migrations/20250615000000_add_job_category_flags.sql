-- Add is_default and is_system columns to job_categories
ALTER TABLE job_categories 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

-- Update core categories to be system and default
UPDATE job_categories 
SET is_default = true, is_system = true 
WHERE name IN ('Regular Paint', 'Ceiling Paint', 'Extra Charges');

-- Ensure they are set to false for others if null (though default handles new ones)
UPDATE job_categories 
SET is_default = false 
WHERE is_default IS NULL;

UPDATE job_categories 
SET is_system = false 
WHERE is_system IS NULL;
