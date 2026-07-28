-- Run this after sentinel-portal-roles.sql if that migration was already applied.
alter table public.profiles add column if not exists portrait_path text;

create or replace function public.is_approved_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and membership_status = 'approved' and role in ('member', 'admin')) $$;

drop function if exists public.get_approved_member_directory();
create function public.get_approved_member_directory()
returns table(id uuid, full_name text, source text, portrait_path text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_approved_member() then raise exception 'Approved members only'; end if;
  return query
  select directory.id, directory.full_name, directory.source, directory.portrait_path
  from (
    select p.id, p.full_name, 'Online member'::text as source, p.portrait_path
    from public.profiles p where p.membership_status = 'approved'
    union all
    select m.id, m.full_name, 'Church register'::text as source, null::text as portrait_path
    from public.manual_members m where m.membership_status = 'approved'
  ) directory order by directory.full_name;
end;
$$;
revoke all on function public.get_approved_member_directory() from public;
grant execute on function public.get_approved_member_directory() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-portraits', 'member-portraits', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Members read own private portrait" on storage.objects;
drop policy if exists "Approved members view member portraits" on storage.objects;
drop policy if exists "Members upload own private portrait" on storage.objects;
drop policy if exists "Members replace own private portrait" on storage.objects;
drop policy if exists "Members remove own private portrait" on storage.objects;
create policy "Approved members view member portraits" on storage.objects for select to authenticated
using (bucket_id = 'member-portraits' and (owner_id = auth.uid() or public.is_admin() or public.is_approved_member()));
create policy "Members upload own private portrait" on storage.objects for insert to authenticated
with check (bucket_id = 'member-portraits' and owner_id = auth.uid());
create policy "Members replace own private portrait" on storage.objects for update to authenticated
using (bucket_id = 'member-portraits' and (owner_id = auth.uid() or public.is_admin()))
with check (bucket_id = 'member-portraits' and (owner_id = auth.uid() or public.is_admin()));
create policy "Members remove own private portrait" on storage.objects for delete to authenticated
using (bucket_id = 'member-portraits' and (owner_id = auth.uid() or public.is_admin()));

create or replace function public.set_my_portrait(new_path text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if new_path !~ ('^' || auth.uid()::text || '/') then raise exception 'Portrait path is not valid for this account'; end if;
  update public.profiles set portrait_path = new_path where id = auth.uid();
end;
$$;
revoke all on function public.set_my_portrait(text) from public;
grant execute on function public.set_my_portrait(text) to authenticated;
