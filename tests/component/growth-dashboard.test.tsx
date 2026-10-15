// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/(default)/layout";
import { GrowthDashboard } from "@/components/growth-dashboard";
import { buildDashboardReadModel } from "@/modules/growth/application/dashboard-read-model";
import type { DashboardSnapshot } from "@/modules/growth/application/repository";

describe("GrowthDashboard Phase 2B.1", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the product document default to English and LTR", () => {
    const layout = RootLayout({ children: <div /> });

    expect(layout.props.lang).toBe("en");
    expect(layout.props.dir).toBe("ltr");
  });

  it("renders an English-only LTR safety shell with three honest lane columns", () => {
    render(<GrowthDashboard initialModel={emptyReadModel()} />);

    const main = screen.getByRole("main", {
      name: "ManovaFlow research operations dashboard"
    });
    expect(main).toHaveAttribute("dir", "ltr");

    const safety = screen.getByRole("region", { name: "Safety Context" });
    expect(within(safety).getByText("DEMO")).toBeInTheDocument();
    expect(within(safety).getByText("SYNTHETIC DATA")).toBeInTheDocument();
    expect(within(safety).getByText("RESEARCH-ONLY")).toBeInTheDocument();
    expect(within(safety).getByText("Outbound = 0")).toBeInTheDocument();
    expect(
      within(safety).getByText(
        "No messages, calls, ads, bookings, purchases, or external actions are allowed in this environment."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Research operations console")).toBeInTheDocument();
    expect(screen.getByText("Three parallel lanes")).toBeInTheDocument();
    expect(screen.getByText("No external actions")).toBeInTheDocument();
    expect(screen.getByText("2026-09-04")).toBeInTheDocument();

    const lanes = screen.getByRole("region", {
      name: "Three parallel agents"
    });
    expect(within(lanes).getAllByRole("article")).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/[\u0600-\u06ff]/u);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps Phase 1 states and missing observations explicit in English", () => {
    render(<GrowthDashboard initialModel={emptyReadModel()} />);

    const lanes = screen.getByRole("region", {
      name: "Three parallel agents"
    });
    const service = within(lanes).getByRole("article", {
      name: "ServiceFlow"
    });
    const beauty = within(lanes).getByRole("article", {
      name: "BeautyFlow"
    });
    const brief = within(lanes).getByRole("article", {
      name: "BriefFlow"
    });

    expect(within(service).getByText("Active development")).toBeInTheDocument();
    expect(
      within(beauty).getByText("Validation backlog / product not ready")
    ).toBeInTheDocument();
    expect(
      within(brief).getByText("Validation backlog / product not ready")
    ).toBeInTheDocument();
    expect(within(service).getByText("40")).toBeInTheDocument();
    expect(within(service).getAllByText("MISSING").length).toBeGreaterThan(0);
    expect(within(beauty).getAllByText("MISSING").length).toBeGreaterThan(0);
    expect(within(brief).getAllByText("MISSING").length).toBeGreaterThan(0);
  });

  it("renders every Phase 1 market ranking with explicit missing reasons and provenance", () => {
    const model = emptyReadModel();
    const serviceFrance = model.marketRanking.lanes
      .find((lane) => lane.laneKey === "serviceflow")
      ?.markets.find((market) => market.marketKey === "fr-france");
    if (!serviceFrance)
      throw new Error("Expected the ServiceFlow France market");
    serviceFrance.rank = {
      state: "PRESENT",
      value: 1,
      provenance: [marketScoreProvenance()]
    };
    serviceFrance.score = {
      state: "PRESENT",
      value: 70,
      provenance: [marketScoreProvenance()]
    };
    serviceFrance.confidence = {
      state: "PRESENT",
      value: "HIGH",
      provenance: [marketScoreProvenance()]
    };

    render(<GrowthDashboard initialModel={model} />);

    const ranking = screen.getByRole("region", { name: "Market Ranking" });
    expect(
      within(ranking).getByRole("heading", { name: "Market Ranking" })
    ).toBeInTheDocument();
    expect(
      within(ranking).getByRole("columnheader", { name: "Market" })
    ).toBeInTheDocument();
    expect(
      within(ranking).getByRole("columnheader", { name: "ServiceFlow" })
    ).toBeInTheDocument();
    expect(
      within(ranking).getByRole("columnheader", { name: "BeautyFlow" })
    ).toBeInTheDocument();
    expect(
      within(ranking).getByRole("columnheader", { name: "BriefFlow" })
    ).toBeInTheDocument();

    const france = within(ranking).getByRole("row", { name: /France/ });
    expect(within(france).getByText("#1")).toBeInTheDocument();
    expect(within(france).getByText("70")).toBeInTheDocument();
    expect(within(france).getByText("HIGH")).toBeInTheDocument();
    expect(
      within(france).getByText("OBSERVED / MARKET_SCORE")
    ).toBeInTheDocument();
    expect(within(ranking).getAllByText("MISSING").length).toBeGreaterThan(0);
    expect(
      within(ranking).getAllByText("NO_COMPLETED_RUN").length
    ).toBeGreaterThan(0);
    expect(
      within(ranking).getAllByText("DERIVED / SERVER_POLICY").length
    ).toBeGreaterThan(0);
    expect(ranking.textContent).not.toMatch(/[\u0600-\u06ff]/u);
  });

  it("renders the Phase 1 evidence matrix with provenance and Human-Send blocked", () => {
    render(<GrowthDashboard initialModel={emptyReadModel()} />);

    const matrix = screen.getByRole("region", { name: "Evidence Matrix" });
    expect(
      within(matrix).getByRole("heading", { name: "Evidence Matrix" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByText("Human-Send = BLOCKED")
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "Outreach" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "Data" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "AI disclosure" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "Contract" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "Payment" })
    ).toBeInTheDocument();
    expect(
      within(matrix).getByRole("columnheader", { name: "Sanctions / KYC" })
    ).toBeInTheDocument();
    expect(within(matrix).getAllByText("FACT").length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText("INFERENCE").length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText("UNKNOWN").length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText("BLOCKED")).toHaveLength(5);
    const iran = within(matrix).getByRole("row", { name: /Tehran/ });
    expect(within(iran).getByText("BLOCKED")).toBeInTheDocument();
    expect(within(iran).queryByText("FACT")).not.toBeInTheDocument();
    expect(
      within(matrix).getAllByText("OBSERVED / COMPLIANCE_EVIDENCE").length
    ).toBeGreaterThan(0);
    expect(matrix.textContent).not.toMatch(/[\u0600-\u06ff]/u);
  });

  it("loads only the versioned Phase 1 dashboard read model from the same-origin route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(emptyReadModel())
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GrowthDashboard initialModel={null} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the Phase 1 read model"
    );
    expect(
      await screen.findByRole("region", { name: "Safety Context" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard",
      expect.objectContaining({ cache: "no-store", method: "GET" })
    );
  });

  it("fails closed when the dashboard route returns a malformed v1 payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          contractVersion: "manovaflow.dashboard.v1",
          generatedAt: "2026-09-04T12:00:00.000Z",
          safetyContext: {},
          laneSummary: { lanes: [] },
          capUsage: { lanes: [] }
        })
      })
    );

    render(<GrowthDashboard initialModel={null} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dashboard read model is unavailable"
    );
    expect(
      screen.queryByRole("region", { name: "Safety Context" })
    ).not.toBeInTheDocument();
  });

  it("fails closed when Phase 1 analysis provenance is empty", async () => {
    const malformed = structuredClone(emptyReadModel());
    Object.assign(malformed.evidenceMatrix.markets[0]!.cells[0]!, {
      provenance: []
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(malformed)
      })
    );

    render(<GrowthDashboard initialModel={null} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dashboard read model is unavailable"
    );
    expect(
      screen.queryByRole("region", { name: "Evidence Matrix" })
    ).not.toBeInTheDocument();
  });
});

function marketScoreProvenance() {
  return {
    basis: "OBSERVED" as const,
    source: "MARKET_SCORE" as const,
    reference: "market-score:demo:fr-france",
    recordedAt: "2026-09-04T11:55:01.000Z"
  };
}

function emptyReadModel() {
  return buildDashboardReadModel({
    actor: {
      tenantId: "10000000-0000-4000-8000-000000000001",
      actorId: "20000000-0000-4000-8000-000000000001",
      role: "OWNER"
    },
    snapshot: emptySnapshot(),
    generatedAt: "2026-09-04T12:00:00.000Z",
    runtime: {
      mode: "DEMO",
      dataset: "SYNTHETIC",
      storageMode: "MEMORY_DEMO",
      outboundGateway: "DISABLED",
      outboundCredentials: "ABSENT"
    }
  });
}

function emptySnapshot(): DashboardSnapshot {
  return {
    runs: [],
    companies: [],
    companyScores: [],
    marketScores: [],
    complianceDecisions: [],
    drafts: [],
    suppressions: [],
    audit: []
  };
}
