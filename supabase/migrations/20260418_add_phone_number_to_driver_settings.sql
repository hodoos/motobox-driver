alter table public.driver_settings
add column if not exists phone_number text;

update public.driver_settings as ds
set phone_number = nullif(trim(u.raw_user_meta_data ->> 'phone_number'), '')
from auth.users as u
where ds.user_id = u.id
  and coalesce(ds.phone_number, '') = '';