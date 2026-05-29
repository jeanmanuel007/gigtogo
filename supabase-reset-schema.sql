drop table if exists public.shift_applications cascade;
drop table if exists public.shifts cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('worker', 'business')),
  phone text,
  location text,
  headline text,
  bio text,
  profile_image_path text,
  skills text[] not null default '{}',
  experience text,
  availability text,
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  location text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  pay_rate numeric(10, 2) not null,
  shift_type text not null default 'Flexible',
  description text,
  status text not null default 'open' check (status in ('open', 'assigned', 'completed', 'cancelled')),
  accepted_worker_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);

alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_applications enable row level security;

create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "users can create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "open shifts are readable by signed in users"
on public.shifts for select
to authenticated
using (true);

create policy "business users can create their own shifts"
on public.shifts for insert
to authenticated
with check (auth.uid() = business_id);

create policy "business users can update their own shifts"
on public.shifts for update
to authenticated
using (auth.uid() = business_id)
with check (auth.uid() = business_id);

create policy "assigned workers can release their shifts"
on public.shifts for update
to authenticated
using (auth.uid() = accepted_worker_id)
with check (accepted_worker_id is null);

create policy "workers can create their own applications"
on public.shift_applications for insert
to authenticated
with check (auth.uid() = worker_id);

create policy "workers can read their applications"
on public.shift_applications for select
to authenticated
using (auth.uid() = worker_id);

create policy "workers can cancel their applications"
on public.shift_applications for update
to authenticated
using (auth.uid() = worker_id)
with check (auth.uid() = worker_id and status in ('pending', 'cancelled'));

create policy "businesses can read applications for their shifts"
on public.shift_applications for select
to authenticated
using (
  exists (
    select 1 from public.shifts
    where shifts.id = shift_applications.shift_id
    and shifts.business_id = auth.uid()
  )
);

create policy "businesses can update applications for their shifts"
on public.shift_applications for update
to authenticated
using (
  exists (
    select 1 from public.shifts
    where shifts.id = shift_applications.shift_id
    and shifts.business_id = auth.uid()
  )
);
