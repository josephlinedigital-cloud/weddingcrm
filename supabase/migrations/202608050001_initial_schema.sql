
-- Wedding HQ - Complete Supabase Schema
-- Run this in Supabase SQL Editor as a single migration.
-- Designed for Supabase Auth + PostgreSQL + Row Level Security.

begin;

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================

do $$ begin
  create type public.wedding_role as enum ('owner', 'admin', 'planner', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.guest_type as enum ('day', 'evening', 'ceremony_only', 'supplier');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.guest_age_group as enum ('adult', 'child', 'baby');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.rsvp_status as enum ('not_sent', 'invited', 'awaiting', 'attending', 'declined', 'maybe');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invitation_status as enum ('not_sent', 'sent', 'delivered', 'returned');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('not_due', 'due', 'part_paid', 'paid', 'overdue', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.supplier_status as enum ('researching', 'contacted', 'quoted', 'shortlisted', 'booked', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.timeline_status as enum ('planned', 'confirmed', 'in_progress', 'completed', 'delayed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_category as enum (
    'contract', 'invoice', 'receipt', 'venue_document', 'insurance',
    'menu', 'table_plan', 'ceremony_document', 'entertainment_document',
    'photography_document', 'other'
  );
exception when duplicate_object then null;
end $$;

-- =========================================================
-- COMMON FUNCTIONS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_rsvp_code()
returns text
language plpgsql
as $$
declare
  generated_code text;
begin
  generated_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
  return generated_code;
end;
$$;

-- =========================================================
-- CORE TABLES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  partner_one_name text,
  partner_two_name text,
  wedding_date date,
  ceremony_time time,
  ceremony_venue text,
  reception_venue text,
  timezone text not null default 'Europe/London',
  currency_code text not null default 'GBP',
  guest_capacity integer,
  budget_target numeric(12,2) not null default 0,
  rsvp_deadline date,
  website_url text,
  status text not null default 'planning',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_users (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.wedding_role not null default 'viewer',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

-- =========================================================
-- HOUSEHOLDS AND GUESTS
-- =========================================================

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  household_name text not null,
  primary_contact_name text,
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  county text,
  postcode text,
  country text default 'United Kingdom',
  rsvp_code text not null default public.generate_rsvp_code(),
  invitation_status public.invitation_status not null default 'not_sent',
  save_the_date_sent boolean not null default false,
  invitation_sent_at timestamptz,
  rsvp_reminder_sent_at timestamptz,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, rsvp_code)
);

create table if not exists public.meal_options (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  description text,
  course text,
  is_vegetarian boolean not null default false,
  is_vegan boolean not null default false,
  is_child_option boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  first_name text not null,
  last_name text,
  preferred_name text,
  title text,
  relationship_group text,
  guest_type public.guest_type not null default 'day',
  age_group public.guest_age_group not null default 'adult',
  email text,
  phone text,
  rsvp_status public.rsvp_status not null default 'not_sent',
  invitation_status public.invitation_status not null default 'not_sent',
  is_vip boolean not null default false,
  plus_one_allowed boolean not null default false,
  plus_one_name text,
  meal_option_id uuid references public.meal_options(id) on delete set null,
  dietary_requirements text,
  allergies text,
  accessibility_requirements text,
  requires_highchair boolean not null default false,
  requires_accommodation boolean not null default false,
  accommodation_notes text,
  requires_transport boolean not null default false,
  transport_notes text,
  table_id uuid,
  seat_number integer,
  gift_received boolean not null default false,
  thank_you_sent boolean not null default false,
  private_notes text,
  invited_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_relationships (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  related_guest_id uuid not null references public.guests(id) on delete cascade,
  relationship_type text not null,
  relationship_score integer not null default 0,
  should_sit_together boolean not null default false,
  should_not_sit_together boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  check (guest_id <> related_guest_id),
  unique (guest_id, related_guest_id)
);

create table if not exists public.rsvp_submissions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  submitted_by_name text,
  submitted_email text,
  attending boolean,
  meal_option_id uuid references public.meal_options(id) on delete set null,
  dietary_requirements text,
  accessibility_requirements text,
  plus_one_name text,
  song_request text,
  message_to_couple text,
  accommodation_required boolean,
  transport_required boolean,
  raw_payload jsonb not null default '{}'::jsonb,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

-- =========================================================
-- TABLE MANAGEMENT
-- =========================================================

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  shape text not null default 'round',
  capacity integer not null default 8 check (capacity > 0),
  x_position numeric(10,2),
  y_position numeric(10,2),
  rotation numeric(10,2) not null default 0,
  width numeric(10,2),
  height numeric(10,2),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guests
  drop constraint if exists guests_table_id_fkey;

alter table public.guests
  add constraint guests_table_id_fkey
  foreign key (table_id) references public.tables(id) on delete set null;

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  seat_number integer not null,
  x_position numeric(10,2),
  y_position numeric(10,2),
  rotation numeric(10,2) not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (table_id, seat_number)
);

create table if not exists public.guest_table_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  seat_id uuid references public.seats(id) on delete set null,
  is_locked boolean not null default false,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  unique (guest_id),
  unique (seat_id)
);

-- =========================================================
-- BUDGET AND PAYMENTS
-- =========================================================

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  planned_amount numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  business_name text not null,
  category text,
  status public.supplier_status not null default 'researching',
  primary_contact_name text,
  email text,
  phone text,
  website text,
  social_url text,
  address text,
  agreed_cost numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  next_payment_date date,
  contract_signed boolean not null default false,
  arrival_time time,
  setup_time time,
  service_start_time time,
  finish_time time,
  requirements text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  category_id uuid references public.budget_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  estimated_amount numeric(12,2) not null default 0,
  quoted_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'not_due',
  payment_due_date date,
  date_paid date,
  payment_method text,
  invoice_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  budget_item_id uuid references public.budget_items(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_date date not null default current_date,
  payment_method text,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ENTERTAINMENT
-- =========================================================

create table if not exists public.entertainment_details (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  performance_type text,
  performance_start time,
  performance_end time,
  set_lengths text,
  break_schedule text,
  setup_location text,
  equipment_requirements text,
  power_requirements text,
  first_dance_song text,
  must_play_songs text,
  do_not_play_songs text,
  contact_on_day text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id)
);

-- =========================================================
-- TIMELINE
-- =========================================================

create table if not exists public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  title text not null,
  timeline_type text not null default 'wedding_day',
  event_date date,
  start_time time,
  end_time time,
  location text,
  category text,
  assigned_user_id uuid references auth.users(id) on delete set null,
  description text,
  dependencies text,
  status public.timeline_status not null default 'planned',
  private_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TASKS
-- =========================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  description text,
  category text,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'not_started',
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  supplier_id uuid references public.suppliers(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  timeline_item_id uuid references public.timeline_items(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- DOCUMENTS
-- =========================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  category public.document_category not null default 'other',
  name text not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- MUSIC, PHOTOGRAPHY, ACCOMMODATION, TRANSPORT, GIFTS
-- =========================================================

create table if not exists public.music_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  category text not null,
  song_title text not null,
  artist text,
  requested_by_guest_id uuid references public.guests(id) on delete set null,
  spotify_url text,
  notes text,
  is_confirmed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photography_shots (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  category text,
  people_required text,
  location text,
  preferred_time time,
  priority public.task_priority not null default 'medium',
  notes text,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accommodation_bookings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  property_name text not null,
  booking_reference text,
  check_in_date date,
  check_out_date date,
  room_type text,
  cost numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'not_due',
  transport_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transport_bookings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  provider_name text,
  vehicle_type text,
  pickup_location text,
  dropoff_location text,
  pickup_time timestamptz,
  capacity integer,
  cost numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'not_due',
  contact_name text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transport_passengers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  transport_booking_id uuid not null references public.transport_bookings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  pickup_notes text,
  created_at timestamptz not null default now(),
  unique (transport_booking_id, guest_id)
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  gift_description text,
  cash_amount numeric(12,2) not null default 0,
  date_received date,
  thank_you_required boolean not null default true,
  thank_you_sent_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- SETTINGS AND ACTIVITY
-- =========================================================

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, key)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- HELPER FUNCTIONS FOR ACCESS CONTROL
-- =========================================================

create or replace function public.is_wedding_member(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_users wu
    where wu.wedding_id = target_wedding_id
      and wu.user_id = auth.uid()
  );
$$;

create or replace function public.has_wedding_role(
  target_wedding_id uuid,
  allowed_roles public.wedding_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_users wu
    where wu.wedding_id = target_wedding_id
      and wu.user_id = auth.uid()
      and wu.role = any(allowed_roles)
  );
$$;

-- =========================================================
-- AUTO PROFILE + FIRST OWNER MEMBERSHIP
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_wedding_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wedding_users (wedding_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'owner', new.created_by)
  on conflict (wedding_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_wedding_created on public.weddings;
create trigger on_wedding_created
after insert on public.weddings
for each row execute function public.add_wedding_owner();

-- =========================================================
-- AUTOMATIC PAYMENT TOTALS
-- =========================================================

create or replace function public.refresh_budget_item_paid_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item uuid;
  total_paid numeric(12,2);
  final_total numeric(12,2);
begin
  target_item := coalesce(new.budget_item_id, old.budget_item_id);

  if target_item is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payment_records
  where budget_item_id = target_item;

  select final_amount
  into final_total
  from public.budget_items
  where id = target_item;

  update public.budget_items
  set amount_paid = total_paid,
      payment_status = case
        when final_total <= 0 and total_paid <= 0 then 'not_due'::public.payment_status
        when total_paid <= 0 then
          case
            when payment_due_date is not null and payment_due_date < current_date
              then 'overdue'::public.payment_status
            else 'due'::public.payment_status
          end
        when total_paid < final_total then 'part_paid'::public.payment_status
        else 'paid'::public.payment_status
      end,
      date_paid = case when total_paid >= final_total and final_total > 0 then current_date else date_paid end,
      updated_at = now()
  where id = target_item;

  return coalesce(new, old);
end;
$$;

drop trigger if exists payment_records_refresh_budget_item on public.payment_records;
create trigger payment_records_refresh_budget_item
after insert or update or delete on public.payment_records
for each row execute function public.refresh_budget_item_paid_total();

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles','weddings','households','meal_options','guests','tables','budget_categories',
    'suppliers','supplier_contacts','budget_items','entertainment_details','timeline_items',
    'tasks','task_checklist_items','task_comments','documents','music_items',
    'photography_shots','accommodation_bookings','transport_bookings','gifts','app_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', tbl);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl
    );
  end loop;
end $$;

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_wedding_users_user_id on public.wedding_users(user_id);
create index if not exists idx_households_wedding_id on public.households(wedding_id);
create index if not exists idx_households_rsvp_code on public.households(rsvp_code);
create index if not exists idx_guests_wedding_id on public.guests(wedding_id);
create index if not exists idx_guests_household_id on public.guests(household_id);
create index if not exists idx_guests_rsvp_status on public.guests(wedding_id, rsvp_status);
create index if not exists idx_guests_table_id on public.guests(table_id);
create index if not exists idx_rsvp_submissions_wedding_id on public.rsvp_submissions(wedding_id);
create index if not exists idx_tables_wedding_id on public.tables(wedding_id);
create index if not exists idx_budget_items_wedding_id on public.budget_items(wedding_id);
create index if not exists idx_budget_items_due_date on public.budget_items(wedding_id, payment_due_date);
create index if not exists idx_suppliers_wedding_id on public.suppliers(wedding_id);
create index if not exists idx_tasks_wedding_id on public.tasks(wedding_id);
create index if not exists idx_tasks_due_date on public.tasks(wedding_id, due_date);
create index if not exists idx_timeline_items_date on public.timeline_items(wedding_id, event_date, start_time);
create index if not exists idx_documents_wedding_id on public.documents(wedding_id);
create index if not exists idx_activity_log_wedding_id on public.activity_log(wedding_id, created_at desc);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.wedding_users enable row level security;
alter table public.households enable row level security;
alter table public.meal_options enable row level security;
alter table public.guests enable row level security;
alter table public.guest_relationships enable row level security;
alter table public.rsvp_submissions enable row level security;
alter table public.tables enable row level security;
alter table public.seats enable row level security;
alter table public.guest_table_assignments enable row level security;
alter table public.budget_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.budget_items enable row level security;
alter table public.payment_records enable row level security;
alter table public.entertainment_details enable row level security;
alter table public.timeline_items enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.documents enable row level security;
alter table public.music_items enable row level security;
alter table public.photography_shots enable row level security;
alter table public.accommodation_bookings enable row level security;
alter table public.transport_bookings enable row level security;
alter table public.transport_passengers enable row level security;
alter table public.gifts enable row level security;
alter table public.app_settings enable row level security;
alter table public.activity_log enable row level security;

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Weddings
drop policy if exists "Members can view weddings" on public.weddings;
create policy "Members can view weddings"
on public.weddings for select
using (
  created_by = auth.uid()
  or public.is_wedding_member(id)
);

drop policy if exists "Authenticated users can create weddings" on public.weddings;
create policy "Authenticated users can create weddings"
on public.weddings for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Admins can update weddings" on public.weddings;
create policy "Admins can update weddings"
on public.weddings for update
using (
  created_by = auth.uid()
  or public.has_wedding_role(id, array['owner','admin']::public.wedding_role[])
)
with check (
  created_by = auth.uid()
  or public.has_wedding_role(id, array['owner','admin']::public.wedding_role[])
);

drop policy if exists "Owners can delete weddings" on public.weddings;
create policy "Owners can delete weddings"
on public.weddings for delete
using (
  created_by = auth.uid()
  or public.has_wedding_role(id, array['owner']::public.wedding_role[])
);

-- Wedding Users
drop policy if exists "Members can view wedding users" on public.wedding_users;
create policy "Members can view wedding users"
on public.wedding_users for select
using (public.is_wedding_member(wedding_id));

drop policy if exists "Owners and admins can add wedding users" on public.wedding_users;
create policy "Owners and admins can add wedding users"
on public.wedding_users for insert
with check (
  public.has_wedding_role(wedding_id, array['owner','admin']::public.wedding_role[])
);

drop policy if exists "Owners and admins can update wedding users" on public.wedding_users;
create policy "Owners and admins can update wedding users"
on public.wedding_users for update
using (
  public.has_wedding_role(wedding_id, array['owner','admin']::public.wedding_role[])
)
with check (
  public.has_wedding_role(wedding_id, array['owner','admin']::public.wedding_role[])
);

drop policy if exists "Owners and admins can remove wedding users" on public.wedding_users;
create policy "Owners and admins can remove wedding users"
on public.wedding_users for delete
using (
  public.has_wedding_role(wedding_id, array['owner','admin']::public.wedding_role[])
);

-- Generic private wedding data policies
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'households','meal_options','guests','guest_relationships','rsvp_submissions',
    'tables','seats','guest_table_assignments','budget_categories','suppliers',
    'supplier_contacts','budget_items','payment_records','entertainment_details',
    'timeline_items','tasks','task_checklist_items','task_comments','documents',
    'music_items','photography_shots','accommodation_bookings','transport_bookings',
    'transport_passengers','gifts','app_settings','activity_log'
  ]
  loop
    execute format('drop policy if exists "Members can view %I" on public.%I', tbl, tbl);
    execute format(
      'create policy "Members can view %I" on public.%I for select using (public.is_wedding_member(wedding_id))',
      tbl, tbl
    );

    execute format('drop policy if exists "Editors can insert %I" on public.%I', tbl, tbl);
    execute format(
      'create policy "Editors can insert %I" on public.%I for insert with check (public.has_wedding_role(wedding_id, array[''owner'',''admin'',''planner'']::public.wedding_role[]))',
      tbl, tbl
    );

    execute format('drop policy if exists "Editors can update %I" on public.%I', tbl, tbl);
    execute format(
      'create policy "Editors can update %I" on public.%I for update using (public.has_wedding_role(wedding_id, array[''owner'',''admin'',''planner'']::public.wedding_role[])) with check (public.has_wedding_role(wedding_id, array[''owner'',''admin'',''planner'']::public.wedding_role[]))',
      tbl, tbl
    );

    execute format('drop policy if exists "Admins can delete %I" on public.%I', tbl, tbl);
    execute format(
      'create policy "Admins can delete %I" on public.%I for delete using (public.has_wedding_role(wedding_id, array[''owner'',''admin'']::public.wedding_role[]))',
      tbl, tbl
    );
  end loop;
end $$;

-- =========================================================
-- PUBLIC RSVP LOOKUP + SUBMISSION RPC
-- =========================================================

create or replace function public.get_rsvp_household(invitation_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'household_id', h.id,
    'wedding_id', h.wedding_id,
    'household_name', h.household_name,
    'guests', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'first_name', g.first_name,
          'last_name', g.last_name,
          'preferred_name', g.preferred_name,
          'guest_type', g.guest_type,
          'age_group', g.age_group,
          'rsvp_status', g.rsvp_status,
          'plus_one_allowed', g.plus_one_allowed
        )
        order by g.created_at
      ) filter (where g.id is not null),
      '[]'::jsonb
    )
  )
  into result
  from public.households h
  left join public.guests g on g.household_id = h.id
  where upper(h.rsvp_code) = upper(invitation_code)
  group by h.id;

  return result;
