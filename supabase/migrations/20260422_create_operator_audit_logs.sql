create table if not exists public.operator_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_email text,
  actor_level text not null,
  action text not null,
  target_type text not null,
  target_id text,
  source text,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists operator_audit_logs_actor_user_id_idx
  on public.operator_audit_logs (actor_user_id);

create index if not exists operator_audit_logs_created_at_idx
  on public.operator_audit_logs (created_at desc);

create index if not exists operator_audit_logs_action_idx
  on public.operator_audit_logs (action);

alter table public.operator_audit_logs enable row level security;