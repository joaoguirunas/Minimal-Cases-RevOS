-- ═══════════════════════════════════════════════════════════════════
-- REVOS Control Plane — ADM Tables
-- Applies ONLY to Growth Sales Supabase (NOT synced to clients)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- adm_clients: registry of all client Supabase projects
-- ─────────────────────────────────────────────────────────────────
create table if not exists adm_clients (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  slug             text        not null unique,
  supabase_url     text        not null,
  anon_key         text        not null,
  service_role_key text,
  status           text        not null default 'active'
                   check (status in ('active', 'inactive', 'suspended')),
  sync_status      text        not null default 'never'
                   check (sync_status in ('never', 'pending', 'syncing', 'synced', 'error')),
  last_synced_at   timestamptz,
  plan             text        not null default 'starter'
                   check (plan in ('starter', 'pro', 'enterprise')),
  contact_name     text,
  contact_email    text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- adm_sync_jobs: sync job history per client
-- ─────────────────────────────────────────────────────────────────
create table if not exists adm_sync_jobs (
  id             uuid        primary key default gen_random_uuid(),
  client_id      uuid        not null references adm_clients(id) on delete cascade,
  triggered_by   text        not null default 'manual'
                 check (triggered_by in ('manual', 'github_actions', 'webhook')),
  type           text        not null default 'full'
                 check (type in ('full', 'migrations', 'functions')),
  status         text        not null default 'pending'
                 check (status in ('pending', 'running', 'success', 'failed', 'cancelled')),
  started_at     timestamptz,
  completed_at   timestamptz,
  error_message  text,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- adm_sync_logs: per-job log entries
-- ─────────────────────────────────────────────────────────────────
create table if not exists adm_sync_logs (
  id         uuid        primary key default gen_random_uuid(),
  job_id     uuid        not null references adm_sync_jobs(id) on delete cascade,
  level      text        not null default 'info'
             check (level in ('info', 'warning', 'error', 'success')),
  message    text        not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────
create index if not exists adm_sync_jobs_client_id_idx  on adm_sync_jobs(client_id);
create index if not exists adm_sync_jobs_status_idx     on adm_sync_jobs(status);
create index if not exists adm_sync_logs_job_id_idx     on adm_sync_logs(job_id);
create index if not exists adm_sync_logs_created_at_idx on adm_sync_logs(created_at);

-- ─────────────────────────────────────────────────────────────────
-- RLS: super_admin only
-- ─────────────────────────────────────────────────────────────────
alter table adm_clients   enable row level security;
alter table adm_sync_jobs enable row level security;
alter table adm_sync_logs enable row level security;

create policy "adm_clients_super_admin"
  on adm_clients for all
  using (
    exists (
      select 1 from settings_users
      where auth_user_id = auth.uid()
        and super_admin = true
        and active = true
        and deleted_at is null
    )
  );

create policy "adm_sync_jobs_super_admin"
  on adm_sync_jobs for all
  using (
    exists (
      select 1 from settings_users
      where auth_user_id = auth.uid()
        and super_admin = true
        and active = true
        and deleted_at is null
    )
  );

create policy "adm_sync_logs_super_admin"
  on adm_sync_logs for all
  using (
    exists (
      select 1 from settings_users
      where auth_user_id = auth.uid()
        and super_admin = true
        and active = true
        and deleted_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- updated_at auto-trigger
-- ─────────────────────────────────────────────────────────────────
create or replace function adm_clients_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger adm_clients_updated_at
  before update on adm_clients
  for each row execute function adm_clients_set_updated_at();
