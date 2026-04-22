alter table public.driver_settings
add column if not exists last_web_activity_at timestamptz;