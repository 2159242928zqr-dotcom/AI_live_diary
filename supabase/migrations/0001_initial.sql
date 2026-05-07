create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  qq_email text not null,
  invite_code text not null unique,
  invited_by_user_id uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_user_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_date date not null default current_date,
  title_encrypted text,
  summary_encrypted text,
  content_encrypted text,
  cover_image_id uuid null,
  status text not null default 'draft' check (status in ('draft','image_uploaded','chatting','generating','generated','deleted')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.diary_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_id uuid not null references public.diaries(id) on delete cascade,
  storage_path_encrypted text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.diaries
  add constraint diaries_cover_image_id_fkey
  foreign key (cover_image_id) references public.diary_images(id);

create table if not exists public.diary_audios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_id uuid not null references public.diaries(id) on delete cascade,
  message_id uuid,
  speaker text not null check (speaker in ('user','assistant')),
  storage_path_encrypted text not null,
  transcript_encrypted text,
  duration_seconds int,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.diary_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_id uuid not null references public.diaries(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  input_type text not null check (input_type in ('text','voice','ai_voice')),
  text_encrypted text,
  audio_id uuid references public.diary_audios(id),
  sequence int not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.diary_audios
  add constraint diary_audios_message_id_fkey
  foreign key (message_id) references public.diary_messages(id);

alter table public.profiles enable row level security;
alter table public.referrals enable row level security;
alter table public.diaries enable row level security;
alter table public.diary_images enable row level security;
alter table public.diary_messages enable row level security;
alter table public.diary_audios enable row level security;

create policy "profiles own rows" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "referrals own rows" on public.referrals for select using (inviter_user_id = auth.uid() or invitee_user_id = auth.uid());
create policy "diaries own rows" on public.diaries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "images own rows" on public.diary_images for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages own rows" on public.diary_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audios own rows" on public.diary_audios for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists diaries_user_date_idx on public.diaries(user_id, diary_date);
create index if not exists diary_messages_diary_sequence_idx on public.diary_messages(diary_id, sequence);
create index if not exists diary_images_diary_idx on public.diary_images(diary_id);
create index if not exists diary_audios_diary_idx on public.diary_audios(diary_id);
