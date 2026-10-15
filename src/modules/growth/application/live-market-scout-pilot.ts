import type { ActorContext, LaneKey } from "../domain/types";
import { scoreCandidate } from "../domain/scoring";
import { growthManifests } from "../manifests";
import { marketProfiles } from "../markets";
import {
  marketScoutQueryFilter,
  marketScoutSampleLabel,
  OVERPASS_MARKET_SCOUT_SOURCE_INFO
} from "../infrastructure/overpass-market-scout-source";
import type { GrowthRepository } from "./repository";
import type { MarketScoutSource } from "./market-scout-contracts";
import { runMarketScout } from "./market-scout-coordinator";
import {
  createMarketScoutActivity,
  type CreateMarketScoutActivityInput
} from "./market-scout-activity";
import { createMarketScoutReviewEvidence } from "./market-scout-review-evidence";
import type {
  MarketScoutWebsiteReviewer,
  WebsiteReviewResult
} from "./market-scout-website-review";

interface LiveMarketScoutPilotInput {
  actor: ActorContext;
  batchKey: string;
  countryCode: string;
  laneKey: LaneKey;
  source: MarketScoutSource;
  websiteReviewer?: MarketScoutWebsiteReviewer;
  repository: GrowthRepository;
  now?: () => Date;
}

export async function runLiveMarketScoutPilot(
  input: LiveMarketScoutPilotInput
) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const market = Object.values(marketProfiles).find(
    (item) => item.geography.countryCode === countryCode
  );
  if (!market) throw new Error("MARKET_SCOUT_COUNTRY_NOT_CONFIGURED");
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();

  const result = await runMarketScout({
    actor: input.actor,
    batchKey: input.batchKey,
    source: input.source,
    repository: input.repository,
    concurrency: 1,
    scope: { countryCode, laneKey: input.laneKey }
  });
  const outcome = result.workerOutcomes[0];
  const accepted =
    outcome?.status === "fulfilled" ? outcome.result.acceptedCandidates : [];
  const manifest = growthManifests[input.laneKey];
  const workerErrors = result.workerOutcomes.flatMap((worker) =>
    worker.status === "rejected" ? [worker.errorCode] : []
  );
  const discoveryAt = now().toISOString();
  const reviewEntries: Array<{
    review: WebsiteReviewResult;
    occurredAt: string;
  }> = [];
  if (input.websiteReviewer) {
    for (const { candidate } of accepted) {
      const website = candidate.reportedPublicWebsiteUrl;
      if (!website) continue;
      const review = await input.websiteReviewer.review({
        sourceUrl: website,
        laneKey: input.laneKey,
        countryCode,
        budget: {
          maxRequests: 4,
          maxElapsedMs: 8_000,
          maxResponseBytes: 256_000
        }
      });
      reviewEntries.push({ review, occurredAt: now().toISOString() });
    }
  }
  const reviews = reviewEntries.map((entry) => entry.review);
  const reviewsBySource = new Map(
    reviews.map((review) => [review.sourceUrl, review] as const)
  );
  const candidates = accepted.map(
    ({ candidate, language, direction, languageBasis }) => {
      const score = scoreCandidate(manifest.scoring, candidate);
      return {
        companyName: candidate.companyName,
        domain: candidate.domain,
        detectedLanguage: language,
        direction,
        languageBasis,
        sourceUrl: candidate.sourceUrl,
        reportedPublicWebsiteUrl: candidate.reportedPublicWebsiteUrl ?? null,
        fitScore: score.total,
        discoveryScoreStatus:
          score.status === "ELIGIBLE"
            ? ("THRESHOLD_MET_NOT_QUALIFIED" as const)
            : score.status === "KILLED"
              ? ("REJECTED_BY_RISK_RULE" as const)
              : ("BELOW_DISCOVERY_THRESHOLD" as const),
        fitReason: fitReason(input.laneKey, score.total),
        productState:
          input.laneKey === "serviceflow"
            ? ("LOCAL_DEMO_NOT_PRODUCTION" as const)
            : ("RESEARCH_CONCEPT_NOT_READY" as const),
        internalDrafts: internalDrafts(candidate.companyName, input.laneKey),
        websiteReview: candidate.reportedPublicWebsiteUrl
          ? (reviewsBySource.get(candidate.reportedPublicWebsiteUrl) ?? null)
          : null
      };
    }
  );
  const finishedAt = now().toISOString();
  const selectedLane = result.research.laneResults[input.laneKey];
  const runId =
    selectedLane.status === "fulfilled"
      ? selectedLane.report.runId
      : input.batchKey;
  const events: CreateMarketScoutActivityInput["events"] = [
    {
      occurredAt: discoveryAt,
      stage: "DISCOVERY",
      sourceUrl: OVERPASS_MARKET_SCOUT_SOURCE_INFO.endpoint,
      outcome: workerErrors.length === 0 ? "SUCCEEDED" : "FAILED",
      decision:
        workerErrors.length === 0
          ? "ACCEPTED_INITIAL_DISCOVERY"
          : "NO_DISCOVERY_ACCEPTED",
      reason:
        workerErrors.length === 0
          ? "OPEN_DATA_DISCOVERY_COMPLETED"
          : "OPEN_DATA_DISCOVERY_FAILED",
      errorCode: workerErrors[0] ?? null
    },
    ...reviewEntries.map(({ review, occurredAt }) => ({
      occurredAt,
      stage: "WEBSITE_REVIEW" as const,
      sourceUrl: review.sourceUrl,
      outcome: review.outcome,
      decision:
        review.outcome === "SUCCEEDED" && review.documentedFacts.length > 0
          ? "PUBLIC_FACTS_RECORDED"
          : "NO_FACTS_RECORDED",
      reason: review.reason,
      errorCode: review.errorCode
    }))
  ];
  const activity = createMarketScoutActivity({
    runId,
    status: workerErrors.length === 0 ? "COMPLETED" : "FAILED",
    startedAt,
    finishedAt,
    snapshotAt: finishedAt,
    query: {
      origin: "SEARCH",
      countryCode,
      laneKey: input.laneKey,
      filter: marketScoutQueryFilter({
        marketKey: market.key,
        laneKey: input.laneKey
      })
    },
    events
  });
  const websiteReviewEvidence = input.websiteReviewer
    ? createMarketScoutReviewEvidence({ runId, reviews: reviewEntries })
    : null;
  await input.repository.appendAudit(input.actor, {
    eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
    laneKey: input.laneKey,
    entityId: runId,
    details: {
      activity,
      ...(websiteReviewEvidence ? { websiteReviewEvidence } : {})
    }
  });

  return {
    mode: "LIVE_OPEN_DATA_RESEARCH_ONLY" as const,
    scope: { countryCode, laneKey: input.laneKey },
    marketKey: market.key,
    sample: marketScoutSampleLabel(market.key),
    source: OVERPASS_MARKET_SCOUT_SOURCE_INFO,
    sourceStatus:
      workerErrors.length === 0 ? ("SUCCEEDED" as const) : ("FAILED" as const),
    workerErrors,
    humanSend: "BLOCKED" as const,
    candidates,
    activity,
    metrics: {
      sourceAttempts: result.workerOutcomes.length,
      sourceResponsesAccepted: result.aggregate.sourceUrlsReviewed,
      organizationsReturned: result.aggregate.organizationsReturned,
      acceptedCandidates: result.aggregate.acceptedCandidates,
      rejectedCandidates: result.aggregate.rejectedCandidates
    },
    websiteReviewMetrics: {
      attempts: reviews.length,
      requestsMade: reviews.reduce(
        (sum, review) => sum + review.requestsMade,
        0
      ),
      successfullyReviewed: reviews.filter(
        (review) => review.outcome === "SUCCEEDED"
      ).length,
      failed: reviews.filter((review) => review.outcome === "FAILED").length,
      skippedOrRejected: reviews.filter(
        (review) =>
          review.outcome === "SKIPPED" || review.outcome === "REJECTED"
      ).length,
      bytesRead: reviews.reduce((sum, review) => sum + review.bytesRead, 0)
    },
    costs: { paidSpend: 0 as const, apolloCredits: 0 as const },
    actions: {
      messagesSent: 0 as const,
      formsSubmitted: 0 as const,
      contactReveals: 0 as const,
      outboundActions: 0 as const
    }
  };
}

