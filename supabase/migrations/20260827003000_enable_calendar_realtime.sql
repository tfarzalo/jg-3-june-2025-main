-- Enable realtime delivery for calendar schedule data.
-- This is intentionally idempotent and does not alter table data or RLS policies.

DO $$
DECLARE
  v_table regclass;
  v_table_name text;
  v_tables text[] := ARRAY[
    'public.jobs',
    'public.work_orders',
    'public.job_phase_changes',
    'public.job_phases',
    'public.calendar_events'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'Publication supabase_realtime does not exist; skipping calendar realtime setup.';
    RETURN;
  END IF;

  FOREACH v_table_name IN ARRAY v_tables LOOP
    v_table := to_regclass(v_table_name);

    IF v_table IS NULL THEN
      RAISE NOTICE 'Table % does not exist; skipping realtime setup for it.', v_table_name;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      WHERE p.pubname = 'supabase_realtime'
        AND pr.prrelid = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', v_table);
      RAISE NOTICE 'Added % to supabase_realtime publication.', v_table;
    ELSE
      RAISE NOTICE '% is already in supabase_realtime publication.', v_table;
    END IF;
  END LOOP;
END $$;
