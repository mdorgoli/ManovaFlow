"use client";

import { useState } from "react";
import type { MarketScoutActivitySnapshotV1 } from "@/modules/growth/application/market-scout-activity";
import type { MarketScoutReviewEvidenceState } from "@/modules/growth/application/market-scout-activity-read-model";
import type { MarketScoutReviewEvidenceV1 } from "@/modules/growth/application/market-scout-review-evidence";
import type { MarketScoutLanguage } from "@/modules/growth/application/market-scout-contracts";
import { activityCopy, evidenceLabels } from "./activity-copy";
import styles from "./activity-panel.module.css";
import type { MarketingPipeline } from "@/modules/growth/application/marketing-workflow-contract";
import { WorkflowPanel } from "./workflow-panel";

export interface ActivityPanelProps {
  snapshot: MarketScoutActivitySnapshotV1 | null;
  now: number;
  error?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  newSequences?: readonly number[];
  websiteReviewEvidence?: MarketScoutReviewEvidenceState | null;
  marketingPipeline?: MarketingPipeline | null;
}

const labels = {
  en: {
    IDLE: "Idle",
    RUNNING: "Running at last update",
    STOPPED: "Stopped",
    FAILED: "Failed",
    COMPLETED: "Completed",
    SEARCH: "Search",
    SEED: "Seed list",
    DISCOVERY: "Source discovery",
    ROBOTS_CHECK: "Robots policy check",
    WEBSITE_REVIEW: "Website review",
    SUCCEEDED: "Succeeded",
    REJECTED: "Rejected",
    SKIPPED: "Skipped",
    decision: "Decision",
    outcome: "Outcome",
    error: "Error",
    finished: "Finished",
    started: "Started",
    origin: "Discovery method"
  },
  fr: {
    IDLE: "Inactif",
    RUNNING: "En cours à la dernière mise à jour",
    STOPPED: "Arrêté",
    FAILED: "Échec",
    COMPLETED: "Terminé",
    SEARCH: "Recherche",
    SEED: "Liste initiale",
    DISCOVERY: "Découverte de sources",
    ROBOTS_CHECK: "Vérification de robots",
    WEBSITE_REVIEW: "Examen du site",
    SUCCEEDED: "Réussi",
    REJECTED: "Rejeté",
    SKIPPED: "Ignoré",
    decision: "Décision",
    outcome: "Résultat",
    error: "Erreur",
    finished: "Fin",
    started: "Début",
    origin: "Méthode de découverte"
  },
  ar: {
    IDLE: "خامل",
    RUNNING: "قيد التنفيذ عند آخر تحديث",
    STOPPED: "متوقف",
    FAILED: "فشل",
    COMPLETED: "مكتمل",
    SEARCH: "بحث",
    SEED: "قائمة أولية",
    DISCOVERY: "اكتشاف المصادر",
    ROBOTS_CHECK: "فحص سياسة الروبوتات",
    WEBSITE_REVIEW: "مراجعة الموقع",
    SUCCEEDED: "نجح",
    REJECTED: "مرفوض",
    SKIPPED: "تم التخطي",
    decision: "القرار",
    outcome: "النتيجة",
    error: "الخطأ",
    finished: "انتهى",
    started: "بدأ",
    origin: "طريقة الاكتشاف"
  }
};

