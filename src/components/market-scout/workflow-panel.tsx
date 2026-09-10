"use client";

import { useEffect, useRef } from "react";
import type { MarketingPipeline } from "@/modules/growth/application/marketing-workflow-contract";
import type { MarketScoutLanguage } from "@/modules/growth/application/market-scout-contracts";
import { workflowCopy, qualificationReasonCopy } from "./workflow-copy";
import { evidenceLabels } from "./activity-copy";
import styles from "./activity-panel.module.css";

export function WorkflowPanel({ pipeline, language }: { pipeline: MarketingPipeline; language: MarketScoutLanguage }) {
  const section = useRef<HTMLElement>(null);
  const landed = useRef(false);
  useEffect(() => {
    // The target is inserted after GET completes, later than native fragment navigation.
    if (!landed.current && window.location.hash === "#marketing-workflow") {
      section.current?.scrollIntoView({ block: "start", behavior: "auto" });
      landed.current = true;
    }
  }, []);
  const copy = workflowCopy[language];
  if (pipeline.state !== "READY") return <section id="marketing-workflow" ref={section} className={styles.notice} aria-label={copy.title}>
    <h2>{copy.title}</h2><p>{pipeline.state === "RESTRICTED" ? copy.restricted :
      pipeline.reason === "NOT_RECORDED" ? copy.notRecorded : pipeline.reason === "RUN_NOT_COMPLETE" ? copy.incomplete : copy.unsupported}</p>
  </section>;
  const steps = [[copy.prospector, copy.collect], [copy.qualifier, copy.qualify], [copy.pitcher, copy.pitch], [copy.supervisor, copy.supervise]];
  return <section id="marketing-workflow" ref={section} className={styles.workflow} aria-label={copy.title}>
    <h2>{copy.title}</h2><p className={styles.muted}>{copy.description}</p>
    <ol className={styles.workflowSteps}>{steps.map(([name, detail], index) => <li key={index}><span aria-hidden="true">0{index + 1}</span><strong>{name}</strong><p>{detail}</p></li>)}</ol>
    <dl className={styles.workflowCounts}>
      {[[copy.reviewed, pipeline.reviewedSites], [copy.qualified, pipeline.qualifiedSites], [copy.proposals, pipeline.proposalCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <p className={styles.muted}>{copy.fitCaveat}</p>
    <div className={styles.workflowProspects}>{pipeline.prospects.map(prospect => {
      const draft = prospect.pitcher.drafts.find(item => item.language === language);
      return <article className={styles.card} key={prospect.sourceReference}>
        <h3><bdi>{prospect.domain}</bdi></h3>
        <a className={styles.sourceLink} href={prospect.sourceUrl} target="_blank" rel="noopener noreferrer">{copy.source}</a>
        <div className={styles.workflowStage}><h4>{copy.prospector}</h4><p>{copy.recorded}</p>
          <ul>{prospect.prospector.facts.map(fact => <li key={fact}>{evidenceLabels[language].facts[fact]}</li>)}</ul>
        </div>
        <div className={styles.workflowStage}><h4>{copy.qualifier}</h4>
          <p>{copy.score}: <bdi>{prospect.qualifier.score ?? copy.missing} / {prospect.qualifier.threshold}</bdi></p>
          <ul>{prospect.qualifier.reasons.map(reason => <li key={reason}>{qualificationReasonCopy[language][reason]}</li>)}</ul>
          {prospect.qualifier.scoreReference && <small>{copy.reference}: <bdi>{prospect.qualifier.scoreReference}</bdi></small>}
        </div>
        <div className={styles.workflowStage}><h4>{copy.pitcher}</h4>
          {draft ? <details className={styles.workflowDraft}><summary>{draft.subject}</summary><p lang={draft.language} dir={draft.direction === "RTL" ? "rtl" : "ltr"}>{draft.body}</p></details> : <p className={styles.workflowBlocked}>{copy.noDraft}</p>}
        </div>
        <div className={styles.workflowStage}><h4>{copy.supervisor}</h4><p className={styles.workflowBlocked}>{prospect.supervisor.status === "HELD_FOR_HUMAN_REVIEW" ? copy.held : copy.blocked}</p><p>{copy.holds}</p></div>
      </article>;
    })}</div>
  </section>;
}
