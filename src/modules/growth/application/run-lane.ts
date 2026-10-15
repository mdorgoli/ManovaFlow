import {
  evaluateComplianceGate,
  type ComplianceDecision
} from "../../compliance/domain/gate";
import type { CandidateInput } from "../domain/candidate-schema";
import type { ActorContext, LaneKey, MarketKey } from "../domain/types";
import { scoreCandidate } from "../domain/scoring";
import { scoreMarket } from "../domain/market-scoring";
import type { VerticalManifest } from "../manifests";
import type { MarketProfile } from "../markets";
import type { DraftRecord, GrowthRepository } from "./repository";
import { normalizeDomain } from "./repository";
import type { MarketScoutLanguageMetadata } from "./market-scout-contracts";

export interface MarketShortlistItem {
  marketKey: MarketKey;
  displayName: string;
  readinessScore: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceCount: number;
  explicitUnknowns: readonly string[];
  representsWholeCountry: boolean;
}

export interface CompanyShortlistItem {
  companyId: string;
  companyName: string;
  domain: string;
  marketKey: MarketKey;
  fitScore: number;
  evidenceUrl: string;
  provenance: string;
  synthetic: boolean;
  language?: MarketScoutLanguageMetadata["language"];
  direction?: MarketScoutLanguageMetadata["direction"];
  languageBasis?: MarketScoutLanguageMetadata["languageBasis"];
}

export interface CandidateRejection {
  companyName: string;
  domain: string;
  reasons: string[];
}

export interface LaneComplianceDecision {
  marketKey: MarketKey;
  status: ComplianceDecision["status"];
  missingCategories: ComplianceDecision["missingCategories"];
  unknownCategories: ComplianceDecision["unknownCategories"];
  authorizationToken: null;
}

export interface LaneReport {
  runId: string;
  laneKey: LaneKey;
  displayName: string;
  status: "COMPLETED";
  state: "RESEARCH_ONLY";
  packState: VerticalManifest["packState"];
  marketShortlist: MarketShortlistItem[];
  companyShortlist: CompanyShortlistItem[];
  rejections: CandidateRejection[];
  complianceDecisions: LaneComplianceDecision[];
  drafts: DraftRecord[];
  metrics: {
    sourceUrlsReviewed: number;
    organizationsConsidered: number;
    eligibleCompanies: number;
    deduplicatedCompanies: number;
    suppressedCompanies: number;
    draftsCreated: number;
    paidSpend: 0;
    stoppedBy:
      "INPUT_EXHAUSTED" | "DAILY_CAP" | "DIMINISHING_RETURNS" | "TIME_CAP";
  };
  outboundActions: 0;
}

export interface RunLaneInput {
  actor: ActorContext;
  batchKey: string;
  manifest: VerticalManifest;
  markets: readonly MarketProfile[];
  candidates: readonly CandidateInput[];
  repository: GrowthRepository;
  candidateLanguages?: Readonly<Record<string, MarketScoutLanguageMetadata>>;
  now?: () => Date;
  monotonicNow?: () => number;
}

