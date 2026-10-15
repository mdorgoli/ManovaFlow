// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityPanel } from "@/components/market-scout/activity-panel";
import { createMarketScoutActivity } from "@/modules/growth/application/market-scout-activity";
import type { MarketScoutReviewEvidenceState } from "@/modules/growth/application/market-scout-activity-read-model";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const snapshot = createMarketScoutActivity({
  runId: "synthetic-ui-test",
  status: "RUNNING",
  startedAt: "2026-09-05T10:00:00Z",
  finishedAt: null,
  snapshotAt: "2026-09-05T10:00:01Z",
  query: {
    origin: "SEED",
    countryCode: "FR",
    laneKey: "serviceflow",
    filter: "synthetic test filter"
  },
  events: [
    {
      occurredAt: "2026-09-05T10:00:01Z",
      stage: "WEBSITE_REVIEW",
      sourceUrl: "https://example.com",
      outcome: "FAILED",
      decision: "synthetic rejection",
      reason: "Synthetic response limit",
      errorCode: "WEBSITE_RESPONSE_TOO_LARGE"
    }
  ]
});
const sourceEvent = snapshot.events[0];
if (!sourceEvent) {
  throw new Error("The activity panel fixture requires a source event.");
}
const evidenceEvent = {
  ...sourceEvent,
  outcome: "SUCCEEDED" as const,
  decision: "PUBLIC_FACTS_RECORDED",
  reason: "PUBLIC_PAGE_REVIEWED",
  errorCode: null
};
const evidenceSnapshot = {
  ...snapshot,
  status: "COMPLETED" as const,
  events: [evidenceEvent]
};
const reviewEvidence: MarketScoutReviewEvidenceState = {
  state: "READY",
  bundle: {
    contractVersion: "manovaflow.market-scout.website-review-evidence.v1",
    runId: snapshot.runId,
    reviews: [
      {
        sourceUrl: evidenceEvent.sourceUrl,
        occurredAt: evidenceEvent.occurredAt,
        outcome: evidenceEvent.outcome,
        observedFacts: ["PUBLIC_SERVICE_DESCRIPTION", "PUBLIC_BOOKING_PATH"],
        potentialFit: "HUMAN_REVIEW_REQUIRED",
        unknowns: [
          "WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
          "CUSTOMER_INTEREST_UNVERIFIED"
        ],
        requestsMade: 2,
        bytesRead: 512,
        instructionLikeTextDetected: false
      }
    ],
    safety: {
      paidSpend: 0,
      apolloCredits: 0,
      messagesSent: 0,
      formsSubmitted: 0,
      contactReveals: 0,
      outboundActions: 0
    }
  }
};

describe("activity panel", () => {
  it("shows unknown status on loading failure without inventing activity", () => {
    render(<ActivityPanel snapshot={null} now={0} error />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Agent status is unknown"
    );
    expect(
      screen.queryByText("Running at last update")
    ).not.toBeInTheDocument();
  });
  it("shows empty data and idle without activity animation", () => {
    const { rerender, container } = render(
      <ActivityPanel snapshot={null} now={0} />
    );
    expect(screen.getByText("No recorded activity")).toBeInTheDocument();
    rerender(
      <ActivityPanel
        snapshot={{ ...snapshot, status: "IDLE", events: [] }}
        now={0}
      />
    );
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(container.querySelector('[class*="fresh"]')).toBeNull();
  });
  it("distinguishes seed input and stale recorded activity, including rejection evidence", () => {
    render(
      <ActivityPanel
        snapshot={snapshot}
        now={Date.parse(snapshot.snapshotAt) + 15001}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Activity may be out of date"
    );
    expect(screen.getByText("Seed list")).toBeInTheDocument();
    expect(screen.getByText("synthetic test filter")).toBeInTheDocument();
    expect(screen.getByText("Synthetic response limit")).toBeInTheDocument();
    expect(screen.getByText("WEBSITE_RESPONSE_TOO_LARGE")).toBeInTheDocument();
  });
  it("does not describe a completed historical run as stale running", () => {
    render(
      <ActivityPanel
        snapshot={{ ...snapshot, status: "COMPLETED" }}
        now={Date.parse(snapshot.snapshotAt) + 999999}
      />
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("labels historical runs without stored review detail as not recorded", () => {
    render(<ActivityPanel snapshot={snapshot} now={0} />);
    expect(
      screen.getByText(
        "Detailed website-review evidence was not recorded for this historical run."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Service-description keyword pattern")
    ).not.toBeInTheDocument();
  });
  it("shows allowlisted page signals, potential fit, unknowns and zero-action counters", () => {
    render(
      <ActivityPanel
        snapshot={evidenceSnapshot}
        now={0}
        websiteReviewEvidence={reviewEvidence}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Page signals / recorded evidence" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Service-description keyword pattern")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Booking-path keyword pattern")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Potential fit, not proven need" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Potential fit for human review; this does not prove need or customer interest."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customer interest is unverified")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Paid spend: 0 · Apollo credits: 0 · Outbound actions: 0"
      )
    ).toBeInTheDocument();
  });
  it("renders review detail without initiating a request or external navigation", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(
      <ActivityPanel
        snapshot={evidenceSnapshot}
        now={0}
        websiteReviewEvidence={reviewEvidence}
      />
    );
    expect(
      screen.getByRole("link", { name: "https://example.com" })
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("makes only source values focusable native external links", () => {
    render(
      <ActivityPanel
        snapshot={{
          ...snapshot,
          query: { ...snapshot.query, filter: "https://filter.example.com" },
          events: [
            {
              ...sourceEvent,
              decision: "https://decision.example.com",
              reason: "https://reason.example.com"
            }
          ]
        }}
        now={0}
      />
    );
    const source = screen.getByRole("link", { name: "https://example.com" });
    expect(source.tagName).toBe("A");
    expect(source).toHaveAttribute("href", "https://example.com");
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(source.tabIndex).toBe(0);
    source.focus();
    expect(source).toHaveFocus();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("https://filter.example.com")).toBeInTheDocument();
    expect(
      screen.getByText("https://decision.example.com")
    ).toBeInTheDocument();
    expect(screen.getByText("https://reason.example.com")).toBeInTheDocument();
  });
  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "data:text/plain,source",
    "https://",
    "https://bad host.example",
    "//example.com",
    "/relative/source",
    "not a URL"
  ])(
    "keeps an invalid or non-HTTPS source as readable text: %s",
    (sourceUrl) => {
      render(
        <ActivityPanel
          snapshot={{ ...snapshot, events: [{ ...sourceEvent, sourceUrl }] }}
          now={0}
        />
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(sourceUrl)).toBeInTheDocument();
    }
  );
  it("switches review detail to French and Arabic with localized labels and RTL", () => {
    render(
      <ActivityPanel
        snapshot={evidenceSnapshot}
        now={0}
        websiteReviewEvidence={reviewEvidence}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Activité Market Scout"
    );
    expect(
      screen.getByRole("heading", {
        name: "Signaux de page / éléments enregistrés"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("L’intérêt du client n’est pas vérifié")
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ar" } });
    expect(screen.getByRole("main")).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("قائمة أولية")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "إشارات الصفحة / الأدلة المسجلة" })
    ).toBeInTheDocument();
    expect(screen.getByText("اهتمام العميل غير متحقق منه")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://example.com" }).closest("bdi")
    ).not.toBeNull();
  });
});
