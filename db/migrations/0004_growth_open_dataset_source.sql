-- Discovery already validates OPEN_DATASET as a public source kind.
-- Keep the database allowlist aligned without reclassifying existing evidence.
-- The migration runner executes this replacement in one transaction.
alter table companies drop constraint if exists companies_source_kind_check;
alter table companies add constraint companies_source_kind_check check (
  source_kind in (
    'SYNTHETIC',
    'OFFICIAL_REGISTRY',
    'PUBLIC_COMPANY_WEBSITE',
    'OFFICIAL_ASSOCIATION',
    'OFFICIAL_PROCUREMENT',
    'OPEN_DATASET',
    'WARM_REFERRAL'
  )
);
