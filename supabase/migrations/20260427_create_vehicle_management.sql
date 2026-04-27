create table if not exists public.vehicle_profiles (
  user_id uuid primary key,
  vehicle_name text,
  vehicle_model text,
  plate_number text,
  fuel_type text,
  current_mileage_km integer,
  inspection_due_date date,
  note text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vehicle_profiles_plate_number_idx
  on public.vehicle_profiles (plate_number);

create table if not exists public.vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expense_date date not null,
  category text not null,
  title text not null,
  amount integer not null,
  vendor text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicle_expenses_amount_check check (amount >= 0),
  constraint vehicle_expenses_category_check check (
    category in ('fuel', 'maintenance', 'repair', 'parking', 'wash', 'insurance', 'toll', 'other')
  )
);

create index if not exists vehicle_expenses_user_id_idx
  on public.vehicle_expenses (user_id);

create index if not exists vehicle_expenses_expense_date_idx
  on public.vehicle_expenses (expense_date desc);

alter table public.vehicle_profiles enable row level security;
alter table public.vehicle_expenses enable row level security;