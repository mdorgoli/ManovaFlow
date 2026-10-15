import type { LaneKey } from "@/modules/growth/domain/types";
import type {
  SafeAuditEntryV2,
  SafeAuditFeedReadModelV2
} from "@/modules/growth/application/dashboard-contracts";

const EVENT_LABELS: Record<SafeAuditEntryV2["eventType"], string> = {
  RUN_STARTED: "Run started",
  RUN_RETRIED: "Run retried",
  RUN_COMPLETED: "Run completed",
  RUN_FAILED: "Run failed",
  DRAFT_DECIDED_INTERNAL_ONLY: "Internal draft reviewed",
  TENANT_DOMAIN_SUPPRESSED: "Domain suppressed",
  MARKET_SCOUT_ACTIVITY_SNAPSHOT: "Activity snapshot recorded"
};

export function DashboardAudit({
  model,
  laneNames
}: {
  model: SafeAuditFeedReadModelV2;
  laneNames: Record<LaneKey, string>;
}) {
  return (
    <section
      className="analysis-panel dashboard-audit"
      aria-labelledby="recorded-operations-title"
    >
      <header className="analysis-heading">
        <div>
          <span>RECORDED EVENTS / READ ONLY</span>
          <h2 id="recorded-operations-title">Recorded operations</h2>
        </div>
        <p className="analysis-note">
          {model.totalEvents.value} events ·{" "}
          {model.integrity.state === "PRESENT"
            ? "Sequence verified"
            : "Integrity MISSING"}
        </p>
      </header>
      {model.access === "HEALTH_ONLY" ? (
        <p className="audit-notice">
          Event details are restricted for this role.
        </p>
      ) : model.entries.length === 0 ? (
        <p className="audit-notice">No recorded operations in this page.</p>
      ) : (
        <ol className="audit-events">
          {model.entries.map((event) => (
            <li key={event.sequence}>
              <span className="audit-sequence">#{event.sequence}</span>
              <time dateTime={event.occurredAt}>{event.occurredAt}</time>
              <span>
                {event.laneKey === null
                  ? "Workspace"
                  : laneNames[event.laneKey]}
              </span>
              <strong>{EVENT_LABELS[event.eventType]}</strong>
              <span
                className={`audit-result audit-result--${event.result.toLowerCase()}`}
              >
                {event.result}
              </span>
            </li>
          ))}
        </ol>
      )}
      {model.nextCursor !== null ? (
        <p className="audit-notice">
          Showing the latest {model.entries.length} of {model.totalEvents.value}{" "}
          recorded events; earlier history is not shown here.
        </p>
      ) : null}
    </section>
  );
}
