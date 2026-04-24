UPDATE public.employee_form_submissions
SET form_title = 'SMS Messaging Opt-In Authorization'
WHERE form_key = 'new-hire-paperwork-7';

CREATE OR REPLACE FUNCTION public.seed_employee_form_submissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.employee_form_submissions (
    employee_id,
    form_key,
    form_title,
    status
  )
  VALUES
    (NEW.id, 'new-hire-paperwork', 'New Hire Paperwork', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-1', 'New Hire Paperwork 1', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-2', 'New Hire Paperwork 2', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-3', 'New Hire Paperwork 3', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-4', 'New Hire Paperwork 4', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-5', 'New Hire Paperwork 5', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-6', 'New Hire Paperwork 6', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-7', 'SMS Messaging Opt-In Authorization', 'not_sent');

  RETURN NEW;
END;
$$;
