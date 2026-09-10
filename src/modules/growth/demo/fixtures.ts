import { parseCandidate, type CandidateInput } from "../domain/candidate-schema";
import type { LaneKey, MarketKey } from "../domain/types";

const markets = [
  { key: "fr-france", country: "FR", slug: "paris" },
  { key: "tr-istanbul", country: "TR", slug: "istanbul" },
  { key: "iq-kri-erbil", country: "IQ", slug: "erbil" },
  { key: "ae-dubai", country: "AE", slug: "dubai" }
] as const satisfies readonly {
  key: MarketKey;
  country: string;
  slug: string;
}[];

const laneFixture = (
  laneKey: LaneKey,
  label: string,
  signalKeys: readonly string[]
): CandidateInput[] =>
  markets.map((market) =>
    parseCandidate({
      laneKey,
      marketKey: market.key,
      companyName: label + " " + market.slug + " — DEMO FICTIONAL",
      domain: laneKey + "-" + market.slug + ".example",
      country: market.country,
      sourceUrl:
        "https://" + laneKey + "-" + market.slug + ".example/public-services",
      sourceKind: "SYNTHETIC",
      synthetic: true,
      signalKeys: [...signalKeys],
      marketSignalKeys: ["documented_icp_density", "documented_pain"],
      riskFlags: []
    })
  );

export const syntheticFixtures: Readonly<Record<LaneKey, CandidateInput[]>> =
  Object.freeze({
    serviceflow: laneFixture("serviceflow", "Atelier Service", [
      "non_emergency_maintenance",
      "team_size_visible",
      "service_area_visible",
      "recurring_request_flow",
      "visible_intake_gap",
      "supported_public_language",
      "country_research_ready"
    ]),
    beautyflow: laneFixture("beautyflow", "Studio Beauty", [
      "non_medical_beauty",
      "catalog_hours_visible",
      "multi_operator_or_location",
      "booking_path_visible",
      "supported_public_language",
      "country_research_ready"
    ]),
    briefflow: laneFixture("briefflow", "Studio Brief", [
      "non_regulated_service",
      "packaged_repeatable_service",
      "public_brief_path",
      "approval_steps_visible",
      "supported_public_language",
      "country_research_ready"
    ])
  });
