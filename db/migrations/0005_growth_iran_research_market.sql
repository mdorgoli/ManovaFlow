-- Add the bounded Tehran research key. No existing rows, grants, RLS policies,
-- authorization tokens, or outreach permissions are changed.
-- Run atomically through the migration runner or psql --single-transaction.
alter table market_profile_snapshots drop constraint if exists market_profile_snapshots_market_key_check;
alter table market_profile_snapshots add constraint market_profile_snapshots_market_key_check check (
  market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai', 'ir-tehran')
);

alter table market_scores drop constraint if exists market_scores_market_key_check;
alter table market_scores add constraint market_scores_market_key_check check (
  market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai', 'ir-tehran')
);

alter table compliance_decisions drop constraint if exists compliance_decisions_market_key_check;
alter table compliance_decisions add constraint compliance_decisions_market_key_check check (
  market_key in ('fr-france', 'tr-istanbul', 'iq-kri-erbil', 'ae-dubai', 'ir-tehran')
);
