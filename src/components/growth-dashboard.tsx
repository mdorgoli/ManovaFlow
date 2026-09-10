"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD_READ_MODEL_VERSION,
  DASHBOARD_SECTION_VERSIONS,
  type CapUsageItemV1,
  type DashboardReadModelV2,
  type LaneSummaryItemV1,
  type ReadValue
} from "@/modules/growth/application/dashboard-contracts";
import { REQUIRED_COMPLIANCE_CATEGORIES } from "@/modules/compliance/domain/gate";
import {
  LANE_KEYS,
  MARKET_KEYS,
  type LaneKey,
  type PackState
} from "@/modules/growth/domain/types";
import { DashboardAnalysis } from "@/components/dashboard-analysis";
import { DashboardAudit } from "@/components/dashboard-audit";

export interface GrowthDashboardProps {
  initialModel: DashboardReadModelV2 | null;
}

type LoadState = "loading" | "ready" | "error";

const LANE_INDEX: Record<LaneKey, string> = {
  serviceflow: "01",
  beautyflow: "02",
  briefflow: "03"
};

const CAP_ROWS = [
  { key: "sourceUrls", label: "URLs reviewed" },
  { key: "organizations", label: "Organizations reviewed" },
  { key: "markets", label: "Markets" },
  { key: "drafts", label: "Internal drafts" },
  { key: "elapsedMs", label: "Elapsed time (ms)" },
  { key: "paidSpend", label: "Paid spend" }
] as const;