export async function runLane(input: RunLaneInput): Promise<LaneReport> {
  const now = input.now ?? (() => new Date());
  const monotonicNow = input.monotonicNow ?? (() => performance.now());
  const startedAt = monotonicNow();
  let runId: string | null = null;

  try {
    const begun = await input.repository.beginRun(
      input.actor,
      input.manifest.key,
      input.batchKey
    );
    runId = begun.run.id;

    if (begun.reused && begun.run.status === "COMPLETED" && begun.run.summary) {
      return begun.run.summary as unknown as LaneReport;
    }

    await input.repository.appendAudit(input.actor, {
      eventType: begun.reused ? "RUN_RETRIED" : "RUN_STARTED",
      laneKey: input.manifest.key,
      entityId: runId,
      details: { mode: "RESEARCH_ONLY", outboundEnabled: false }
    });

    const selectedMarkets = input.markets.slice(
      0,
      input.manifest.dailyCaps.markets
    );
    const marketShortlist: MarketShortlistItem[] = [];
    const complianceDecisions: LaneComplianceDecision[] = [];

    for (const market of selectedMarkets) {
      const marketScore = scoreMarket(market.scoring, {
        signalKeys: market.readinessSignalKeys
      });
      await input.repository.saveMarketScore(input.actor, {
        runId,
        laneKey: input.manifest.key,
        marketKey: market.key,
        total: marketScore.total,
        confidence: marketScore.confidence,
        explanation: marketScore.explanation
      });
      marketShortlist.push({
        marketKey: market.key,
        displayName: market.displayName,
        readinessScore: marketScore.total,
        confidence: marketScore.confidence,
        evidenceCount: market.officialReferences.length,
        explicitUnknowns: market.explicitUnknowns,
        representsWholeCountry: market.geography.representsWholeCountry
      });

      const gate = evaluateComplianceGate(
        {
          marketKey: market.key,
          targetStage: "HUMAN_SEND",
          evidence: market.officialReferences,
          humanLegalReview: false
        },
        now()
      );
      const decisionKey =
        runId + ":" + input.manifest.key + ":" + market.key + ":HUMAN_SEND";
      const existing = await input.repository.findComplianceDecision(
        input.actor,
        decisionKey
      );
      if (!existing) {
        await input.repository.saveComplianceDecision(input.actor, {
          decisionKey,
          laneKey: input.manifest.key,
          marketKey: market.key,
          targetStage: "HUMAN_SEND",
          status: gate.status,
          authorizationToken: null,
          recordedAt: now().toISOString()
        });
      }
      complianceDecisions.push({
        marketKey: market.key,
        status: gate.status,
        missingCategories: gate.missingCategories,
        unknownCategories: gate.unknownCategories,
        authorizationToken: null
      });
    }

    marketShortlist.sort(
      (left, right) =>
        right.readinessScore - left.readinessScore ||
        left.marketKey.localeCompare(right.marketKey)
    );

    const allowedMarketKeys = new Set(
      selectedMarkets.map((market) => market.key)
    );
    const companyShortlist: CompanyShortlistItem[] = [];
    const rejections: CandidateRejection[] = [];
    const drafts: DraftRecord[] = [];
    let sourceUrlsReviewed = 0;
    let organizationsConsidered = 0;
    let deduplicatedCompanies = 0;
    let suppressedCompanies = 0;
    let lowValueStreak = 0;
    const seenLaneDomains = new Set<string>();
    let stoppedBy: LaneReport["metrics"]["stoppedBy"] = "INPUT_EXHAUSTED";

    for (const candidate of input.candidates) {
      if (
        candidate.laneKey !== input.manifest.key ||
        !allowedMarketKeys.has(candidate.marketKey)
      ) {
        continue;
      }
      if (
        sourceUrlsReviewed >= input.manifest.dailyCaps.sourceUrls ||
        organizationsConsidered >= input.manifest.dailyCaps.organizations
      ) {
        stoppedBy = "DAILY_CAP";
        break;
      }
      if (monotonicNow() - startedAt >= input.manifest.dailyCaps.elapsedMs) {
        stoppedBy = "TIME_CAP";
        break;
      }

      sourceUrlsReviewed += 1;
      organizationsConsidered += 1;

      const normalizedDomain = normalizeDomain(candidate.domain);
      if (seenLaneDomains.has(normalizedDomain)) {
        deduplicatedCompanies += 1;
        lowValueStreak += 1;
        rejections.push({
          companyName: candidate.companyName,
          domain: candidate.domain,
          reasons: ["TENANT_DEDUPLICATED"]
        });
        if (lowValueStreak >= input.manifest.dailyCaps.consecutiveLowValue) {
          stoppedBy = "DIMINISHING_RETURNS";
          break;
        }
        continue;
      }
      seenLaneDomains.add(normalizedDomain);

      if (await input.repository.isSuppressed(input.actor, candidate.domain)) {
        suppressedCompanies += 1;
        lowValueStreak += 1;
        rejections.push({
          companyName: candidate.companyName,
          domain: candidate.domain,
          reasons: ["TENANT_SUPPRESSED"]
        });
      } else {
        const saved = await input.repository.saveCompany(
          input.actor,
          candidate
        );
        if (!saved.created) deduplicatedCompanies += 1;

        const score = scoreCandidate(input.manifest.scoring, candidate);
        await input.repository.saveCompanyScore(input.actor, {
          runId,
          companyId: saved.company.id,
          laneKey: input.manifest.key,
          total: score.total,
          status: score.status,
          explanation: score.explanation
        });

        if (score.status === "ELIGIBLE") {
          lowValueStreak = 0;
          const language =
            input.candidateLanguages?.[normalizeDomain(saved.company.domain)];
          companyShortlist.push({
            companyId: saved.company.id,
            companyName: saved.company.companyName,
            domain: saved.company.domain,
            marketKey: candidate.marketKey,
            fitScore: score.total,
            evidenceUrl: saved.company.sourceUrl,
            provenance: saved.company.sourceKind,
            synthetic: saved.company.synthetic,
            ...(language ?? {})
          });

          if (drafts.length < input.manifest.dailyCaps.drafts) {
            const copy = language
              ? localizedInternalDraft({
                  companyName: saved.company.companyName,
                  evidenceUrl: saved.company.sourceUrl,
                  fitScore: score.total,
                  language: language.language,
                  manifest: input.manifest
                })
              : {
                  subject:
                    "پیش‌نویس داخلی — " +
                    input.manifest.displayName +
                    " — ارسال نشده",
                  body:
                    input.manifest.draftTemplate.replace(
                      "{company}",
                      saved.company.companyName
                    ) +
                    " شاهد: " +
                    saved.company.sourceUrl +
                    "؛ امتیاز تطابق: " +
                    score.total +
                    "/100."
                };
            const draft = await input.repository.saveDraft(input.actor, {
              runId,
              companyId: saved.company.id,
              laneKey: input.manifest.key,
              packState: input.manifest.packState,
              kind: input.manifest.draftKind,
              subject: copy.subject,
              body: copy.body,
              synthetic: saved.company.synthetic
            });
            drafts.push(draft);
          }
        } else {
          lowValueStreak += 1;
          rejections.push({
            companyName: saved.company.companyName,
            domain: saved.company.domain,
            reasons:
              score.status === "KILLED"
                ? score.killReasons
                : ["BELOW_FIT_THRESHOLD"]
          });
        }
      }

      if (lowValueStreak >= input.manifest.dailyCaps.consecutiveLowValue) {
        stoppedBy = "DIMINISHING_RETURNS";
        break;
      }
    }

    companyShortlist.sort(
      (left, right) =>
        right.fitScore - left.fitScore ||
        left.domain.localeCompare(right.domain)
    );

    const report: LaneReport = {
      runId,
      laneKey: input.manifest.key,
      displayName: input.manifest.displayName,
      status: "COMPLETED",
      state: "RESEARCH_ONLY",
      packState: input.manifest.packState,
      marketShortlist,
      companyShortlist,
      rejections,
      complianceDecisions,
      drafts,
      metrics: {
        sourceUrlsReviewed,
        organizationsConsidered,
        eligibleCompanies: companyShortlist.length,
        deduplicatedCompanies,
        suppressedCompanies,
        draftsCreated: drafts.length,
        paidSpend: 0,
        stoppedBy
      },
      outboundActions: 0
    };

    await input.repository.completeRun(
      input.actor,
      runId,
      report as unknown as Record<string, unknown>
    );
    await input.repository.appendAudit(input.actor, {
      eventType: "RUN_COMPLETED",
      laneKey: input.manifest.key,
      entityId: runId,
      details: {
        eligibleCompanies: report.metrics.eligibleCompanies,
        draftsCreated: report.metrics.draftsCreated,
        outboundActions: 0
      }
    });
    return report;
  } catch (error) {
    if (runId) {
      const message = errorMessage(error);
      await input.repository.failRun(input.actor, runId, message);
      await input.repository.appendAudit(input.actor, {
        eventType: "RUN_FAILED",
        laneKey: input.manifest.key,
        entityId: runId,
        details: { error: message }
      });
    }
    throw error;
  }
}

