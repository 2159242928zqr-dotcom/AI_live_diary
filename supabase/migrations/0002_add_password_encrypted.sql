-- Add encrypted password column to profiles for admin recovery
alter table public.profiles
  add column if not exists password_encrypted text;