export function GrowthDashboard({ initialModel }: GrowthDashboardProps) {
  const [model, setModel] = useState(initialModel);
  const [loadState, setLoadState] = useState<LoadState>(
    initialModel ? "ready" : "loading"
  );

  useEffect(() => {
    if (initialModel) return;

    const controller = new AbortController();
    async function loadDashboard(): Promise<void> {
      try {
        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal
        });
        const payload: unknown = await response.json();
        if (!response.ok || !isDashboardReadModel(payload)) {
          throw new Error("Dashboard read model is unavailable");
        }
        setModel(payload);
        setLoadState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setLoadState("error");
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [initialModel]);

  return (
    <main
      aria-label="ManovaFlow research operations dashboard"
      className="control-plane"
      dir="ltr"
    >
      {loadState === "loading" ? (
        <StatusPanel>Loading the Phase 1 read model</StatusPanel>
      ) : null}
      {loadState === "error" ? (
        <StatusPanel alert>Dashboard read model is unavailable</StatusPanel>
      ) : null}
      {model && loadState === "ready" ? <Dashboard model={model} /> : null}
    </main>
  );
}

function Dashboard({ model }: { model: DashboardReadModelV2 }) {
  const outbound = model.safetyContext.outbound;
  const publicResearch = model.safetyContext.dataset.value === "PUBLIC_RESEARCH";
  const laneNames = Object.fromEntries(
    model.laneSummary.lanes.map((lane) => [lane.laneKey, lane.displayName])
  ) as Record<LaneKey, string>;

  return (
    <>
      <section aria-label="Safety Context" className="safety-context">
        <div className="safety-badges" dir="ltr">
          <span>{model.safetyContext.mode.value}</span>
          <span>{publicResearch ? "PUBLIC-SOURCE RESEARCH" : "SYNTHETIC DATA"}</span>
          <span>{researchLabel(model.safetyContext.researchState.value)}</span>
          <span>
            Outbound = {outbound.state === "PRESENT" ? outbound.value.actions : "MISSING"}
          </span>
        </div>
        <p>
          No messages, calls, ads, bookings, purchases, or external actions are allowed in this environment.
        </p>
      </section>

      <header className="control-header">
        <div className="brand-block">
          <h1>ManovaFlow</h1>
        </div>
        <nav className="header-context" aria-label="Dashboard context">
          <span>Research operations console</span>
          <span className="current-view">Three parallel lanes</span>
          <span>No external actions</span>
        </nav>
        <time className="header-date" dateTime={model.generatedAt} dir="ltr">
          {model.generatedAt.slice(0, 10)}
        </time>
      </header>

      <section className="dashboard-context" aria-label="Snapshot provenance">
        <div>
          <span>Storage: <strong>{model.safetyContext.storageMode.value}</strong></span>
          <span>Snapshot: <time dateTime={model.generatedAt}>{model.generatedAt}</time></span>
        </div>
        <Link href="/market-scout" prefetch={false}>Website review evidence</Link>
        <Link href="/market-scout#marketing-workflow" prefetch={false}>Marketing workflow</Link>
        <p>
          {publicResearch ? "Public research records, not confirmed customers. " : "Synthetic demonstration records. "}
          Usage below belongs to the scoring stage of the last completed run; website reviews are recorded separately. Completed records do not mean agents are working now.
        </p>
      </section>

      <section aria-label="Three parallel agents" className="lanes-region">
        <h2 className="sr-only">Three parallel agents</h2>

        <div className="lane-columns">
          {model.laneSummary.lanes.map((lane) => (
            <LanePanel
              capUsage={
                model.capUsage.lanes.find(
                  (candidate) => candidate.laneKey === lane.laneKey
                ) ?? null
              }
              key={lane.laneKey}
              lane={lane}
            />
          ))}
        </div>
      </section>
      <DashboardAnalysis
        evidenceMatrix={model.evidenceMatrix}
        laneNames={laneNames}
        marketRanking={model.marketRanking}
      />
      <DashboardAudit model={model.safeAuditFeed} laneNames={laneNames} />
    </>
  );
}

function LanePanel({
  capUsage,
  lane
}: {
  capUsage: CapUsageItemV1 | null;
  lane: LaneSummaryItemV1;
}) {
  return (
    <article
      aria-labelledby={`lane-${lane.laneKey}`}
      className={`lane-panel lane-panel--${lane.laneKey}`}
    >
      <header className="lane-header">
        <div className="lane-heading">
          <span className="lane-index" dir="ltr">{LANE_INDEX[lane.laneKey]}</span>
          <div>
            <h3 id={`lane-${lane.laneKey}`}>{lane.displayName}</h3>
            <p>{researchLabel(lane.researchState.value)}</p>
          </div>
        </div>
        <span className="lane-signal">{packStateLabel(lane.packState.value)}</span>
      </header>

      <dl className="run-ledger">
        <LedgerRow label="Latest recorded run">
          <RunValue lane={lane} />
        </LedgerRow>
        <LedgerRow label="Usage source">
          {capUsage ? <SourceRunValue value={capUsage.sourceRun} /> : <Missing />}
        </LedgerRow>
        <LedgerRow label="Stop reason">
          <StopReasonValue lane={lane} />
        </LedgerRow>
      </dl>

      <div className="cap-heading">
        <span>Recorded usage</span>
        <span>Configured cap</span>
      </div>
      <dl className="cap-table">
        {CAP_ROWS.map(({ key, label }) => (
          <div className="cap-row" key={key}>
            <dt>{label}</dt>
            <dd>
              <ReadNumber value={capUsage?.usage[key] ?? null} />
              <span className="cap-divider" aria-hidden="true">/</span>
              <strong>
                {capUsage ? formatNumber(capUsage.limits[key].value) : "MISSING"}
              </strong>
            </dd>
          </div>
        ))}
      </dl>

    </article>
  );
}

function LedgerRow({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RunValue({ lane }: { lane: LaneSummaryItemV1 }) {
  if (lane.latestRun.state === "MISSING") {
    return <Missing reason={lane.latestRun.reason} />;
  }

  return (
    <span className="present-value" dir="ltr">
      {lane.latestRun.value.status} · {lane.latestRun.value.runReference}
    </span>
  );
}

function SourceRunValue({
  value
}: {
  value: CapUsageItemV1["sourceRun"];
}) {
  if (value.state === "MISSING") return <Missing reason={value.reason} />;
  return <span className="present-value" dir="ltr">{value.value.runReference}</span>;
}

function StopReasonValue({ lane }: { lane: LaneSummaryItemV1 }) {
  if (lane.latestRun.state === "MISSING") {
    return <Missing reason={lane.latestRun.reason} />;
  }
  const stopReason = lane.latestRun.value.stopReason;
  if (stopReason.state === "MISSING") return <Missing reason={stopReason.reason} />;
  return <span className="present-value" dir="ltr">{stopReason.value}</span>;
}

function ReadNumber({ value }: { value: ReadValue<number> | null }) {
  if (!value) return <Missing />;
  if (value.state === "MISSING") return <Missing reason={value.reason} />;
  return <span className="present-value">{formatNumber(value.value)}</span>;
}

function Missing({ reason }: { reason?: string }) {
  return (
    <span className="missing-value" title={reason}>
      MISSING
    </span>
  );
}

function StatusPanel({
  alert = false,
  children
}: {
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="status-panel" role={alert ? "alert" : "status"}>
      <span dir="ltr">MANOVAFLOW / PHASE 2B.1</span>
      <p>{children}</p>
    </section>
  );
}

function packStateLabel(state: PackState): string {
  return state === "ACTIVE_DEVELOPMENT"
    ? "Active development"
    : "Validation backlog / product not ready";
}

function researchLabel(state: "RESEARCH_ONLY"): string {
  return state === "RESEARCH_ONLY" ? "RESEARCH-ONLY" : "MISSING";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { useGrouping: false }).format(value);
}

function isDashboardReadModel(value: unknown): value is DashboardReadModelV2 {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<DashboardReadModelV2>;
  return (
    candidate.contractVersion === DASHBOARD_READ_MODEL_VERSION &&
    typeof candidate.generatedAt === "string" &&
    Number.isFinite(Date.parse(candidate.generatedAt)) &&
    isSafetyContext(candidate.safetyContext) &&
    isLaneSummary(candidate.laneSummary) &&
    isCapUsage(candidate.capUsage) &&
    isMarketRanking(candidate.marketRanking) &&
    isEvidenceMatrix(candidate.evidenceMatrix) &&
    isSafeAuditFeed(candidate.safeAuditFeed)
  );
}

function isSafetyContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.contractVersion === DASHBOARD_SECTION_VERSIONS.safetyContext &&
    isPresent(value.mode, (item) => item === "DEMO") &&
    isPresent(value.dataset, (item) => item === "SYNTHETIC" || item === "PUBLIC_RESEARCH") &&
    isPresent(
      value.storageMode,
      (item) => item === "POSTGRESQL" || item === "MEMORY_DEMO"
    ) &&
    isPresent(value.researchState, (item) => item === "RESEARCH_ONLY") &&
    isReadValue(value.outbound, (item) => {
      if (!isRecord(item)) return false;
      return (
        item.enabled === false && item.actions === 0 && item.sideEffects === 0
      );
    })
  );
}

