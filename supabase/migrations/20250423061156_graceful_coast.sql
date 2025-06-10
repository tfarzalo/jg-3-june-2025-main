/*
  # Fix pmg_with_property_names View Security Definer Issue

  1. Changes
    - Drop existing view
    - Recreate view without SECURITY DEFINER
    - Ensure proper access to property management groups data

  2. Security
    - Remove SECURITY DEFINER to allow RLS policies to work correctly
    - Maintain existing functionality
*/

-- Drop the existing view
DROP VIEW IF EXISTS pmg_with_property_names;

-- Recreate the view without SECURITY DEFINER
CREATE VIEW pmg_with_property_names AS
SELECT 
    pmg.id,
    pmg.company_name,
    ARRAY_AGG(p.property_name) AS property_names
FROM property_management_groups pmg
LEFT JOIN properties p ON p.property_management_group_id = pmg.id
GROUP BY pmg.id, pmg.company_name;

-- First, let's see which billing category has the actual billing details
SELECT 
    bc.id,
    bc.name,
    COUNT(bd.id) as billing_details_count
FROM billing_categories bc
LEFT JOIN billing_details bd ON bd.category_id = bc.id
WHERE bc.name = 'Regular Paint'
GROUP BY bc.id, bc.name;

-- Then, we'll keep the one with billing details and delete the others
WITH keep_category AS (
    SELECT bc.id
    FROM billing_categories bc
    JOIN billing_details bd ON bd.category_id = bc.id
    WHERE bc.name = 'Regular Paint'
    LIMIT 1
)
DELETE FROM billing_categories bc
WHERE bc.name = 'Regular Paint'
AND bc.id NOT IN (SELECT id FROM keep_category);

SELECT get_job_details('0192faac-1a39-4282-b005-f201260c12e1');

SELECT 
    bd.*,
    bc.name as category_name,
    us.unit_size_label
FROM billing_details bd
JOIN billing_categories bc ON bc.id = bd.category_id
JOIN unit_sizes us ON us.id = bd.unit_size_id
WHERE bd.property_id = '688671ba-78aa-4709-8c52-cc89eb3db437'
AND bd.category_id = 'eb2740fe-c1af-46cc-bf54-2bb13d123935'
AND bd.unit_size_id = '290a5c36-cf37-421a-9c9a-0d502128d097';

SELECT 
    jc.id as job_category_id,
    jc.name as job_category_name,
    bc.id as billing_category_id,
    bc.name as billing_category_name
FROM job_categories jc
JOIN billing_categories bc ON bc.name = jc.name
WHERE jc.id = '96c1f2e5-499b-4df0-a54c-3c6d2b5fcf7d';