-- Add is_active column to properties table
-- Active properties appear on the default "Active" tab
-- Inactive properties appear on the "Inactive" tab
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
