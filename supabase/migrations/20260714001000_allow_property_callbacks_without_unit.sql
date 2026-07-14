-- In-House property notes are property-level and should not require a unit.

ALTER TABLE public.property_callbacks
ALTER COLUMN unit_number DROP NOT NULL;
