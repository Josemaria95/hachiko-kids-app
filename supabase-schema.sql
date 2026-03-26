-- Hachiko Kids — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.

-- 1. Tables
create table if not exists public.parents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  name text not null,
  mascot_type text not null default 'luna' check (mascot_type = 'luna'),
  mascot_name text not null,
  age_group text not null check (age_group in ('4-6', '7-12')),
  created_at timestamptz default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  situation text not null,
  situation_choice text not null,
  emotion text not null check (emotion in ('sad', 'angry', 'neutral', 'happy', 'scared')),
  created_at timestamptz default now()
);

-- 2. Indexes
create index if not exists idx_children_parent on public.children(parent_id);
create index if not exists idx_checkins_child on public.checkins(child_id);
create index if not exists idx_checkins_created on public.checkins(created_at);

-- 3. Row Level Security
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.checkins enable row level security;

-- Parents: users can only access their own row
create policy "Parents own row" on public.parents
  for all using (auth.uid() = id);

-- Children: parents can only access their own children
create policy "Parents own children" on public.children
  for all using (parent_id = auth.uid());

-- Checkins: parents can only access checkins for their own children
create policy "Parents own checkins" on public.checkins
  for all using (
    child_id in (select id from public.children where parent_id = auth.uid())
  );