interface LocalizedDraftInput {
  companyName: string;
  evidenceUrl: string;
  fitScore: number;
  language: MarketScoutLanguageMetadata["language"];
  manifest: VerticalManifest;
}

function localizedInternalDraft(input: LocalizedDraftInput): {
  subject: string;
  body: string;
} {
  const backlog = input.manifest.packState === "VALIDATION_BACKLOG";
  if (input.language === "fa") {
    return {
      subject:
        "پیش‌نویس داخلی — " + input.manifest.displayName + " — ارسال نشده",
      body:
        "پیش‌نویس پژوهش محصول برای " +
        input.companyName +
        ". " +
        (backlog
          ? "محصول آماده نیست. "
          : "فقط دموی محلی، نه محصول آماده استقرار. ") +
        "ارسال نشده است. منبع: " +
        input.evidenceUrl +
        "؛ امتیاز تناسب: " +
        input.fitScore +
        "/100."
    };
  }
  if (input.language === "fr") {
    return {
      subject:
        "Brouillon interne — " + input.manifest.displayName + " — NON ENVOYÉ",
      body:
        "Brouillon interne de recherche produit pour " +
        input.companyName +
        ". " +
        (backlog ? "Le produit n’est pas prêt. " : "") +
        "NON ENVOYÉ. Preuve : " +
        input.evidenceUrl +
        " ; score d’adéquation : " +
        input.fitScore +
        "/100."
    };
  }
  if (input.language === "ar") {
    return {
      subject:
        "مسودة داخلية — " + input.manifest.displayName + " — لم يتم الإرسال",
      body:
        "مسودة بحث منتج داخلية لـ " +
        input.companyName +
        ". " +
        (backlog ? "المنتج غير جاهز. " : "") +
        "لم يتم الإرسال. الدليل: " +
        input.evidenceUrl +
        "؛ درجة الملاءمة: " +
        input.fitScore +
        "/100."
    };
  }
  return {
    subject: "Internal draft — " + input.manifest.displayName + " — NOT SENT",
    body:
      "Internal product research draft for " +
      input.companyName +
      ". " +
      (backlog ? "The product is not ready. " : "") +
      "NOT SENT. Evidence: " +
      input.evidenceUrl +
      "; fit score: " +
      input.fitScore +
      "/100."
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown lane failure";
}
