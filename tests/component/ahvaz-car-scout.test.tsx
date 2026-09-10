// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AhvazCarScout } from "@/components/market-scout/ahvaz-car-scout";
import { AHVAZ_CAR_SCOUT_VERSION, type AhvazCarScoutSnapshot } from "@/modules/growth/application/ahvaz-car-scout-contracts";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const feed = (snapshot: AhvazCarScoutSnapshot | null = null) => ({ contractVersion: AHVAZ_CAR_SCOUT_VERSION, persistence: "PROCESS_MEMORY", snapshot });

// Synthetic UI fixture; never exported to the app or treated as research evidence.
function snapshot(): AhvazCarScoutSnapshot {
  const observedAt = "2026-09-10T12:00:01.000Z";
  return {
    runId: "90000000-0000-4000-8000-000000000001", scope: "AHVAZ-CAR-SCOUT-1", agent: "market-scout", mode: "PUBLIC_DATA_RESEARCH_ONLY",
    status: "COMPLETED", startedAt: "2026-09-10T12:00:00.000Z", finishedAt: observedAt, requestCount: 1, sourceHttpStatus: 200, paidSpend: 0, failureCode: null,
    discovery: {
      observedAt, sourceSnapshotAt: null, elementsReturned: 2, limitReached: false,
      rejections: { INVALID_RECORD: 0, WRONG_CATEGORY: 0, OUTSIDE_BOUNDS: 0, DUPLICATE_OSM_ID: 0, OUTPUT_LIMIT: 0 },
      rows: [
        { osmType: "node", osmId: 1, observationId: "osm:node:1", name: "نمونه بدون تگ سایت", latitude: 31.32, longitude: 48.68, category: "shop=car", sourceUrl: "https://www.openstreetmap.org/node/1", observedAt, website: { state: "NOT_RECORDED", url: null, tag: null } },
        { osmType: "way", osmId: 2, observationId: "osm:way:2", name: "نمونه دارای لینک", latitude: 31.32, longitude: 48.68, category: "shop=car", sourceUrl: "https://www.openstreetmap.org/way/2", observedAt, website: { state: "RECORDED", url: "https://example.com/", tag: "website" } }
      ]
    }
  };
}

describe("Ahvaz scout visible app control", () => {
  it("only reads on mount and executes the fixed source task on an explicit click", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(feed())).mockResolvedValueOnce(response({ contractVersion: AHVAZ_CAR_SCOUT_VERSION, disposition: "CREATED", snapshot: snapshot() }));
    vi.stubGlobal("fetch", fetchImpl);
    render(<AhvazCarScout />);
    const button = await screen.findByRole("button", { name: "اجرای جست‌وجوی واقعی اهواز" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1].method).toBe("GET");
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText("نمونه بدون تگ سایت");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: "POST", headers: { "idempotency-key": "ahvaz-car-scout-1-osm-v1" }, body: '{"scope":"AHVAZ-CAR-SCOUT-1"}' });
    expect(screen.getByRole("button", { name: "اجرای این آزمون ثبت شده" })).toBeDisabled();
    const missing = screen.getByRole("region", { name: "لینک سایت در منبع ثبت نشده / نیازمند بررسی" });
    expect(within(missing).getByText("نمونه بدون تگ سایت")).toBeInTheDocument();
    expect(within(missing).queryByText("نمونه دارای لینک")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "لینک سایت در منبع ثبت شده" })).toHaveTextContent("نمونه دارای لینک");
  });

  it("clears prior results and disables execution on a failed report read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(feed(snapshot()))).mockResolvedValueOnce(new Response("", { status: 403 })));
    render(<AhvazCarScout />);
    await screen.findByText("نمونه بدون تگ سایت");
    fireEvent.click(screen.getByRole("button", { name: "تازه‌سازی گزارش" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("نمونه بدون تگ سایت")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اجرای جست‌وجوی واقعی اهواز" })).toBeDisabled();
  });

  it("fails closed for forged links or contact properties in a returned feed", async () => {
    const invalid = snapshot();
    invalid.discovery!.rows[0]!.sourceUrl = "https://attacker.example/";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(feed(invalid))));
    render(<AhvazCarScout />);
    await screen.findByRole("alert");
    expect(screen.queryByText("نمونه بدون تگ سایت")).not.toBeInTheDocument();
  });

  it("shows a source failure independently of an empty successful query", async () => {
    const failed = { ...snapshot(), status: "FAILED" as const, discovery: null, failureCode: "SOURCE_HTTP_ERROR" as const, sourceHttpStatus: 429 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(feed(failed))));
    render(<AhvazCarScout />);
    await screen.findByText(/سرویس عمومی Overpass پاسخ HTTP ناموفق داد/);
    expect(screen.queryByText("منبع هیچ رکوردی در این جست‌وجو برنگرداند")).not.toBeInTheDocument();
    expect(screen.queryByText("نمونه بدون تگ سایت")).not.toBeInTheDocument();
  });

  it("ignores aborted older tenant responses even when transport ignores abort", async () => {
    let releaseOld!: (value: Response) => void;
    const fetchImpl = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { releaseOld = resolve; })).mockResolvedValueOnce(response(feed()));
    vi.stubGlobal("fetch", fetchImpl);
    render(<StrictMode><AhvazCarScout /></StrictMode>);
    await screen.findByText("هنوز اجرا نشده؛ هیچ نتیجه‌ای از پیش بارگذاری نشده است.");
    await act(async () => releaseOld(response(feed(snapshot()))));
    expect(screen.queryByText("نمونه بدون تگ سایت")).not.toBeInTheDocument();
  });
});
