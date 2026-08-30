-- Create Open-Source visibility table (global, works across domains)
create table if not exists public.settings_open_source_modules (
  id uuid primary key default gen_random_uuid(),
  module_id text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings_open_source_modules enable row level security;

-- Public portal needs to read this (no sensitive data)
create policy "Public can read open source modules"
on public.settings_open_source_modules
for select
to anon, authenticated
using (true);

-- Only admins/gestores can change visibility
create policy "Admins can manage open source modules"
on public.settings_open_source_modules
for all
to authenticated
using (is_admin_or_gestor())
with check (is_admin_or_gestor());

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_settings_open_source_modules_updated_at on public.settings_open_source_modules;
create trigger update_settings_open_source_modules_updated_at
before update on public.settings_open_source_modules
for each row
execute function public.update_updated_at_column();

-- Seed default rows (enabled by default)
insert into public.settings_open_source_modules (module_id, enabled)
values
  ('crm', true),
  ('conversas', true),
  ('disparos', true),
  ('reunioes', true),
  ('score', true),
  ('templates', true),
  ('followups', true),
  ('agentes-ia', true),
  ('fluxograma', true),
  ('tarefas', true),
  ('processos', true)
on conflict (module_id) do nothing;