-- Allows the login screen to accept either phone number or username.
-- It returns only the Auth phone identifier needed for sign-in.
create or replace function public.resolve_login_phone(identifier text)
returns text
language sql
security definer stable set search_path = public
as $$
  select p.phone
  from public.profiles p
  where p.phone = trim(identifier)
     or lower(p.username) = lower(trim(identifier))
  limit 1;
$$;

revoke all on function public.resolve_login_phone(text) from public;
grant execute on function public.resolve_login_phone(text) to anon, authenticated;