export function ActivityPanel({
  snapshot,
  now,
  error = false,
  refreshing = false,
  onRefresh,
  newSequences = [],
  websiteReviewEvidence,
  marketingPipeline
}: ActivityPanelProps) {
  const [language, setLanguage] = useState<MarketScoutLanguage>("en");
  const copy = activityCopy[language];
  const text = labels[language];
  const stale =
    snapshot?.status === "RUNNING" &&
    now - Date.parse(snapshot.snapshotAt) > snapshot.staleAfterMs;
  const evidenceState = snapshot
    ? (websiteReviewEvidence ?? {
        state: "UNAVAILABLE",
        reason: "NOT_RECORDED"
      })
    : null;
  return (
    <main
      className={styles.panel}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <header className={styles.header}>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className={styles.controls}>
          <label>
            {copy.language}{" "}
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as MarketScoutLanguage)
              }
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          {onRefresh && (
            <button type="button" disabled={refreshing} onClick={onRefresh}>
              {refreshing ? copy.refreshing : copy.refresh}
            </button>
          )}
        </div>
      </header>
      {error && (
        <section role="alert" className={`${styles.notice} ${styles.error}`}>
          <h2>{copy.error}</h2>
          <p>{copy.errorDetail}</p>
        </section>
      )}
      {!snapshot && refreshing && (
        <p role="status" className={styles.notice}>
          {copy.refreshing}
        </p>
      )}
      {!snapshot && !error && !refreshing && (
        <section className={styles.notice}>
          <h2>{copy.empty}</h2>
          <p>{copy.emptyDetail}</p>
        </section>
      )}
      {snapshot && (
        <>
          <p className={styles.muted}>{copy.historical}</p>
          {stale && (
            <section role="status" className={styles.notice}>
              <h2>{copy.stale}</h2>
              <p>{copy.staleDetail}</p>
            </section>
          )}
          <section className={styles.grid} aria-label={copy.recorded}>
            <article className={styles.card}>
              <h2>
                {copy.agent}: <bdi>{snapshot.agent}</bdi>
              </h2>
              <p className={styles.badge}>{text[snapshot.status]}</p>
              <dl className={styles.fields}>
                <Field label={copy.run} value={snapshot.runId} />
                <Field label={copy.updated} value={snapshot.snapshotAt} />
                <Field
                  label={text.started}
                  value={snapshot.startedAt ?? copy.missing}
                />
                <Field
                  label={text.finished}
                  value={snapshot.finishedAt ?? copy.missing}
                />
              </dl>
            </article>
            <article className={styles.card}>
              <h2>{copy.source}</h2>
              <dl className={styles.fields}>
                <Field
                  label={copy.country}
                  value={snapshot.query.countryCode}
                />
                <Field label={copy.domain} value={snapshot.query.laneKey} />
                <Field
                  label={text.origin}
                  value={text[snapshot.query.origin]}
                />
                <Field label={copy.filters} value={snapshot.query.filter} />
              </dl>
            </article>
          </section>
          {evidenceState?.state === "UNAVAILABLE" &&
            snapshot.events.some(
              (event) => event.stage === "WEBSITE_REVIEW"
            ) && (
              <section
                className={styles.notice}
                aria-label={copy.observedEvidence}
              >
                <h2>{copy.evidenceUnavailable}</h2>
                <p>{copy.evidenceUnavailableDetail}</p>
              </section>
            )}
          {evidenceState?.state === "READY" && (
            <section className={styles.safety} aria-label={copy.safety}>
              <h2>{copy.safety}</h2>
              <p>{copy.safetyPrimary}</p>
              <p>{copy.safetySecondary}</p>
            </section>
          )}
          {marketingPipeline && (
            <WorkflowPanel pipeline={marketingPipeline} language={language} />
          )}
          <section aria-label={copy.events}>
            <h2>{copy.events}</h2>
            {snapshot.events.length === 0 ? (
              <p className={styles.muted}>{copy.emptyDetail}</p>
            ) : (
              <ol className={styles.history}>
                {snapshot.events.map((event) => (
                  <li
                    className={`${styles.event}${snapshot.status !== "IDLE" && !error && !stale && newSequences.includes(event.sequence) ? ` ${styles.fresh}` : ""}`}
                    key={`${snapshot.runId}:${event.sequence}`}
                  >
                    <header>
                      <strong>
                        <bdi>#{event.sequence}</bdi> · {text[event.stage]}
                      </strong>
                      <time dateTime={event.occurredAt} dir="ltr">
                        {event.occurredAt}
                      </time>
                    </header>
                    <dl className={styles.fields}>
                      <Field label={copy.site} value={event.sourceUrl} source />
                      <Field label={text.outcome} value={text[event.outcome]} />
                      <Field label={text.decision} value={event.decision} />
                      <Field label={copy.reason} value={event.reason} />
                      {event.errorCode && (
                        <Field label={text.error} value={event.errorCode} />
                      )}
                    </dl>
                    {event.stage === "WEBSITE_REVIEW" &&
                      evidenceState?.state === "READY" && (
                        <ReviewEvidence
                          evidence={
                            evidenceState.bundle.reviews.find(
                              (review) =>
                                review.sourceUrl === event.sourceUrl &&
                                review.occurredAt === event.occurredAt
                            ) ?? null
                          }
                          language={language}
                        />
                      )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function ReviewEvidence({
  evidence,
  language
}: {
  evidence: MarketScoutReviewEvidenceV1["reviews"][number] | null;
  language: MarketScoutLanguage;
}) {
  if (!evidence) return null;
  const copy = activityCopy[language];
  const labels = evidenceLabels[language];
  return (
    <section
      className={styles.evidenceDetail}
      aria-label={copy.observedEvidence}
    >
      <div>
        <h3>{copy.observedEvidence}</h3>
        <p className={styles.evidenceCaveat}>{copy.evidenceCaveat}</p>
        {evidence.observedFacts.length > 0 ? (
          <ul>
            {evidence.observedFacts.map((fact) => (
              <li key={fact}>{labels.facts[fact]}</li>
            ))}
          </ul>
        ) : (
          <p>{copy.noObservedEvidence}</p>
        )}
      </div>
      <div>
        <h3>{copy.potentialFit}</h3>
        <p>
          {evidence.potentialFit === "HUMAN_REVIEW_REQUIRED"
            ? copy.potentialFitReady
            : copy.potentialFitUnknown}
        </p>
      </div>
      <div>
        <h3>{copy.unknowns}</h3>
        {evidence.unknowns.length > 0 ? (
          <ul>
            {evidence.unknowns.map((unknown) => (
              <li key={unknown}>{labels.unknowns[unknown]}</li>
            ))}
          </ul>
        ) : (
          <p>{copy.noUnknowns}</p>
        )}
      </div>
      <p className={styles.evidenceMetrics}>
        {copy.reviewMetrics}: {evidence.requestsMade} HTTP ·{" "}
        {evidence.bytesRead} bytes
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  source = false
}: {
  label: string;
  value: string;
  source?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <bdi>
          {source && isHttpsUrl(value) ? (
            <a
              className={styles.sourceLink}
              href={value}
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </a>
          ) : (
            value
          )}
        </bdi>
      </dd>
    </div>
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
