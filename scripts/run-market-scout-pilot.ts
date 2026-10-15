import { LANE_KEYS, type LaneKey } from "../src/modules/growth/domain/types";
import { runLiveMarketScoutPilot } from "../src/modules/growth/application/live-market-scout-pilot";
import { InMemoryGrowthRepository } from "../src/modules/growth/infrastructure/in-memory-repository";
import { OverpassMarketScoutSource } from "../src/modules/growth/infrastructure/overpass-market-scout-source";
import { PublicWebsiteReviewer } from "../src/modules/growth/infrastructure/public-website-reviewer";

const [countryInput, laneInput, ...extra] = process.argv.slice(2);
if (!countryInput || !laneInput || extra.length > 0) {
  fail(
    "Usage: pnpm pilot:market-scout -- <FR|TR|IQ|AE|IR> <serviceflow|beautyflow|briefflow>"
  );
}
if (!(LANE_KEYS as readonly string[]).includes(laneInput)) {
  fail("Unsupported vertical: " + laneInput);
}

const countryCode = countryInput.toUpperCase();
const laneKey = laneInput as LaneKey;
const result = await runLiveMarketScoutPilot({
  actor: {
    tenantId: "10000000-0000-4000-8000-000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "OWNER"
  },
  batchKey: `live-overpass-${countryCode.toLowerCase()}-${laneKey}-v1`,
  countryCode,
  laneKey,
  source: new OverpassMarketScoutSource(),
  websiteReviewer: new PublicWebsiteReviewer(),
  repository: new InMemoryGrowthRepository()
});

process.stdout.write(JSON.stringify(result, null, 2) + "\n");

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(1);
}
