alter table public.vehicle_profiles
  add column if not exists insurance_annual_cost integer;