function isLaneSummary(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.lanes)) return false;
  if (value.lanes.length !== LANE_KEYS.length) return false;
  const keys = new Set<string>();
  for (const lane of value.lanes) {
    if (!isRecord(lane) || !isLaneKey(lane.laneKey)) return false;
    keys.add(lane.laneKey);
    if (
      typeof lane.displayName !== "string" ||
      !isPresent(lane.researchState, (item) => item === "RESEARCH_ONLY") ||
      !isPresent(
        lane.packState,
        (item) =>
          item === "ACTIVE_DEVELOPMENT" || item === "VALIDATION_BACKLOG"
      ) ||
      !isReadValue(lane.latestRun, isLaneRun)
    ) {
      return false;
    }
  }
  return keys.size === LANE_KEYS.length;
}

function isCapUsage(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.lanes)) return false;
  if (value.lanes.length !== LANE_KEYS.length) return false;
  const keys = new Set<string>();
  for (const lane of value.lanes) {
    if (!isRecord(lane) || !isLaneKey(lane.laneKey)) return false;
    keys.add(lane.laneKey);
    if (
      lane.scope !== "LAST_COMPLETED_RUN" ||
      !isReadValue(lane.sourceRun, isSourceRun) ||
      !isReadValue(lane.window, isWindow) ||
      !isMeasurements(lane.limits, true) ||
      !isMeasurements(lane.usage, false)
    ) {
      return false;
    }
  }
  return keys.size === LANE_KEYS.length;
}

