-- Fix property-created activity details so bell notifications include the
-- property name and enough metadata for direct navigation.

CREATE OR REPLACE FUNCTION trigger_log_property_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'property',
    NEW.id,
    'created',
    format('Property "%s" created', COALESCE(NULLIF(NEW.property_name, ''), 'Unnamed Property')),
    jsonb_build_object(
      'title', 'New Property Created',
      'property_id', NEW.id,
      'property_name', COALESCE(NULLIF(NEW.property_name, ''), 'Unnamed Property'),
      'name', COALESCE(NULLIF(NEW.property_name, ''), 'Unnamed Property'),
      'address', NEW.address,
      'city', NEW.city,
      'state', NEW.state,
      'route', '/dashboard/properties/' || NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_log_property_creation() IS
  'Logs property creation with property_name and route metadata for bell notifications.';
