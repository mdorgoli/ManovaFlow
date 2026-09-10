import { z } from "zod";
import { WEBSITE_REVIEW_FACTS, type WebsiteReviewFact } from "./market-scout-website-review";

export const MARKETING_PIPELINE_VERSION = "manovaflow.marketing-pipeline.v1" as const;
export const QUALIFICATION_REASONS = ["RECORDED_FIT_THRESHOLD_MET", "BELOW_FIT_THRESHOLD", "RISK_RULE_BLOCKED", "SUPPRESSED_DOMAIN", "NOT_SCORED_IN_THIS_RUN", "WEBSITE_REVIEW_NOT_SUCCESSFUL", "NO_REVIEW_SIGNALS", "UNTRUSTED_INSTRUCTION_DETECTED"] as const;
export const WORKFLOW_HOLDS = ["OUTBOUND_DISABLED", "LEGAL_REVIEW_REQUIRED", "CUSTOMER_NEED_UNVERIFIED"] as const;

export function isPublicWorkflowUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash &&
      !url.port && !url.hostname.endsWith(".localhost") &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname);
  } catch { return false; }
}

const sourceUrl = z.string().max(2048).refine(isPublicWorkflowUrl);
const timestamp = z.string().max(24).refine(value => {
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
});
const reference = z.string().min(1).max(300);
const language = z.enum(["en", "fr", "ar"]);
const factList = z.array(z.enum(WEBSITE_REVIEW_FACTS)).max(WEBSITE_REVIEW_FACTS.length)
  .refine(facts => new Set(facts).size === facts.length);

export const internalPitchSchema = z.strictObject({
  language, direction: z.enum(["LTR", "RTL"]), subject: z.string().min(1).max(400),
  body: z.string().min(1).max(5000), sourceUrl, claimKeys: factList,
  outboundEnabled: z.literal(false)
});
export type InternalPitch = z.infer<typeof internalPitchSchema>;

export function createInternalPitch(domain: string, url: string, facts: WebsiteReviewFact[], locale: "en" | "fr" | "ar"): InternalPitch {
  const copy = {
    en: {
      subject: `Internal preview — ${domain} — NOT SENT`,
      body: "We are researching a ServiceFlow prototype for tracking non-emergency maintenance requests, with final assignment by a human. Would reviewing your intake workflow be useful? This is an internal proposal, not a claim about your needs, current tools or interest. Public-page keyword signals require human verification. Source: "
    },
    fr: {
      subject: `Aperçu interne — ${domain} — NON ENVOYÉ`,
      body: "Nous étudions un prototype ServiceFlow pour suivre les demandes de maintenance non urgentes, avec attribution finale par une personne. Un examen de votre parcours de demande serait-il utile ? Cette proposition interne ne présume ni vos besoins, ni vos outils, ni votre intérêt. Les indices de mots-clés publics nécessitent une vérification humaine. Source : "
    },
    ar: {
      subject: `معاينة داخلية — ${domain} — لم يتم الإرسال`,
      body: "ندرس نموذج ServiceFlow لتتبّع طلبات الصيانة غير الطارئة، مع إسناد نهائي بواسطة إنسان. هل ستكون مراجعة مسار استقبال الطلبات مفيدة؟ هذا اقتراح داخلي لا يفترض احتياجاتكم أو أدواتكم الحالية أو اهتمامكم. مؤشرات الكلمات المفتاحية العامة تحتاج إلى تحقق بشري. المصدر: "
    }
  }[locale];
  return internalPitchSchema.parse({ language: locale, direction: locale === "ar" ? "RTL" : "LTR",
    subject: copy.subject, body: copy.body + url, sourceUrl: url, claimKeys: [...facts], outboundEnabled: false });
}

// The supervisor accepts only a source-bound, reviewed template. There is no free-text
// or recipient channel that could turn an internal preview into permission to send.
export function validateInternalPitch(input: unknown, domain: string, url: string, facts: WebsiteReviewFact[]): boolean {
  const parsed = internalPitchSchema.safeParse(input);
  if (!parsed.success) return false;
  const pitch = parsed.data;
  const expected = createInternalPitch(domain, url, facts, pitch.language);
  return pitch.sourceUrl === url && pitch.direction === expected.direction &&
    pitch.subject === expected.subject && pitch.body === expected.body &&
    pitch.claimKeys.length === facts.length && pitch.claimKeys.every((fact, index) => fact === facts[index]);
}

