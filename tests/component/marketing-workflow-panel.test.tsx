// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "@/components/market-scout/activity-feed";
import { WorkflowPanel } from "@/components/market-scout/workflow-panel";
import { buildMarketScoutActivityFeed, MARKET_SCOUT_ACTIVITY_FEED_VERSION } from "@/modules/growth/application/market-scout-activity-read-model";
import { workflowActor, workflowFixture } from "../helpers/marketing-workflow-fixture";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); history.replaceState(null, "", "/"); });
function showWorkflow() {
  const feed = buildMarketScoutActivityFeed(workflowActor, workflowFixture());
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => feed });
  vi.stubGlobal("fetch", fetch);
  render(<ActivityFeed contractVersion={MARKET_SCOUT_ACTIVITY_FEED_VERSION} />);
  return { feed, fetch };
}

describe("recorded four-role pipeline in the actual activity screen", () => {
  it("lands on the requested workflow after asynchronous data arrives, without jumping again on language changes", async () => {
    history.replaceState(null, "", "/market-scout#marketing-workflow");
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scroll });
    showWorkflow();
    await screen.findByRole("region", { name: "Marketing workflow" });
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("keeps the same anchor for unavailable records and does not scroll without a matching fragment", () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scroll });
    render(<WorkflowPanel pipeline={{ state: "UNAVAILABLE", reason: "NOT_RECORDED" }} language="en" />);
    expect(screen.getByRole("region", { name: "Marketing workflow" })).toHaveAttribute("id", "marketing-workflow");
    expect(scroll).not.toHaveBeenCalled();
  });

  it("renders each stage and its real blocking reason using only the existing GET", async () => {
    const { fetch } = showWorkflow();
    const region = await screen.findByRole("region", { name: "Marketing workflow" });
    for (const role of ["Prospector", "Qualifier", "Pitcher", "Supervisor"]) expect(within(region).getAllByText(role).length).toBeGreaterThan(0);
    expect(within(region).getByText("Below the recorded fit threshold")).toBeInTheDocument();
    expect(within(region).getByText("Not scored in this run")).toBeInTheDocument();
    expect(within(region).getByText(/Rule-based analysis of saved records/)).toBeInTheDocument();
    expect(within(region).getByText(/Internal preview — qualified-fixture.test — NOT SENT/)).toBeInTheDocument();
    expect(within(region).queryByText(/preview — below-fixture/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/market-scout/activity", expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(screen.queryByRole("button", { name: /^send/i })).not.toBeInTheDocument();
  });

  it("switches the whole workflow and preview to French and Arabic RTL", async () => {
    showWorkflow();
    await screen.findByRole("region", { name: "Marketing workflow" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });
    expect(screen.getByRole("region", { name: "Parcours marketing" })).toBeInTheDocument();
    expect(screen.getByText(/Aperçu interne — qualified-fixture.test — NON ENVOYÉ/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ar" } });
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("region", { name: "مسار التسويق" })).toBeInTheDocument();
    expect(screen.getByText(/معاينة داخلية — qualified-fixture.test — لم يتم الإرسال/)).toBeInTheDocument();
  });

  it("clears all records if a response contains a forged send authorization", async () => {
    const feed = buildMarketScoutActivityFeed(workflowActor, workflowFixture());
    if (feed.marketingPipeline?.state !== "READY") throw new Error("Expected test pipeline");
    Object.assign(feed.marketingPipeline.prospects[0]!.supervisor, { authorizationToken: "send-now" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => feed }));
    render(<ActivityFeed contractVersion={MARKET_SCOUT_ACTIVITY_FEED_VERSION} />);
    await screen.findByRole("alert");
    expect(screen.queryByText("qualified-fixture.test")).not.toBeInTheDocument();
  });
});
