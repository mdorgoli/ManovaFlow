import type { ComplianceCategory } from "@/modules/compliance/domain/gate";
import type {
  EvidenceCellV1,
  EvidenceMatrixReadModelV1,
  MarketRankingItemV1,
  MarketRankingReadModelV1,
  Provenance,
  ReadValue
} from "@/modules/growth/application/dashboard-contracts";
import type { LaneKey, MarketKey } from "@/modules/growth/domain/types";

const MARKET_LABELS: Record<MarketKey, string> = {
  "fr-france": "France",
  "tr-istanbul": "Istanbul / Türkiye",
  "iq-kri-erbil": "Erbil / Kurdistan Region of Iraq",
  "ae-dubai": "Dubai / United Arab Emirates",
  "ir-tehran": "Tehran / Iran — research sample"
};

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  OUTREACH: "Outreach",
  DATA: "Data",
  AI_DISCLOSURE: "AI disclosure",
  CONTRACT: "Contract",
  PAYMENT: "Payment",
  SANCTIONS_KYC: "Sanctions / KYC"
};

export function DashboardAnalysis({
  evidenceMatrix,
  laneNames,
  marketRanking
}: {
  evidenceMatrix: EvidenceMatrixReadModelV1;
  laneNames: Record<LaneKey, string>;
  marketRanking: MarketRankingReadModelV1;
}) {
  return (
    <div className="analysis-grid">
      <MarketRanking laneNames={laneNames} model={marketRanking} />
      <EvidenceMatrix model={evidenceMatrix} />
    </div>
  );
}

function MarketRanking({
  laneNames,
  model
}: {
  laneNames: Record<LaneKey, string>;
  model: MarketRankingReadModelV1;
}) {
  const marketOrder = model.lanes[0]?.markets ?? [];

  return (
    <section
      aria-labelledby="market-ranking-title"
      className="analysis-panel market-ranking-panel"
    >
      <AnalysisHeading
        id="market-ranking-title"
        label="Market Ranking"
        note="Phase 1 recorded values only"
      />
      <div
        aria-label="Scrollable Market Ranking table"
        className="analysis-table-scroll"
        tabIndex={0}
      >
        <table className="analysis-table market-ranking-table">
          <caption className="sr-only">
            Per-lane market rank, score, confidence, missing reason, and provenance
          </caption>
          <thead>
            <tr>
              <th scope="col">Market</th>
              {model.lanes.map((lane) => (
                <th key={lane.laneKey} scope="col">
                  {laneNames[lane.laneKey]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marketOrder.map((market) => (
              <tr key={market.marketKey}>
                <th className="market-label" scope="row">
                  <strong>{MARKET_LABELS[market.marketKey]}</strong>
                  <small>{market.geographicScope}</small>
                </th>
                {model.lanes.map((lane) => {
                  const laneMarket = lane.markets.find(
                    (candidate) => candidate.marketKey === market.marketKey
                  );
                  return (
                    <td key={lane.laneKey}>
                      {laneMarket ? <MarketReading market={laneMarket} /> : <MissingMarket />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MarketReading({ market }: { market: MarketRankingItemV1 }) {
  const values = [market.rank, market.score, market.confidence] as const;
  const allMissing = values.every((value) => value.state === "MISSING");

  return (
    <div className="market-reading">
      {allMissing ? (
        <>
          <strong className="analysis-missing">MISSING</strong>
          <span className="analysis-reason">
            {market.score.state === "MISSING" ? market.score.reason : "INVARIANT_UNVERIFIED"}
          </span>
        </>
      ) : (
        <div className="market-metrics">
          <MarketMetric label="Rank" prefix="#" value={market.rank} />
          <MarketMetric label="Score" value={market.score} />
          <MarketMetric label="Confidence" value={market.confidence} />
        </div>
      )}
      <ProvenanceLine provenance={market.score.provenance[0]} />
    </div>
  );
}

function MarketMetric({
  label,
  prefix = "",
  value
}: {
  label: string;
  prefix?: string;
  value: ReadValue<number | string>;
}) {
  return (
    <span aria-label={`${label}: ${value.state === "PRESENT" ? value.value : "MISSING"}`}>
      {value.state === "PRESENT" ? `${prefix}${value.value}` : "MISSING"}
    </span>
  );
}

function MissingMarket() {
  return (
    <div className="market-reading">
      <strong className="analysis-missing">MISSING</strong>
      <span className="analysis-reason">INVARIANT_UNVERIFIED</span>
    </div>
  );
}

function EvidenceMatrix({ model }: { model: EvidenceMatrixReadModelV1 }) {
  return (
    <section
      aria-labelledby="evidence-matrix-title"
      className="analysis-panel evidence-matrix-panel"
    >
      <AnalysisHeading
        id="evidence-matrix-title"
        label="Evidence Matrix"
        note={`Human-Send = ${model.markets.every((market) => market.humanSend === "BLOCKED") ? "BLOCKED" : "MISSING"}`}
        warning
      />
      <div
        aria-label="Scrollable Evidence Matrix table"
        className="analysis-table-scroll"
        tabIndex={0}
      >
        <table className="analysis-table evidence-table">
          <caption className="sr-only">
            Per-market evidence state, provenance, and blocked Human-Send status
          </caption>
          <thead>
            <tr>
              <th scope="col">Market</th>
              {model.markets[0]?.cells.map((cell) => (
                <th key={cell.category} scope="col">
                  {CATEGORY_LABELS[cell.category]}
                </th>
              ))}
              <th scope="col">Human-Send</th>
            </tr>
          </thead>
          <tbody>
            {model.markets.map((market) => (
              <tr key={market.marketKey}>
                <th className="market-label" scope="row">
                  <strong>{MARKET_LABELS[market.marketKey]}</strong>
                  <small>{market.gateStatus}</small>
                </th>
                {market.cells.map((cell) => (
                  <td className={`evidence-cell evidence-cell--${cell.state.toLowerCase()}`} key={cell.category}>
                    <EvidenceState cell={cell} />
                  </td>
                ))}
                <td className="human-send-cell">
                  <strong>{market.humanSend}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EvidenceState({ cell }: { cell: EvidenceCellV1 }) {
  return (
    <div className="evidence-reading">
      <strong>{cell.state}</strong>
      <ProvenanceLine provenance={cell.provenance[0]} />
    </div>
  );
}

function ProvenanceLine({ provenance }: { provenance: Provenance }) {
  return (
    <small
      className="provenance-line"
      title={`${provenance.reference}${provenance.recordedAt ? ` · ${provenance.recordedAt}` : ""}`}
    >
      {provenance.basis} / {provenance.source}
    </small>
  );
}

function AnalysisHeading({
  id,
  label,
  note,
  warning = false
}: {
  id: string;
  label: string;
  note: string;
  warning?: boolean;
}) {
  return (
    <header className="analysis-heading">
      <div>
        <span>READ MODEL / V1</span>
        <h2 id={id}>{label}</h2>
      </div>
      <p className={warning ? "analysis-note analysis-note--warning" : "analysis-note"}>
        {note}
      </p>
    </header>
  );
}
