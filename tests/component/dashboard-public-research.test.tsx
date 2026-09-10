// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrowthDashboard } from "@/components/growth-dashboard";
import { buildDashboardReadModel } from "@/modules/growth/application/dashboard-read-model";
import { dashboardActor, dashboardRecordedAt, publicDashboardSnapshot } from "../helpers/dashboard-public-fixture";

function model(role = dashboardActor.role) {
  return buildDashboardReadModel({
    actor: { ...dashboardActor, role }, snapshot: publicDashboardSnapshot(), generatedAt: dashboardRecordedAt,
    runtime: { mode: "DEMO", dataset: "PUBLIC_RESEARCH", storageMode: "POSTGRESQL", outboundGateway: "DISABLED", outboundCredentials: "ABSENT" }
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Existing dashboard connected to public research", () => {
  it("loads public data through GET and shows provenance, storage, recorded counts and an evidence link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => model() });
    vi.stubGlobal("fetch", fetchMock);
    render(<GrowthDashboard initialModel={null} />);
    const safety = await screen.findByRole("region", { name: "Safety Context" });
    expect(within(safety).getByText("PUBLIC-SOURCE RESEARCH")).toBeInTheDocument();
    expect(within(safety).queryByText("SYNTHETIC DATA")).not.toBeInTheDocument();
    expect(screen.getByText("POSTGRESQL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website review evidence" })).toHaveAttribute("href", "/market-scout");
    expect(screen.getByRole("link", { name: "Marketing workflow" })).toHaveAttribute("href", "/market-scout#marketing-workflow");
    expect(screen.getByText(/not confirmed customers/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Three parallel agents" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });

  it("renders recorded audit metadata and never raw payloads", () => {
    render(<GrowthDashboard initialModel={model()} />);
    const audit = screen.getByRole("region", { name: "Recorded operations" });
    expect(within(audit).getAllByRole("listitem")).toHaveLength(3);
    expect(within(audit).getByText("Activity snapshot recorded")).toBeInTheDocument();
    expect(audit.textContent).not.toMatch(/private-audit-tripwire|never-expose-token/);
    expect(screen.queryByRole("button", { name: /send|purchase|start/i })).not.toBeInTheDocument();
  });

  it("keeps viewer audit access at health only", () => {
    render(<GrowthDashboard initialModel={model("VIEWER")} />);
    const audit = screen.getByRole("region", { name: "Recorded operations" });
    expect(within(audit).getByText(/event details are restricted/i)).toBeInTheDocument();
    expect(within(audit).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it.each(["event", "provenance", "viewer", "dataset", "section-version"])("rejects an unsafe %s payload before any record is shown", async (broken) => {
    const invalid = model();
    if (broken === "event") Object.assign(invalid.safeAuditFeed.entries[0]!, { eventType: "UNRECOGNIZED" });
    if (broken === "provenance") Object.assign(invalid.safeAuditFeed.entries[0]!, { provenance: [] });
    if (broken === "viewer") invalid.safeAuditFeed.access = "HEALTH_ONLY";
    if (broken === "dataset") Object.assign(invalid.safetyContext.dataset, { value: "UNVERIFIED" });
    if (broken === "section-version") Object.assign(invalid.safetyContext, { contractVersion: "manovaflow.dashboard.safety-context.v1" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => invalid }));
    render(<GrowthDashboard initialModel={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard read model is unavailable");
    expect(screen.queryByRole("region", { name: "Recorded operations" })).not.toBeInTheDocument();
  });
});