function isMarketRanking(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.contractVersion !== DASHBOARD_SECTION_VERSIONS.marketRanking ||
    !Array.isArray(value.lanes) ||
    value.lanes.length !== LANE_KEYS.length
  ) {
    return false;
  }
  const laneKeys = new Set<string>();
  for (const lane of value.lanes) {
    if (!isRecord(lane) || !isLaneKey(lane.laneKey)) return false;
    laneKeys.add(lane.laneKey);
    if (!isReadValue(lane.sourceRun, isSourceRun) || !Array.isArray(lane.markets)) {
      return false;
    }
    if (lane.markets.length !== MARKET_KEYS.length) return false;
    const marketKeys = new Set<string>();
    for (const market of lane.markets) {
      if (!isRecord(market) || !isMarketKey(market.marketKey)) return false;
      marketKeys.add(market.marketKey);
      if (
        typeof market.displayName !== "string" ||
        typeof market.geographicScope !== "string" ||
        typeof market.representsWholeCountry !== "boolean" ||
        !isReadValue(market.rank, isPositiveInteger) ||
        !isReadValue(market.score, isNonNegativeNumber) ||
        !isReadValue(
          market.confidence,
          (item) => item === "LOW" || item === "MEDIUM" || item === "HIGH"
        )
      ) {
        return false;
      }
    }
    if (marketKeys.size !== MARKET_KEYS.length) return false;
  }
  return laneKeys.size === LANE_KEYS.length;
}

function isEvidenceMatrix(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.contractVersion !== DASHBOARD_SECTION_VERSIONS.evidenceMatrix ||
    typeof value.disclaimer !== "string" ||
    !Array.isArray(value.precedence) ||
    value.precedence.join("|") !== "UNKNOWN|FACT|INFERENCE|MISSING" ||
    !Array.isArray(value.markets) ||
    value.markets.length !== MARKET_KEYS.length
  ) {
    return false;
  }
  const marketKeys = new Set<string>();
  for (const market of value.markets) {
    if (!isRecord(market) || !isMarketKey(market.marketKey)) return false;
    marketKeys.add(market.marketKey);
    if (
      typeof market.displayName !== "string" ||
      ![
        "HUMAN_SEND_BLOCKED",
        "HUMAN_REVIEW_REQUIRED",
        "RECORDED_DECISION_REQUIRED"
      ].includes(String(market.gateStatus)) ||
      market.humanSend !== "BLOCKED" ||
      !Array.isArray(market.cells) ||
      market.cells.length !== REQUIRED_COMPLIANCE_CATEGORIES.length
    ) {
      return false;
    }
    const categories = new Set<string>();
    for (const cell of market.cells) {
      if (!isRecord(cell) || !isComplianceCategory(cell.category)) return false;
      categories.add(cell.category);
      if (
        !["FACT", "INFERENCE", "UNKNOWN", "MISSING"].includes(String(cell.state)) ||
        cell.humanSend !== "BLOCKED" ||
        !hasProvenance(cell)
      ) {
        return false;
      }
    }
    if (categories.size !== REQUIRED_COMPLIANCE_CATEGORIES.length) return false;
  }
  return marketKeys.size === MARKET_KEYS.length;
}

