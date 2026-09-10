do $role$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'manovaflow_identity_runtime'
  ) then
    create role manovaflow_identity_runtime
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls;
  end if;

  alter role manovaflow_identity_runtime
    nologin
    nosuperuser
    nocreatedb
    nocreaterole
    noinherit
    noreplication
    nobypassrls;
  execute format(
    'grant manovaflow_identity_runtime to %I',
    session_user
  );
end
$role$;

alter table auth_sessions
  add column if not exists idle_expires_at timestamptz;

update auth_sessions
set idle_expires_at = expires_at
where idle_expires_at is null;

alter table auth_sessions
  alter column idle_expires_at set not null;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'auth_sessions_idle_expiry_bounds'
      and conrelid = 'auth_sessions'::regclass
  ) then
    alter table auth_sessions
      add constraint auth_sessions_idle_expiry_bounds
      check (
        idle_expires_at > issued_at
        and idle_expires_at <= expires_at
      );
  end if;
end
$constraint$;

create index if not exists auth_sessions_idle_expiry_idx
  on auth_sessions (idle_expires_at)
  where state = 'ACTIVE';

create table if not exists identity_security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  event_type text not null check (event_type in (
    'OIDC_SESSION_ISSUED',
    'OIDC_TOKEN_REPLAY_BLOCKED',
    'SESSION_ROTATED',
    'SESSION_REVOKED',
    'SESSION_REPLAY_BLOCKED',
    'SESSION_EXPIRED',
    'SESSION_IDLE_TIMEOUT',
    'SESSION_MFA_EXPIRED',
    'SESSION_CSRF_BLOCKED',
    'AUTH_RATE_LIMIT_BLOCKED',
    'SESSION_PURGED'
  )),
  outcome text not null check (outcome in (
    'SUCCEEDED', 'BLOCKED', 'EXPIRED', 'PURGED'
  )),
  tenant_id uuid,
  actor_id uuid,
  session_id uuid,
  subject_hash char(64) check (
    subject_hash is null or subject_hash ~ '^[0-9a-f]{64}$'
  ),
  request_hash char(64) check (
    request_hash is null or request_hash ~ '^[0-9a-f]{64}$'
  ),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object'
  )
);

create index if not exists identity_security_events_session_idx
  on identity_security_events (session_id, occurred_at)
  where session_id is not null;
create index if not exists identity_security_events_occurred_idx
  on identity_security_events (occurred_at desc);

drop trigger if exists identity_security_events_immutable
  on identity_security_events;
create trigger identity_security_events_immutable
before update or delete on identity_security_events
for each row execute function manovaflow_reject_immutable_mutation();

create table if not exists auth_rate_limit_buckets (
  operation text not null check (operation in (
    'SESSION_ROTATE', 'SESSION_REVOKE'
  )),
  key_hash char(64) not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null,
  primary key (operation, key_hash),
  check (
    blocked_until is null or blocked_until > window_started_at
  )
);

create index if not exists auth_rate_limit_buckets_updated_idx
  on auth_rate_limit_buckets (updated_at);

revoke create on schema public from public;
revoke all on schema public from manovaflow_identity_runtime;

revoke all on table
  oidc_identities,
  auth_sessions,
  auth_session_credentials,
  consumed_oidc_tokens,
  identity_security_events,
  auth_rate_limit_buckets
from manovaflow_identity_runtime;

revoke all on table
  oidc_identities,
  auth_sessions,
  auth_session_credentials,
  consumed_oidc_tokens,
  identity_security_events,
  auth_rate_limit_buckets
from public;

revoke all on table
  oidc_identities,
  auth_sessions,
  auth_session_credentials,
  consumed_oidc_tokens,
  identity_security_events,
  auth_rate_limit_buckets
from manovaflow_app;

grant usage on schema public to manovaflow_identity_runtime;
grant select on table oidc_identities to manovaflow_identity_runtime;
grant select, insert, update, delete on table
  auth_sessions,
  auth_session_credentials,
  consumed_oidc_tokens
to manovaflow_identity_runtime;
grant insert on table identity_security_events
to manovaflow_identity_runtime;
grant select, insert, update, delete on table auth_rate_limit_buckets
to manovaflow_identity_runtime;

revoke all on table
  tenants,
  memberships,
  lane_states,
  market_profile_snapshots,
  research_runs,
  companies,
  suppressions,
  company_scores,
  market_scores,
  compliance_decisions,
  drafts,
  audit_events
from manovaflow_identity_runtime;

revoke all on table
  tenants,
  memberships,
  lane_states,
  market_profile_snapshots,
  research_runs,
  companies,
  suppressions,
  company_scores,
  market_scores,
  compliance_decisions,
  drafts,
  audit_events
from public;
