SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    action_timing, 
    event_manipulation, 
    action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'jobs';
