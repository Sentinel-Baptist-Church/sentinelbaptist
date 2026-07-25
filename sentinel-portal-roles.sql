-- Sentinel Baptist Church portal roles
-- Run once in Supabase Dashboard > SQL Editor.

alter type public.user_role add value if not exists 'non_member';
alter table public.profiles alter column role set default 'non_member';

-- Existing pending or declined applications are non-members until approved.
update public.profiles
set role = 'non_member'
where role = 'member' and membership_status <> 'approved';

-- From this point, only administrators have management access.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() $$;

create or replace function public.can_manage_members()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() $$;

create or replace function public.can_manage_events()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() $$;

-- Allows an administrator to transfer authority without exposing role updates
-- to ordinary members. The last administrator cannot remove their own access.
create or replace function public.set_portal_role(target_user_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change portal roles';
  end if;
  if new_role not in ('admin', 'member', 'non_member') then
    raise exception 'Invalid portal role';
  end if;
  if target_user_id = auth.uid() and new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Assign another administrator before removing your own administrator role';
  end if;
  update public.profiles set role = new_role where id = target_user_id;
  if not found then raise exception 'Member account not found'; end if;
end;
$$;
revoke all on function public.set_portal_role(uuid, text) from public;
grant execute on function public.set_portal_role(uuid, text) to authenticated;

-- A safe directory: approved members may see names only, never contact or
-- pastoral details. The function bypasses row-level security only to return
-- these selected fields.
create or replace function public.get_approved_member_directory()
returns table(id uuid, full_name text, source text)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and membership_status = 'approved'
      and role in ('member', 'admin')
  ) then
    raise exception 'Approved members only';
  end if;
  return query
  select directory.id, directory.full_name, directory.source
  from (
    select p.id, p.full_name, 'Online member'::text as source
    from public.profiles p where p.membership_status = 'approved'
    union all
    select m.id, m.full_name, 'Church register'::text as source
    from public.manual_members m where m.membership_status = 'approved'
  ) directory
  order by directory.full_name;
end;
$$;
revoke all on function public.get_approved_member_directory() from public;
grant execute on function public.get_approved_member_directory() to authenticated;