const prospectSchema = z.strictObject({
  domain: z.string().min(3).max(253), sourceUrl, sourceReference: reference, reviewedAt: timestamp,
  prospector: z.strictObject({ status: z.literal("RECORDED"), facts: factList }),
  qualifier: z.strictObject({
    qualified: z.boolean(), status: z.enum(["QUALIFIED", "REJECTED", "NEEDS_REVIEW"]),
    score: z.number().int().min(0).max(100).nullable(), threshold: z.number().int().min(1).max(100),
    scoreReference: reference.nullable(), reasons: z.array(z.enum(QUALIFICATION_REASONS)).min(1).max(8)
  }),
  pitcher: z.strictObject({ status: z.enum(["READY_INTERNAL_ONLY", "BLOCKED"]), drafts: z.array(internalPitchSchema).max(3) }),
  supervisor: z.strictObject({ status: z.enum(["HELD_FOR_HUMAN_REVIEW", "BLOCKED"]),
    reasons: z.tuple([z.literal(WORKFLOW_HOLDS[0]), z.literal(WORKFLOW_HOLDS[1]), z.literal(WORKFLOW_HOLDS[2])]),
    outboundEnabled: z.literal(false), authorizationToken: z.null() })
}).superRefine((prospect, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "Workflow stage invariant violated" });
  if (new URL(prospect.sourceUrl).hostname.replace(/^www\./, "") !== prospect.domain) fail();
  const q = prospect.qualifier;
  if (q.qualified) {
    if (q.status !== "QUALIFIED" || q.score === null || q.score < q.threshold || q.scoreReference === null ||
      q.reasons.length !== 1 || q.reasons[0] !== "RECORDED_FIT_THRESHOLD_MET" || !prospect.prospector.facts.length ||
      prospect.pitcher.status !== "READY_INTERNAL_ONLY" || prospect.pitcher.drafts.length !== 3 ||
      prospect.supervisor.status !== "HELD_FOR_HUMAN_REVIEW") fail();
    if (prospect.pitcher.drafts.map(draft => draft.language).join(",") !== "en,fr,ar") fail();
    for (const draft of prospect.pitcher.drafts) {
      if (!validateInternalPitch(draft, prospect.domain, prospect.sourceUrl, prospect.prospector.facts)) fail();
    }
  } else if (q.status === "QUALIFIED" || q.reasons.includes("RECORDED_FIT_THRESHOLD_MET") ||
    prospect.pitcher.status !== "BLOCKED" || prospect.pitcher.drafts.length !== 0 || prospect.supervisor.status !== "BLOCKED") fail();
});

export const marketingPipelineSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("RESTRICTED"), reason: z.literal("ROLE_RESTRICTED") }),
  z.strictObject({ state: z.literal("UNAVAILABLE"), reason: z.enum(["NOT_RECORDED", "RUN_NOT_COMPLETE", "UNSUPPORTED_SCOPE"]) }),
  z.strictObject({
    state: z.literal("READY"), contractVersion: z.literal(MARKETING_PIPELINE_VERSION), engine: z.literal("DETERMINISTIC_RULES"),
    persisted: z.literal(false), runId: reference, snapshotAt: timestamp,
    reviewedSites: z.number().int().min(0).max(3), qualifiedSites: z.number().int().min(0).max(3),
    proposalCount: z.number().int().min(0).max(9), prospects: z.array(prospectSchema).max(3),
    safety: z.strictObject({ paidSpend: z.literal(0), outboundActions: z.literal(0), externalRequests: z.literal(0) })
  })
]).superRefine((pipeline, context) => {
  if (pipeline.state !== "READY") return;
  if (pipeline.reviewedSites !== pipeline.prospects.length ||
    pipeline.qualifiedSites !== pipeline.prospects.filter(prospect => prospect.qualifier.qualified).length ||
    pipeline.proposalCount !== pipeline.prospects.reduce((sum, prospect) => sum + prospect.pitcher.drafts.length, 0) ||
    new Set(pipeline.prospects.map(prospect => prospect.domain)).size !== pipeline.prospects.length) {
    context.addIssue({ code: "custom", message: "Workflow aggregate invariant violated" });
  }
});

export type MarketingPipeline = z.infer<typeof marketingPipelineSchema>;
export type MarketingProspect = Extract<MarketingPipeline, { state: "READY" }>["prospects"][number];
