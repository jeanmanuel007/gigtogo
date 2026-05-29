alter table public.profiles
add column if not exists phone text,
add column if not exists location text,
add column if not exists headline text,
add column if not exists bio text,
add column if not exists profile_image_path text,
add column if not exists skills text[] not null default '{}',
add column if not exists experience text,
add column if not exists availability text;
