-- Ensure TBD is always available as a selectable unit size for job requests.
INSERT INTO public.unit_sizes (unit_size_label)
VALUES ('TBD')
ON CONFLICT (unit_size_label) DO NOTHING;