function fitReason(laneKey: LaneKey, score: number): string {
  const vertical =
    laneKey === "serviceflow"
      ? "a non-emergency maintenance category"
      : laneKey === "beautyflow"
        ? "a non-medical beauty category"
        : "a non-regulated creative-services category";
  return `OpenStreetMap lists the organization in ${vertical} and reports a public website. Score ${score}/100 uses only returned public tags; workflow pain, buyer authority and customer interest are unverified.`;
}

function internalDrafts(companyName: string, laneKey: LaneKey) {
  const productEn =
    laneKey === "serviceflow"
      ? "a local ServiceFlow demo that is not production-ready"
      : `${growthManifests[laneKey].displayName}, a research concept whose product is not ready`;
  const productFr =
    laneKey === "serviceflow"
      ? "une démo locale ServiceFlow qui n’est pas prête pour la production"
      : `${growthManifests[laneKey].displayName}, un concept de recherche dont le produit n’est pas prêt`;
  const productAr =
    laneKey === "serviceflow"
      ? "عرض ServiceFlow محلي غير جاهز للإنتاج"
      : `${growthManifests[laneKey].displayName}، وهو مفهوم بحثي والمنتج غير جاهز`;
  return {
    en: `INTERNAL ONLY — NOT SENT. Research hypothesis for ${companyName}: if a manual review confirms a relevant intake workflow, evaluate ${productEn}. No readiness, need or customer interest is assumed.`,
    fr: `INTERNE UNIQUEMENT — NON ENVOYÉ. Hypothèse de recherche pour ${companyName} : si une vérification humaine confirme un flux d’accueil pertinent, évaluer ${productFr}. Aucun besoin, intérêt client ou niveau de préparation n’est supposé.`,
    ar: `داخلي فقط — لم يتم الإرسال. فرضية بحثية لـ ${companyName}: إذا أكد التحقق البشري وجود مسار استقبال مناسب، يمكن تقييم ${productAr}. لا يُفترض وجود حاجة أو اهتمام من العميل أو جاهزية.`
  };
}
