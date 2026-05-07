alter table public.diaries
  add column if not exists event_tag text,
  add column if not exists mood_tag text;

alter table public.profiles
  add column if not exists event_tags text[] not null default array['旅游', '看电影', '聚会', '工作', '散步', '独处']::text[],
  add column if not exists mood_tags text[] not null default array['开心', '高兴', '平静', '疲惫', '期待', '难过']::text[];