function isSafeAuditFeed(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.contractVersion !== DASHBOARD_SECTION_VERSIONS.safeAuditFeed ||
    !["DETAIL", "HEALTH_ONLY"].includes(String(value.access)) ||
    !isReadValue(value.integrity, (item) => item === "CONTIGUOUS_SEQUENCE") ||
    !isPresent(value.totalEvents, (item) => isNonNegativeNumber(item) && Number.isSafeInteger(item)) ||
    !isReadValue(value.lastSequence, isPositiveInteger) ||
    !Array.isArray(value.entries) || value.entries.length > 100 ||
    !(value.nextCursor === null || (typeof value.nextCursor === "string" && /^[1-9]\d*$/.test(value.nextCursor)))
  ) return false;
  if (value.access === "HEALTH_ONLY" && (value.entries.length !== 0 || value.nextCursor !== null)) return false;
  const results: Record<string, string> = {
    RUN_STARTED: "STARTED", RUN_RETRIED: "STARTED", RUN_COMPLETED: "SUCCEEDED",
    RUN_FAILED: "FAILED", DRAFT_DECIDED_INTERNAL_ONLY: "RECORDED",
    TENANT_DOMAIN_SUPPRESSED: "RECORDED", MARKET_SCOUT_ACTIVITY_SNAPSHOT: "RECORDED"
  };
  let previousSequence = Infinity;
  return value.entries.every((entry) => {
    if (
      !isRecord(entry) || !isPositiveInteger(entry.sequence) ||
      typeof entry.sequence !== "number" || entry.sequence >= previousSequence ||
      typeof entry.occurredAt !== "string" || !Number.isFinite(Date.parse(entry.occurredAt)) ||
      !(entry.laneKey === null || isLaneKey(entry.laneKey)) ||
      typeof entry.eventType !== "string" || !Object.hasOwn(results, entry.eventType) ||
      entry.result !== results[entry.eventType] || entry.eventReference !== `audit:${entry.sequence}` ||
      !hasProvenance(entry)
    ) return false;
    previousSequence = entry.sequence;
    return true;
  });
}

function isMeasurements(value: unknown, mustBePresent: boolean): boolean {
  if (!isRecord(value)) return false;
  return [
    "sourceUrls",
    "organizations",
    "markets",
    "drafts",
    "elapsedMs",
    "consecutiveLowValue",
    "paidSpend"
  ].every((key) => {
    const item = value[key];
    return mustBePresent
      ? isPresent(item, isNonNegativeNumber)
      : isReadValue(item, isNonNegativeNumber);
  });
}

function isLaneRun(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.runReference === "string" &&
    typeof value.status === "string" &&
    typeof value.startedAt === "string" &&
    (value.completedAt === null || typeof value.completedAt === "string") &&
    isReadValue(value.stopReason, (item) => typeof item === "string")
  );
}

function isSourceRun(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.runReference === "string" &&
    typeof value.completedAt === "string"
  );
}

function isWindow(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    typeof value.timeZone === "string"
  );
}

function isPresent(
  value: unknown,
  validate: (item: unknown) => boolean
): boolean {
  return (
    isRecord(value) &&
    value.state === "PRESENT" &&
    validate(value.value) &&
    hasProvenance(value)
  );
}

function isReadValue(
  value: unknown,
  validate: (item: unknown) => boolean
): boolean {
  if (!isRecord(value)) return false;
  if (value.state === "MISSING") {
    return typeof value.reason === "string" && hasProvenance(value);
  }
  return value.state === "PRESENT" && validate(value.value) && hasProvenance(value);
}

function hasProvenance(value: Record<string, unknown>): boolean {
  return (
    Array.isArray(value.provenance) &&
    value.provenance.length > 0 &&
    value.provenance.every((item) => {
      if (!isRecord(item)) return false;
      return (
        ["CONFIG", "OBSERVED", "DERIVED", "INVARIANT"].includes(String(item.basis)) &&
        [
          "SERVER_POLICY",
          "VERTICAL_MANIFEST",
          "RESEARCH_RUN",
          "MARKET_SCORE",
          "MARKET_PROFILE",
          "COMPLIANCE_EVIDENCE",
          "AUDIT_EVENT"
        ].includes(String(item.source)) &&
        typeof item.reference === "string" &&
        (item.recordedAt === null || typeof item.recordedAt === "string")
      );
    })
  );
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isLaneKey(value: unknown): value is LaneKey {
  return typeof value === "string" && LANE_KEYS.includes(value as LaneKey);
}

function isMarketKey(value: unknown): value is (typeof MARKET_KEYS)[number] {
  return typeof value === "string" && MARKET_KEYS.includes(value as (typeof MARKET_KEYS)[number]);
}

function isComplianceCategory(
  value: unknown
): value is (typeof REQUIRED_COMPLIANCE_CATEGORIES)[number] {
  return (
    typeof value === "string" &&
    REQUIRED_COMPLIANCE_CATEGORIES.includes(
      value as (typeof REQUIRED_COMPLIANCE_CATEGORIES)[number]
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