end;
$$;

grant execute on function public.get_rsvp_household(text) to anon, authenticated;

create or replace function public.submit_guest_rsvp(
  invitation_code text,
  target_guest_id uuid,
  attending boolean,
  selected_meal_option_id uuid default null,
  dietary_text text default null,
  accessibility_text text default null,
  submitted_plus_one_name text default null,
  requested_song text default null,
  couple_message text default null,
  accommodation_needed boolean default false,
  transport_needed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_household public.households%rowtype;
  matched_guest public.guests%rowtype;
  submission_id uuid;
begin
  select *
  into matched_household
  from public.households
  where upper(rsvp_code) = upper(invitation_code)
  limit 1;

  if matched_household.id is null then
    raise exception 'Invalid RSVP code';
  end if;

  select *
  into matched_guest
  from public.guests
  where id = target_guest_id
    and household_id = matched_household.id
    and wedding_id = matched_household.wedding_id
  limit 1;

  if matched_guest.id is null then
    raise exception 'Guest not found for this invitation';
  end if;

  update public.guests
  set rsvp_status = case when attending then 'attending'::public.rsvp_status else 'declined'::public.rsvp_status end,
      meal_option_id = case when attending then selected_meal_option_id else null end,
      dietary_requirements = dietary_text,
      accessibility_requirements = accessibility_text,
      plus_one_name = submitted_plus_one_name,
      requires_accommodation = accommodation_needed,
      requires_transport = transport_needed,
      responded_at = now(),
      updated_at = now()
  where id = matched_guest.id;

  insert into public.rsvp_submissions (
    wedding_id,
    household_id,
    guest_id,
    submitted_by_name,
    submitted_email,
    attending,
    meal_option_id,
    dietary_requirements,
    accessibility_requirements,
    plus_one_name,
    song_request,
    message_to_couple,
    accommodation_required,
    transport_required
  )
  values (
    matched_guest.wedding_id,
    matched_household.id,
    matched_guest.id,
    coalesce(matched_guest.preferred_name, matched_guest.first_name),
    matched_household.email,
    attending,
    selected_meal_option_id,
    dietary_text,
    accessibility_text,
    submitted_plus_one_name,
    requested_song,
    couple_message,
    accommodation_needed,
    transport_needed
  )
  returning id into submission_id;

  return submission_id;
end;
$$;

grant execute on function public.submit_guest_rsvp(
  text, uuid, boolean, uuid, text, text, text, text, text, boolean, boolean
) to anon, authenticated;

-- =========================================================
-- DASHBOARD VIEW
-- =========================================================

create or replace view public.wedding_dashboard_summary
with (security_invoker = true)
as
select
  w.id as wedding_id,
  w.name,
  w.wedding_date,
  count(distinct g.id) as total_guests,
  count(distinct g.id) filter (where g.rsvp_status = 'attending') as attending_guests,
  count(distinct g.id) filter (where g.rsvp_status = 'declined') as declined_guests,
  count(distinct g.id) filter (where g.rsvp_status in ('not_sent','invited','awaiting','maybe')) as awaiting_guests,
  count(distinct g.id) filter (where g.guest_type = 'day') as day_guests,
  count(distinct g.id) filter (where g.guest_type = 'evening') as evening_guests,
  count(distinct g.id) filter (where g.age_group = 'child') as child_guests,
  count(distinct g.id) filter (
    where coalesce(g.dietary_requirements, '') <> ''
       or coalesce(g.allergies, '') <> ''
  ) as dietary_guests,
  count(distinct g.id) filter (
    where g.rsvp_status = 'attending'
      and g.table_id is null
  ) as unassigned_attending_guests,
  coalesce(sum(distinct bi.final_amount), 0) as total_budget_committed,
  coalesce(sum(distinct bi.amount_paid), 0) as total_budget_paid,
  coalesce(sum(distinct bi.final_amount - bi.amount_paid), 0) as total_budget_outstanding,
  count(distinct t.id) filter (
    where t.status <> 'completed'
      and t.due_date < current_date
  ) as overdue_tasks,
  count(distinct t.id) filter (
    where t.status <> 'completed'
      and t.due_date between current_date and current_date + 7
  ) as tasks_due_this_week
from public.weddings w
left join public.guests g on g.wedding_id = w.id
left join public.budget_items bi on bi.wedding_id = w.id
left join public.tasks t on t.wedding_id = w.id
group by w.id;

-- =========================================================
-- STORAGE BUCKET
-- =========================================================

insert into storage.buckets (id, name, public)
values ('wedding-documents', 'wedding-documents', false)
on conflict (id) do nothing;

drop policy if exists "Wedding members can view files" on storage.objects;
create policy "Wedding members can view files"
on storage.objects for select
using (
  bucket_id = 'wedding-documents'
  and exists (
    select 1
    from public.wedding_users wu
    where wu.user_id = auth.uid()
      and wu.wedding_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Wedding editors can upload files" on storage.objects;
create policy "Wedding editors can upload files"
on storage.objects for insert
with check (
  bucket_id = 'wedding-documents'
  and exists (
    select 1
    from public.wedding_users wu
    where wu.user_id = auth.uid()
      and wu.wedding_id::text = (storage.foldername(name))[1]
      and wu.role in ('owner','admin','planner')
  )
);

drop policy if exists "Wedding editors can update files" on storage.objects;
create policy "Wedding editors can update files"
on storage.objects for update
using (
  bucket_id = 'wedding-documents'
  and exists (
    select 1
    from public.wedding_users wu
    where wu.user_id = auth.uid()
      and wu.wedding_id::text = (storage.foldername(name))[1]
      and wu.role in ('owner','admin','planner')
  )
)
with check (
  bucket_id = 'wedding-documents'
  and exists (
    select 1
    from public.wedding_users wu
    where wu.user_id = auth.uid()
      and wu.wedding_id::text = (storage.foldername(name))[1]
      and wu.role in ('owner','admin','planner')
  )
);

drop policy if exists "Wedding admins can delete files" on storage.objects;
create policy "Wedding admins can delete files"
on storage.objects for delete
using (
  bucket_id = 'wedding-documents'
  and exists (
    select 1
    from public.wedding_users wu
    where wu.user_id = auth.uid()
      and wu.wedding_id::text = (storage.foldername(name))[1]
      and wu.role in ('owner','admin')
  )
);

commit;