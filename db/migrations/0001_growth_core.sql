create extension if not exists pgcrypto;

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'manovaflow_app') then
    create role manovaflow_app
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication;
  end if;
  execute format('grant manovaflow_app to %I', session_user);
end
$role$;

create or replace function manovaflow_current_tenant()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$function$;

create table if not exists tenants (
  id uuid primary key,
  name text not null check (length(name) between 1 and 160),
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid not null,
  role text not null check (role in ('OWNER', 'OPERATOR', 'VIEWER')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, actor_id)
);

create table if not exists lane_states (
  tenant_id uuid not null references tenants(id) on delete cascade,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  state text not null default 'RESEARCH_ONLY' check (state in ('RESEARCH_ONLY', 'HUMAN_SEND', 'BOUNDED_AUTOMATION', 'PAUSED', 'KILLED')),
  pack_state text not null check (pack_state in ('ACTIVE_DEVELOPMENT', 'VALIDATION_BACKLOG')),
  outbound_enabled boolean not null default false check (outbound_enabled = false),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, lane_key)
);

create table if not exists market_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  market_key text not null check (market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai')),
  profile jsonb not null,
  research_only boolean not null default true check (research_only = true),
  captured_at timestamptz not null default now(),
  unique (tenant_id, market_key)
);

create table if not exists research_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  status text not null check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  summary jsonb,
  unique (tenant_id, lane_key, idempotency_key),
  unique (tenant_id, id)
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  company_name text not null check (length(company_name) between 3 and 160),
  domain text not null,
  normalized_domain text not null,
  country char(2) not null,
  source_url text not null check (source_url like 'https://%'),
  source_kind text not null check (source_kind in ('SYNTHETIC', 'OFFICIAL_REGISTRY', 'PUBLIC_COMPANY_WEBSITE', 'OFFICIAL_ASSOCIATION', 'OFFICIAL_PROCUREMENT', 'WARM_REFERRAL')),
  synthetic boolean not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, normalized_domain),
  unique (tenant_id, id)
);

create table if not exists suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  normalized_domain text not null,
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (tenant_id, normalized_domain)
);

create table if not exists company_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  company_id uuid not null,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  total integer not null check (total between 0 and 100),
  status text not null check (status in ('ELIGIBLE', 'BELOW_THRESHOLD', 'KILLED')),
  explanation jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, run_id) references research_runs(tenant_id, id) on delete cascade,
  foreign key (tenant_id, company_id) references companies(tenant_id, id) on delete cascade,
  unique (tenant_id, run_id, company_id, lane_key)
);

create table if not exists market_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  market_key text not null check (market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai')),
  total integer not null check (total between 0 and 100),
  confidence text not null check (confidence in ('LOW', 'MEDIUM', 'HIGH')),
  explanation jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, run_id) references research_runs(tenant_id, id) on delete cascade,
  unique (tenant_id, run_id, lane_key, market_key)
);

create table if not exists compliance_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  decision_key text not null,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  market_key text not null check (market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai')),
  target_stage text not null check (target_stage in ('RESEARCH_ONLY', 'HUMAN_SEND')),
  status text not null,
  authorization_token text,
  recorded_at timestamptz not null,
  unique (tenant_id, decision_key)
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  company_id uuid not null,
  lane_key text not null check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  pack_state text not null check (pack_state in ('ACTIVE_DEVELOPMENT', 'VALIDATION_BACKLOG')),
  kind text not null check (kind in ('PRODUCT_DISCOVERY', 'WAITLIST_PREVIEW')),
  subject text not null,
  body text not null,
  synthetic boolean not null,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED_INTERNAL', 'REJECTED')),
  decided_by uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  outbound_enabled boolean not null default false check (outbound_enabled = false),
  foreign key (tenant_id, run_id) references research_runs(tenant_id, id) on delete cascade,
  foreign key (tenant_id, company_id) references companies(tenant_id, id) on delete cascade,
  unique (tenant_id, run_id, company_id, lane_key)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sequence bigint not null,
  event_type text not null,
  lane_key text check (lane_key in ('serviceflow', 'beautyflow', 'briefflow')),
  entity_id text not null,
  actor_id uuid not null,
  details jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, sequence)
);

create index if not exists research_runs_tenant_status_idx on research_runs (tenant_id, status, started_at desc);
create index if not exists companies_tenant_country_idx on companies (tenant_id, country);
create index if not exists company_scores_tenant_lane_idx on company_scores (tenant_id, lane_key, total desc);
create index if not exists market_scores_tenant_lane_idx on market_scores (tenant_id, lane_key, total desc);
create index if not exists drafts_tenant_decision_idx on drafts (tenant_id, decision, created_at desc);
create index if not exists audit_events_tenant_created_idx on audit_events (tenant_id, sequence);

create or replace function manovaflow_reject_immutable_mutation()
returns trigger
language plpgsql
as $function$
begin
  raise exception '% is append-only and cannot be changed', tg_table_name;
end
$function$;

drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable
before update or delete on audit_events
for each row execute function manovaflow_reject_immutable_mutation();

drop trigger if exists compliance_decisions_immutable on compliance_decisions;
create trigger compliance_decisions_immutable
before update or delete on compliance_decisions
for each row execute function manovaflow_reject_immutable_mutation();

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants',
    'memberships',
    'lane_states',
    'market_profile_snapshots',
    'research_runs',
    'companies',
    'suppressions',
    'company_scores',
    'market_scores',
    'compliance_decisions',
    'drafts',
    'audit_events'
  ]
  loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format('drop policy if exists tenant_isolation on %I', table_name);
    if table_name = 'tenants' then
      execute format(
        'create policy tenant_isolation on %I using (id = manovaflow_current_tenant()) with check (id = manovaflow_current_tenant())',
        table_name
      );
    else
      execute format(
        'create policy tenant_isolation on %I using (tenant_id = manovaflow_current_tenant()) with check (tenant_id = manovaflow_current_tenant())',
        table_name
      );
    end if;
  end loop;
end
$policies$;

grant usage on schema public to manovaflow_app;
grant execute on function manovaflow_current_tenant() to manovaflow_app;
grant select on tenants, memberships to manovaflow_app;
grant select, insert, update, delete on lane_states, market_profile_snapshots, research_runs, companies, suppressions, company_scores, market_scores, drafts to manovaflow_app;
grant select, insert on compliance_decisions, audit_events to manovaflow_app;
