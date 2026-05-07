insert into storage.buckets (id, name, public)
values
  ('diary-images-private', 'diary-images-private', false),
  ('diary-user-audios-private', 'diary-user-audios-private', false),
  ('diary-ai-audios-private', 'diary-ai-audios-private', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profiles_invited_by_user_id_idx on public.profiles(invited_by_user_id);
create index if not exists referrals_inviter_user_id_idx on public.referrals(inviter_user_id);
create index if not exists referrals_invitee_user_id_idx on public.referrals(invitee_user_id);
create index if not exists diaries_cover_image_id_idx on public.diaries(cover_image_id);
create index if not exists diary_images_user_id_idx on public.diary_images(user_id);
create index if not exists diary_audios_user_id_idx on public.diary_audios(user_id);
create index if not exists diary_audios_message_id_idx on public.diary_audios(message_id);
create index if not exists diary_messages_user_id_idx on public.diary_messages(user_id);
create index if not exists diary_messages_audio_id_idx on public.diary_messages(audio_id);

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "referrals own rows" on public.referrals;
drop policy if exists "diaries own rows" on public.diaries;
drop policy if exists "images own rows" on public.diary_images;
drop policy if exists "messages own rows" on public.diary_messages;
drop policy if exists "audios own rows" on public.diary_audios;

create policy "profiles own rows" on public.profiles
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "referrals own rows" on public.referrals
  for select
  using (inviter_user_id = (select auth.uid()) or invitee_user_id = (select auth.uid()));

create policy "diaries own rows" on public.diaries
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "images own rows" on public.diary_images
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "messages own rows" on public.diary_messages
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "audios own rows" on public.diary_audios
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
