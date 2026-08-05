-- Wedding HQ: venue layouts and wedding-scoped collaboration
create table if not exists public.venue_layouts (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null, venue_name text, room_name text, room_width numeric not null default 20, room_length numeric not null default 15,
  measurement_unit text not null default 'metres' check (measurement_unit in ('metres','feet')), grid_size numeric not null default 0.5,
  floor_colour text not null default '#eeeae1', background_path text, background_opacity numeric not null default .35,
  background_scale numeric not null default 1, background_rotation numeric not null default 0, is_final boolean not null default false,
  is_archived boolean not null default false, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.venue_layers (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  layout_id uuid not null references public.venue_layouts(id) on delete cascade, name text not null, sort_order integer not null default 0,
  is_visible boolean not null default true, is_locked boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.venue_objects (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  layout_id uuid not null references public.venue_layouts(id) on delete cascade, layer_id uuid references public.venue_layers(id) on delete set null,
  table_id uuid references public.tables(id) on delete set null, object_type text not null, name text not null,
  x_position numeric not null default 0, y_position numeric not null default 0, width numeric not null default 2, height numeric not null default 2,
  rotation numeric not null default 0, colour text not null default '#ffffff', capacity integer, notes text, is_locked boolean not null default false,
  is_visible boolean not null default true, layer_order integer not null default 0, supplier_id uuid references public.suppliers(id) on delete set null,
  setup_time time, updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.venue_layout_versions (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  layout_id uuid not null references public.venue_layouts(id) on delete cascade, version_number integer not null,
  snapshot jsonb not null, created_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(layout_id, version_number)
);
create table if not exists public.collaboration_sessions (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, current_page text, current_record text, last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(wedding_id,user_id)
);
create table if not exists public.record_editing_presence (
  id uuid primary key default gen_random_uuid(), wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, entity_type text not null, entity_id uuid not null,
  last_active_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(wedding_id,user_id,entity_type,entity_id)
);

do $$ declare tbl text; begin
  foreach tbl in array array['venue_layouts','venue_layers','venue_objects','collaboration_sessions'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',tbl);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',tbl);
  end loop;
end $$;
create index if not exists idx_venue_layouts_wedding on public.venue_layouts(wedding_id,updated_at desc);
create index if not exists idx_venue_objects_layout on public.venue_objects(wedding_id,layout_id,layer_order);
create index if not exists idx_collaboration_sessions_wedding on public.collaboration_sessions(wedding_id,last_active_at desc);

do $$ declare tbl text; begin
  foreach tbl in array array['venue_layouts','venue_layout_versions','venue_layers','venue_objects','collaboration_sessions','record_editing_presence'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('create policy "Wedding members can view %I" on public.%I for select using (public.is_wedding_member(wedding_id))',tbl,tbl);
    execute format('create policy "Wedding editors can insert %I" on public.%I for insert with check (public.has_wedding_role(wedding_id,array[''owner'',''admin'',''planner'']::public.wedding_role[]))',tbl,tbl);
    execute format('create policy "Wedding editors can update %I" on public.%I for update using (public.has_wedding_role(wedding_id,array[''owner'',''admin'',''planner'']::public.wedding_role[])) with check (public.has_wedding_role(wedding_id,array[''owner'',''admin'',''planner'']::public.wedding_role[]))',tbl,tbl);
    execute format('create policy "Wedding admins can delete %I" on public.%I for delete using (public.has_wedding_role(wedding_id,array[''owner'',''admin'']::public.wedding_role[]))',tbl,tbl);
  end loop;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.guests,public.households,public.rsvp_submissions,public.guest_table_assignments,public.tables,public.budget_items,public.payment_records,public.suppliers,public.tasks,public.timeline_items,public.documents,public.music_items,public.venue_layouts,public.venue_layers,public.venue_objects;
exception when duplicate_object then null; end $$;
