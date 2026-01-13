-- Update calendar_tokens RLS policies to allow admin/JG management access
begin;

-- Drop existing policies
drop policy if exists "Users can read their own calendar tokens" on public.calendar_tokens;
drop policy if exists "Users can insert their own calendar tokens" on public.calendar_tokens;
drop policy if exists "Users can update their own calendar tokens" on public.calendar_tokens;

-- Create new policies
create policy "ct_select_own_or_admin"
on public.calendar_tokens
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','jg_management','is_super_admin')
  )
);

create policy "ct_insert_self"
on public.calendar_tokens
for insert
to authenticated
with check (user_id = auth.uid());

-- Create helper RPC function
create or replace function public.ensure_calendar_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare t uuid;
begin
  select token into t from public.calendar_tokens where user_id = auth.uid();
  if t is null then
    insert into public.calendar_tokens (user_id, token)
    values (auth.uid(), gen_random_uuid())
    returning token into t;
  end if;
  return t;
end;
$$;

grant execute on function public.ensure_calendar_token() to authenticated;

commit;
