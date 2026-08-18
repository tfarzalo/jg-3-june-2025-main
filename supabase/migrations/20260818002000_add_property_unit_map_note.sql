-- Add an optional note that can accompany or replace a property unit map image.
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS unit_map_note text;

COMMENT ON COLUMN public.properties.unit_map_note IS
  'Optional note or instructions shown with the property unit map, independent of whether a unit map file is uploaded.';
