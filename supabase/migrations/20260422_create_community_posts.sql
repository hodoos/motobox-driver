create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board_key text not null,
  title text not null,
  body text not null,
  author_user_id uuid not null,
  author_email text,
  author_name text,
  author_level text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_posts_board_key_check
    check (board_key in ('jobs', 'free-talk', 'notice', 'tips', 'affiliate'))
);

create index if not exists community_posts_board_key_idx
  on public.community_posts (board_key);

create index if not exists community_posts_updated_at_idx
  on public.community_posts (updated_at desc);

create index if not exists community_posts_author_user_id_idx
  on public.community_posts (author_user_id);

alter table public.community_posts enable row level security;