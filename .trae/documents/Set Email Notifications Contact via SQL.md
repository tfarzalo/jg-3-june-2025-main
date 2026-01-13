**Goal**

* Provide a dynamic SQL function the app can call whenever a user checks an Email Notifications contact in Property Details. It sets properties.primary\_contact\_email based on the selection (manager, supervisor, AP, or user‑added contact).

**What It Does**

* Accepts a property id and a selection source.

* Supports user‑added contacts via contact id or contact email.

* Writes properties.primary\_contact\_email so the app’s extra charges and notifications use it as the “To” address.

**Function (Create Once, Call Dynamically)**

```sql
CREATE OR REPLACE FUNCTION public.set_notification_contact(
  p_property_id uuid,
  p_source text,              -- 'community_manager' | 'maintenance_supervisor' | 'ap' | 'contact_id' | 'contact_email'
  p_contact_id uuid DEFAULT NULL,
  p_contact_email text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_selected_email text := NULL;
BEGIN
  -- derive selected email by source
  IF p_source = 'community_manager' THEN
    SELECT community_manager_email INTO v_selected_email
    FROM public.properties WHERE id = p_property_id;
  ELSIF p_source = 'maintenance_supervisor' THEN
    SELECT maintenance_supervisor_email INTO v_selected_email
    FROM public.properties WHERE id = p_property_id;
  ELSIF p_source = 'ap' THEN
    SELECT ap_email INTO v_selected_email
    FROM public.properties WHERE id = p_property_id;
  ELSIF p_source = 'contact_id' AND p_contact_id IS NOT NULL THEN
    SELECT email INTO v_selected_email
    FROM public.property_contacts
    WHERE id = p_contact_id AND property_id = p_property_id;
  ELSIF p_source = 'contact_email' AND p_contact_email IS NOT NULL THEN
    SELECT pc.email INTO v_selected_email
    FROM public.property_contacts pc
    WHERE pc.property_id = p_property_id AND pc.email = p_contact_email
    LIMIT 1;
    IF v_selected_email IS NULL THEN
      v_selected_email := p_contact_email; -- allow direct email even if not found in contacts
    END IF;
  END IF;

  -- update default recipient (with safe fallbacks)
  UPDATE public.properties p
  SET primary_contact_email = COALESCE(
    NULLIF(v_selected_email, ''),
    (SELECT pc.email
     FROM public.property_contacts pc
     WHERE pc.property_id = p.id AND pc.email IS NOT NULL
     ORDER BY pc.created_at DESC NULLS LAST
     LIMIT 1),
    NULLIF(p.community_manager_email, ''),
    NULLIF(p.maintenance_supervisor_email, ''),
    NULLIF(p.ap_email, '')
  )
  WHERE p.id = p_property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**How to Use**

* Manager selected:

```sql
SELECT public.set_notification_contact('PROPERTY_UUID', 'community_manager');
```

* Supervisor selected:

```sql
SELECT public.set_notification_contact('PROPERTY_UUID', 'maintenance_supervisor');
```

* AP selected:

```sql
SELECT public.set_notification_contact('PROPERTY_UUID', 'ap');
```

* User‑added contact by id:

```sql
SELECT public.set_notification_contact('PROPERTY_UUID', 'contact_id', 'CONTACT_UUID');
```

* User‑added contact by email (no UUID required):

```sql
SELECT public.set_notification_contact('PROPERTY_UUID', 'contact_email', NULL, 'contact@example.com');
```

**Notes**

* Create column if needed via a migration: `ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_contact_email text;`

* Call from your app right when the user checks a radio in Property Details. This keeps behavior fully dynamic per property.

* Ensure the function runs with appropriate role/policy to update properties and read property\_contacts.

