-- =====================================================
-- Check Edge Function deployments and recent logs
-- =====================================================

-- 1. Check if the Edge Function exists and when it was last invoked
SELECT 
  'Edge Function Check' as check_type,
  schema_name,
  routine_name,
  routine_type,
  data_type as return_type,
  created,
  last_altered
FROM information_schema.routines
WHERE routine_name LIKE '%daily%agenda%' 
   OR routine_name LIKE '%send%daily%'
ORDER BY routine_name;

-- 2. Check vault secrets (if using Supabase Vault for storing Edge Function URL/key)
SELECT 
  'Vault Secrets Check' as check_type,
  id,
  name,
  description,
  created_at,
  updated_at
FROM vault.secrets
WHERE name LIKE '%daily%' 
   OR name LIKE '%email%'
   OR name LIKE '%edge%'
ORDER BY name;

-- 3. Alternative: Check if there are any stored configurations
SELECT 
  'System Config Check' as check_type,
  name,
  setting
FROM pg_settings
WHERE name LIKE '%http%'
   OR name LIKE '%extension%'
ORDER BY name;

-- 4. Check if HTTP extension is enabled
SELECT 
  'HTTP Extension Check' as check_type,
  extname,
  extversion,
  extnamespace::regnamespace as schema
FROM pg_extension
WHERE extname = 'http';
