-- Ensure Callback jobs can be associated with a non-applicable unit size.
INSERT INTO public.unit_sizes (unit_size_label)
VALUES ('N/A')
ON CONFLICT (unit_size_label) DO NOTHING;
