"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./serviceflow-demo.module.css";
import type {
  ServiceFlowCase,
  ServiceFlowEvent,
  ServiceFlowSnapshot,
  ServiceRequestState
} from "@/modules/serviceflow";

type Locale = "en" | "fr" | "ar";
type BusyAction =
  | "RESET"
  | "APPROVE"
  | "START"
  | "BLOCK"
  | "RESUME"
  | "ATTACH_EVIDENCE"
  | "COMPLETE"
  | "CLOSE";
type LoadState = "loading" | "ready" | "error";
type NoticeKey = "actionError" | "actionApplied" | "resetApplied" | "reasonRequired";

export interface ServiceFlowDemoProps {
  initialSnapshot?: ServiceFlowSnapshot | null;
}

const COPY = {
  en: {
    demoBanner: "DEMO · SYNTHETIC DATA · NO OUTBOUND",
    localOnly: "Local only",
    eyebrow: "Local service operations",
    title: "ServiceFlow operations demo",
    subtitle: "A guarded request-to-close workflow with human approval and a complete audit trail.",
    reset: "Reset demo",
    resetting: "Resetting…",
    queue: "Work queue",
    queueHint: "Two fixed synthetic requests",
    standardTitle: "Plumbing leak request",
    hazardTitle: "Possible emergency — gas leak",
    requestDetails: "Request details",
    policyChecks: "Policy checks",
    proposal: "Recommended technician",
    assignment: "Assigned technician",
    recommendationOnly: "Recommendation only — no assignment exists",
    assignmentConfirmed: "Human-approved assignment",
    safetyLock: "Safety lock",
    safetyMessage: "This request cannot be assigned, started, completed, or closed.",
    safetyLocked: "Safety locked",
    reasonLabel: "Human reason",
    reasonPlaceholder: "DEMO: describe the human decision…",
    reasonHelp: "Every state-changing decision must begin with DEMO: and is written to the audit trail.",
    reasonRequired: "Enter a synthetic reason beginning with DEMO: before continuing.",
    approve: "Approve proposal",
    start: "Start work",
    pause: "Pause work",
    resume: "Resume work",
    addEvidence: "Add demo evidence",
    complete: "Complete request",
    close: "Close request",
    closed: "This request is closed with synthetic evidence.",
    noAction: "No action is available for this state.",
    evidence: "Completion evidence",
    noEvidence: "No completion evidence has been attached.",
    internalFixture: "Internal synthetic fixture",
    timeline: "Audit timeline",
    timelineHint: "Actor, time, transition, and reason",
    noEvents: "No events recorded yet.",
    casesMetric: "Cases",
    safetyMetric: "Safety holds",
    activeMetric: "Active work",
    closedMetric: "Closed with evidence",
    eventsMetric: "Audit events",
    service: "Service",
    area: "Service area",
    requestedTime: "Requested time",
    safety: "Safety",
    status: "Status",
    revision: "Revision",
    loading: "Loading the tenant-scoped ServiceFlow snapshot…",
    loadError: "The ServiceFlow demo could not load. No workflow state was changed.",
    actionError: "The command was rejected. The current workflow state was preserved.",
    actionApplied: "Command applied and snapshot refreshed.",
    resetApplied: "The deterministic two-case demo baseline was restored.",
    tryAgain: "Try again",
    empty: "No demo cases exist yet. Use Reset demo to create the deterministic baseline.",
    policy: {
      completeness: "Complete request",
      service: "Supported service",
      serviceArea: "Supported area",
      supportedHours: "Supported hours",
      safety: "Safety assessment"
    },
    states: {
      NEW: "New",
      NEEDS_INFO: "Needs information",
      REVIEW: "In review",
      BLOCKED: "Blocked",
      APPROVED: "Approved",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In progress",
      COMPLETED: "Completed",
      CLOSED: "Closed"
    },
    events: {
      REQUEST_CREATED: "Request created",
      REQUEST_EVALUATED: "Policy evaluated",
      REQUEST_REEVALUATED: "Request re-evaluated",
      PROPOSAL_APPROVED: "Proposal approved",
      ASSIGNMENT_CREATED: "Assignment created",
      APPROVAL_REJECTED: "Approval rejected",
      REQUEST_STARTED: "Work started",
      REQUEST_BLOCKED: "Work paused",
      REQUEST_RESUMED: "Work resumed",
      COMPLETION_EVIDENCE_ATTACHED: "Evidence attached",
      REQUEST_COMPLETED: "Request completed",
      REQUEST_CLOSED: "Request closed",
      LIFECYCLE_COMMAND_REJECTED: "Command rejected",
      DEMO_TENANT_RESET: "Demo reset"
    }
  },
  fr: {
    demoBanner: "DÉMO · DONNÉES SYNTHÉTIQUES · AUCUNE SORTIE",
    localOnly: "Local uniquement",
    eyebrow: "Opérations de service locales",
    title: "Démo des opérations ServiceFlow",
    subtitle: "Un parcours protégé de la demande à la clôture, avec validation humaine et audit complet.",
    reset: "Réinitialiser la démo",
    resetting: "Réinitialisation…",
    queue: "File de travail",
    queueHint: "Deux demandes synthétiques fixes",
    standardTitle: "Demande de fuite de plomberie",
    hazardTitle: "Urgence possible — fuite de gaz",
    requestDetails: "Détails de la demande",
    policyChecks: "Contrôles de politique",
    proposal: "Technicien recommandé",
    assignment: "Technicien affecté",
    recommendationOnly: "Recommandation uniquement — aucune affectation",
    assignmentConfirmed: "Affectation validée par un humain",
    safetyLock: "Verrou de sécurité",
    safetyMessage: "Cette demande ne peut être ni affectée, ni démarrée, ni terminée, ni clôturée.",
    safetyLocked: "Verrouillée pour sécurité",
    reasonLabel: "Motif humain",
    reasonPlaceholder: "DEMO: décrivez la décision humaine…",
    reasonHelp: "Toute décision modifiant l’état doit commencer par DEMO: et est inscrite dans l’audit.",
    reasonRequired: "Saisissez un motif synthétique commençant par DEMO: avant de continuer.",
    approve: "Valider la proposition",
    start: "Démarrer le travail",
    pause: "Suspendre le travail",
    resume: "Reprendre le travail",
    addEvidence: "Ajouter une preuve démo",
    complete: "Terminer la demande",
    close: "Clôturer la demande",
    closed: "Cette demande est clôturée avec une preuve synthétique.",
    noAction: "Aucune action n’est disponible pour cet état.",
    evidence: "Preuve d’achèvement",
    noEvidence: "Aucune preuve d’achèvement n’a été jointe.",
    internalFixture: "Fixture synthétique interne",
    timeline: "Historique d’audit",
    timelineHint: "Acteur, heure, transition et motif",
    noEvents: "Aucun événement enregistré.",
    casesMetric: "Demandes",
    safetyMetric: "Blocages sécurité",
    activeMetric: "Travail actif",
    closedMetric: "Clôturées avec preuve",
    eventsMetric: "Événements d’audit",
    service: "Service",
    area: "Zone de service",
    requestedTime: "Heure demandée",
    safety: "Sécurité",
    status: "État",
    revision: "Révision",
    loading: "Chargement du snapshot ServiceFlow du tenant…",
    loadError: "La démo ServiceFlow n’a pas pu être chargée. Aucun état n’a été modifié.",
    actionError: "La commande a été refusée. L’état actuel a été conservé.",
    actionApplied: "Commande appliquée et snapshot actualisé.",
    resetApplied: "La base déterministe de deux demandes a été restaurée.",
    tryAgain: "Réessayer",
    empty: "Aucune demande de démo. Réinitialisez la démo pour créer la base déterministe.",
    policy: {
      completeness: "Demande complète",
      service: "Service pris en charge",
      serviceArea: "Zone prise en charge",
      supportedHours: "Horaires pris en charge",
      safety: "Évaluation de sécurité"
    },
    states: {
      NEW: "Nouvelle",
      NEEDS_INFO: "Informations requises",
      REVIEW: "En révision",
      BLOCKED: "Bloquée",
      APPROVED: "Validée",
      ASSIGNED: "Affectée",
      IN_PROGRESS: "En cours",
      COMPLETED: "Terminée",
      CLOSED: "Clôturée"
    },
    events: {
      REQUEST_CREATED: "Demande créée",
      REQUEST_EVALUATED: "Politique évaluée",
      REQUEST_REEVALUATED: "Demande réévaluée",
      PROPOSAL_APPROVED: "Proposition validée",
      ASSIGNMENT_CREATED: "Affectation créée",
      APPROVAL_REJECTED: "Validation refusée",
      REQUEST_STARTED: "Travail démarré",
      REQUEST_BLOCKED: "Travail suspendu",
      REQUEST_RESUMED: "Travail repris",
      COMPLETION_EVIDENCE_ATTACHED: "Preuve jointe",
      REQUEST_COMPLETED: "Demande terminée",
      REQUEST_CLOSED: "Demande clôturée",
      LIFECYCLE_COMMAND_REJECTED: "Commande refusée",
      DEMO_TENANT_RESET: "Démo réinitialisée"
    }
  },
  ar: {
    demoBanner: "عرض تجريبي · بيانات اصطناعية · دون إجراءات خارجية",
    localOnly: "محلي فقط",
    eyebrow: "عمليات خدمة محلية",
    title: "عرض عمليات ServiceFlow",
    subtitle: "مسار محمي من الطلب إلى الإغلاق مع موافقة بشرية وسجل تدقيق كامل.",
    reset: "إعادة ضبط العرض",
    resetting: "جارٍ إعادة الضبط…",
    queue: "قائمة العمل",
    queueHint: "طلبان اصطناعيان ثابتان",
    standardTitle: "طلب إصلاح تسرّب مياه",
    hazardTitle: "حالة طارئة محتملة — تسرّب غاز",
    requestDetails: "تفاصيل الطلب",
    policyChecks: "فحوص السياسة",
    proposal: "الفني المقترح",
    assignment: "الفني المعيّن",
    recommendationOnly: "اقتراح فقط — لم يتم إنشاء تعيين",
    assignmentConfirmed: "تعيين وافق عليه إنسان",
    safetyLock: "قفل السلامة",
    safetyMessage: "لا يمكن تعيين هذا الطلب أو بدءه أو إكماله أو إغلاقه.",
    safetyLocked: "مقفل للسلامة",
    reasonLabel: "السبب البشري",
    reasonPlaceholder: "DEMO: صِف القرار البشري…",
    reasonHelp: "يجب أن يبدأ كل قرار يغيّر الحالة بـ DEMO: ويُسجل في سجل التدقيق.",
    reasonRequired: "أدخل سبباً اصطناعياً يبدأ بـ DEMO: قبل المتابعة.",
    approve: "اعتماد الاقتراح",
    start: "بدء العمل",
    pause: "إيقاف العمل مؤقتاً",
    resume: "متابعة العمل",
    addEvidence: "إضافة دليل تجريبي",
    complete: "إكمال الطلب",
    close: "إغلاق الطلب",
    closed: "أُغلق هذا الطلب مع دليل اصطناعي.",
    noAction: "لا يوجد إجراء متاح لهذه الحالة.",
    evidence: "دليل الإنجاز",
    noEvidence: "لم تتم إضافة دليل إنجاز.",
    internalFixture: "عنصر اصطناعي داخلي",
    timeline: "سجل التدقيق",
    timelineHint: "المنفذ والوقت والانتقال والسبب",
    noEvents: "لا توجد أحداث مسجلة.",
    casesMetric: "الطلبات",
    safetyMetric: "حالات حظر السلامة",
    activeMetric: "العمل النشط",
    closedMetric: "مغلقة مع دليل",
    eventsMetric: "أحداث التدقيق",
    service: "الخدمة",
    area: "منطقة الخدمة",
    requestedTime: "الوقت المطلوب",
    safety: "السلامة",
    status: "الحالة",
    revision: "المراجعة",
    loading: "جارٍ تحميل لقطة ServiceFlow الخاصة بالمستأجر…",
    loadError: "تعذر تحميل عرض ServiceFlow. لم تتغير أي حالة عمل.",
    actionError: "رُفض الأمر وحُفظت حالة سير العمل الحالية.",
    actionApplied: "طُبق الأمر وتم تحديث اللقطة.",
    resetApplied: "تمت استعادة الحالة الأساسية الحتمية ذات الطلبين.",
    tryAgain: "المحاولة مجدداً",
    empty: "لا توجد طلبات تجريبية. استخدم إعادة الضبط لإنشاء الحالة الأساسية.",
    policy: {
      completeness: "اكتمال الطلب",
      service: "الخدمة مدعومة",
      serviceArea: "المنطقة مدعومة",
      supportedHours: "الساعات مدعومة",
      safety: "تقييم السلامة"
    },
    states: {
      NEW: "جديد",
      NEEDS_INFO: "بحاجة إلى معلومات",
      REVIEW: "قيد المراجعة",
      BLOCKED: "محظور",
      APPROVED: "تمت الموافقة",
      ASSIGNED: "تم التعيين",
      IN_PROGRESS: "قيد التنفيذ",
      COMPLETED: "مكتمل",
      CLOSED: "مغلق"
    },
    events: {
      REQUEST_CREATED: "تم إنشاء الطلب",
      REQUEST_EVALUATED: "تم تقييم السياسة",
      REQUEST_REEVALUATED: "أعيد تقييم الطلب",
      PROPOSAL_APPROVED: "تم اعتماد الاقتراح",
      ASSIGNMENT_CREATED: "تم إنشاء التعيين",
      APPROVAL_REJECTED: "رُفضت الموافقة",
      REQUEST_STARTED: "بدأ العمل",
      REQUEST_BLOCKED: "توقف العمل مؤقتاً",
      REQUEST_RESUMED: "استؤنف العمل",
      COMPLETION_EVIDENCE_ATTACHED: "تمت إضافة الدليل",
      REQUEST_COMPLETED: "اكتمل الطلب",
      REQUEST_CLOSED: "أُغلق الطلب",
      LIFECYCLE_COMMAND_REJECTED: "رُفض الأمر",
      DEMO_TENANT_RESET: "أعيد ضبط العرض"
    }
  }
} as const;

const LOCALES: readonly { key: Locale; label: string }[] = [
  { key: "en", label: "English" },
  { key: "fr", label: "Français" },
  { key: "ar", label: "العربية" }
];

export function ServiceFlowDemo({ initialSnapshot = null }: ServiceFlowDemoProps) {
  const [locale, setLocale] = useState<Locale>("en");
  const [snapshot, setSnapshot] = useState<ServiceFlowSnapshot | null>(initialSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSnapshot?.cases[0]?.request.id ?? null
  );
  const [loadState, setLoadState] = useState<LoadState>(initialSnapshot ? "ready" : "loading");
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; key: NoticeKey } | null>(null);
  const copy = COPY[locale];
  const direction = locale === "ar" ? "rtl" : "ltr";

  const loadSnapshot = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/serviceflow", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      ...(signal ? { signal } : {})
    });
    const payload: unknown = await response.json();
    if (!response.ok || !isServiceFlowSnapshot(payload)) {
      throw new Error("ServiceFlow snapshot unavailable");
    }
    setSnapshot(payload);
    setSelectedId((current) =>
      payload.cases.some((item) => item.request.id === current)
        ? current
        : payload.cases[0]?.request.id ?? null
    );
    setLoadState("ready");
  }, []);

  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    const task = window.setTimeout(() => {
      loadSnapshot(controller.signal).catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    }, 0);
    return () => {
      window.clearTimeout(task);
      controller.abort();
    };
  }, [initialSnapshot, loadSnapshot]);

  const currentCase = snapshot?.cases.find((item) => item.request.id === selectedId) ?? null;
  const metrics = useMemo(() => buildMetrics(snapshot), [snapshot]);

  async function resetDemo(): Promise<void> {
    setBusy("RESET");
    setNotice(null);
    try {
      const payload = await mutationRequest("/api/serviceflow/reset", {});
      if (!isServiceFlowSnapshot(payload)) throw new Error("Invalid reset snapshot");
      setSnapshot(payload);
      setSelectedId(payload.cases[0]?.request.id ?? null);
      setReason("");
      setLoadState("ready");
      setNotice({ kind: "success", key: "resetApplied" });
    } catch {
      setNotice({ kind: "error", key: "actionError" });
    } finally {
      setBusy(null);
    }
  }

  async function execute(action: Exclude<BusyAction, "RESET">): Promise<void> {
    if (!currentCase) return;
    const needsReason = action !== "ATTACH_EVIDENCE";
    const normalizedReason = reason.trim();
    if (needsReason && !normalizedReason.startsWith("DEMO:")) {
      setNotice({ kind: "error", key: "reasonRequired" });
      return;
    }
    const body = commandBody(action, currentCase, normalizedReason);
    if (!body) return;
    setBusy(action);
    setNotice(null);
    try {
      await mutationRequest(
        `/api/serviceflow/requests/${encodeURIComponent(currentCase.request.id)}/commands`,
        body
      );
      await loadSnapshot();
      setReason("");
      setNotice({ kind: "success", key: "actionApplied" });
    } catch {
      setNotice({ kind: "error", key: "actionError" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      className={styles.shell}
      data-testid="serviceflow-demo"
      dir={direction}
      lang={locale}
    >
      <div className={styles.demoBar}>
        <span>{copy.demoBanner}</span>
        <span className={styles.liveDot}>{copy.localOnly}</span>
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.localeSwitch} aria-label="Language">
            {LOCALES.map((item) => (
              <button
                aria-pressed={locale === item.key}
                className={locale === item.key ? styles.localeActive : undefined}
                key={item.key}
                onClick={() => setLocale(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className={styles.resetButton}
            disabled={busy !== null}
            onClick={() => void resetDemo()}
            type="button"
            aria-busy={busy === "RESET"}
          >
            {busy === "RESET" ? copy.resetting : copy.reset}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"}>
          {copy[notice.key]}
        </div>
      ) : null}

      {loadState === "loading" ? <StatusCard message={copy.loading} /> : null}
      {loadState === "error" ? (
        <StatusCard alert message={copy.loadError}>
          <button
            className={styles.primaryButton}
            onClick={() => {
              setLoadState("loading");
              loadSnapshot().catch(() => setLoadState("error"));
            }}
            type="button"
          >
            {copy.tryAgain}
          </button>
        </StatusCard>
      ) : null}

      {loadState === "ready" && snapshot ? (
        <>
          <section className={styles.metrics} aria-label="Demo metrics">
            <Metric label={copy.casesMetric} value={metrics.cases} />
            <Metric label={copy.safetyMetric} tone="danger" value={metrics.safety} />
            <Metric label={copy.activeMetric} tone="accent" value={metrics.active} />
            <Metric label={copy.closedMetric} tone="success" value={metrics.closed} />
            <Metric label={copy.eventsMetric} value={metrics.events} />
          </section>

          {snapshot.cases.length === 0 ? (
            <StatusCard message={copy.empty} />
          ) : (
            <section className={styles.workspace}>
              <aside className={styles.queue} aria-labelledby="serviceflow-queue-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="serviceflow-queue-title">{copy.queue}</h2>
                    <p>{copy.queueHint}</p>
                  </div>
                  <span>{snapshot.cases.length}</span>
                </div>
                <div className={styles.caseList}>
                  {snapshot.cases.map((item, index) => {
                    const title = caseTitle(item, copy, index);
                    const safetyLocked = isSafetyLocked(item);
                    return (
                      <button
                        aria-label={`${title} — ${copy.states[item.request.state]}`}
                        aria-pressed={selectedId === item.request.id}
                        className={`${styles.caseButton} ${selectedId === item.request.id ? styles.caseSelected : ""} ${safetyLocked ? styles.caseDanger : ""}`}
                        key={item.request.id}
                        onClick={() => {
                          setSelectedId(item.request.id);
                          setNotice(null);
                          setReason("");
                        }}
                        type="button"
                      >
                        <span className={styles.caseIndex}>0{index + 1}</span>
                        <span className={styles.caseCopy}>
                          <strong>{title}</strong>
                          <small>{item.request.input.address}</small>
                        </span>
                        <StateBadge copy={copy} state={item.request.state} />
                      </button>
                    );
                  })}
                </div>
              </aside>

              {currentCase ? (
                <CaseWorkspace
                  busy={busy}
                  copy={copy}
                  currentCase={currentCase}
                  locale={locale}
                  onAction={(action) => void execute(action)}
                  onReasonChange={setReason}
                  reason={reason}
                  snapshot={snapshot}
                />
              ) : null}
            </section>
          )}

          <AuditTimeline copy={copy} locale={locale} snapshot={snapshot} />
        </>
      ) : null}
    </main>
  );
}

function CaseWorkspace({
  busy,
  copy,
  currentCase,
  locale,
  onAction,
  onReasonChange,
  reason,
  snapshot
}: {
  busy: BusyAction | null;
  copy: (typeof COPY)[Locale];
  currentCase: ServiceFlowCase;
  locale: Locale;
  onAction: (action: Exclude<BusyAction, "RESET">) => void;
  onReasonChange: (value: string) => void;
  reason: string;
  snapshot: ServiceFlowSnapshot;
}) {
  const { request, evaluation } = currentCase;
  const locked = isSafetyLocked(currentCase);
  const assignment = snapshot.assignments.find((item) => item.requestId === request.id) ?? null;
  const evidence = snapshot.completionEvidence.filter((item) => item.requestId === request.id);
  const title = caseTitle(currentCase, copy, snapshot.cases.indexOf(currentCase));

  return (
    <article className={styles.caseWorkspace} aria-labelledby="selected-case-title">
      <header className={styles.caseHeader}>
        <div>
          <span className={styles.requestId}>{request.id}</span>
          <h2 id="selected-case-title">{title}</h2>
        </div>
        <StateBadge copy={copy} state={request.state} />
      </header>

      {locked ? (
        <section className={styles.safetyPanel}>
          <div className={styles.safetyIcon} aria-hidden="true">!</div>
          <div>
            <h2>{copy.safetyLock}</h2>
            <p>{copy.safetyMessage}</p>
            <code>{evaluation.blockReason}</code>
          </div>
          <button disabled type="button">{copy.safetyLocked}</button>
        </section>
      ) : null}

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <PanelTitle>{copy.requestDetails}</PanelTitle>
          <dl className={styles.detailList}>
            <Detail label={copy.service} value={humanizeCode(request.input.service)} />
            <Detail label={copy.area} value={humanizeCode(request.input.address)} />
            <Detail label={copy.requestedTime} value={`${String(request.input.requestedHour).padStart(2, "0")}:00`} />
            <Detail label={copy.safety} value={locked ? evaluation.blockReason! : request.input.safetyAssessment} />
            <Detail label={copy.status} value={copy.states[request.state]} />
            <Detail label={copy.revision} value={String(request.revision)} />
          </dl>
          <p className={styles.description}>{request.input.description}</p>
        </section>

        <section className={styles.panel}>
          <PanelTitle>{copy.policyChecks}</PanelTitle>
          <ul className={styles.checkList}>
            {(Object.keys(evaluation.checks) as (keyof typeof evaluation.checks)[]).map((key) => (
              <li key={key}>
                <span>{copy.policy[key]}</span>
                <strong className={evaluation.checks[key] === "PASS" ? styles.pass : evaluation.checks[key] === "FAIL" ? styles.fail : styles.neutral}>
                  {evaluation.checks[key]}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.assignmentGrid}>
        <section className={styles.proposalCard}>
          <span className={styles.cardLabel}>{copy.proposal}</span>
          {evaluation.proposal ? (
            <>
              <h3>{evaluation.proposal.technicianLabel}</h3>
              <p>{evaluation.proposal.explanation}</p>
              <code>{evaluation.proposal.ruleVersion}</code>
            </>
          ) : (
            <p>{copy.noAction}</p>
          )}
        </section>
        <section className={assignment ? styles.assignmentCard : styles.emptyAssignmentCard}>
          <span className={styles.cardLabel}>{copy.assignment}</span>
          {assignment ? (
            <>
              <h3>{assignment.technicianId}</h3>
              <p>{copy.assignmentConfirmed}</p>
              <code>{assignment.id}</code>
            </>
          ) : (
            <p>{copy.recommendationOnly}</p>
          )}
        </section>
      </div>

      {!locked ? (
        <section className={styles.actionPanel}>
          <div className={styles.reasonField}>
            <label htmlFor="serviceflow-human-reason">{copy.reasonLabel}</label>
            <input
              autoComplete="off"
              id="serviceflow-human-reason"
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              value={reason}
              aria-describedby="serviceflow-human-reason-help"
              aria-invalid={reason.length > 0 && !reason.startsWith("DEMO:")}
            />
            <small id="serviceflow-human-reason-help">{copy.reasonHelp}</small>
          </div>
          <ActionButtons
            busy={busy}
            copy={copy}
            evidenceCount={evidence.length}
            onAction={onAction}
            state={request.state}
          />
        </section>
      ) : null}

      <section className={styles.evidencePanel}>
        <PanelTitle>{copy.evidence}</PanelTitle>
        {evidence.length === 0 ? (
          <p className={styles.emptyText}>{copy.noEvidence}</p>
        ) : (
          <ul>
            {evidence.map((item) => (
              <li key={item.id}>
                <span className={styles.evidenceMark} aria-hidden="true">✓</span>
                <div>
                  <strong>{copy.internalFixture}</strong>
                  <small>{item.assetId}</small>
                </div>
                <time dateTime={item.createdAt}>{formatTime(item.createdAt, locale)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function ActionButtons({
  busy,
  copy,
  evidenceCount,
  onAction,
  state
}: {
  busy: BusyAction | null;
  copy: (typeof COPY)[Locale];
  evidenceCount: number;
  onAction: (action: Exclude<BusyAction, "RESET">) => void;
  state: ServiceRequestState;
}) {
  const disabled = busy !== null;
  if (state === "REVIEW") {
    return <ActionButton disabled={disabled} label={copy.approve} onClick={() => onAction("APPROVE")} primary />;
  }
  if (state === "ASSIGNED") {
    return <ActionButton disabled={disabled} label={copy.start} onClick={() => onAction("START")} primary />;
  }
  if (state === "BLOCKED") {
    return <ActionButton disabled={disabled} label={copy.resume} onClick={() => onAction("RESUME")} primary />;
  }
  if (state === "IN_PROGRESS") {
    return (
      <div className={styles.buttonRow}>
        <ActionButton disabled={disabled} label={copy.pause} onClick={() => onAction("BLOCK")} />
        <ActionButton disabled={disabled} label={copy.addEvidence} onClick={() => onAction("ATTACH_EVIDENCE")} />
        <ActionButton disabled={disabled || evidenceCount === 0} label={copy.complete} onClick={() => onAction("COMPLETE")} primary />
      </div>
    );
  }
  if (state === "COMPLETED") {
    return <ActionButton disabled={disabled} label={copy.close} onClick={() => onAction("CLOSE")} primary />;
  }
  if (state === "CLOSED") return <p className={styles.closedNote}>{copy.closed}</p>;
  return <p className={styles.emptyText}>{copy.noAction}</p>;
}

function ActionButton({
  disabled,
  label,
  onClick,
  primary = false
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={primary ? styles.primaryButton : styles.secondaryButton}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AuditTimeline({
  copy,
  locale,
  snapshot
}: {
  copy: (typeof COPY)[Locale];
  locale: Locale;
  snapshot: ServiceFlowSnapshot;
}) {
  const events = [...snapshot.audit].sort((left, right) => right.sequence - left.sequence);
  return (
    <section className={styles.timeline} aria-labelledby="serviceflow-timeline-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="serviceflow-timeline-title">{copy.timeline}</h2>
          <p>{copy.timelineHint}</p>
        </div>
        <span>{events.length}</span>
      </div>
      {events.length === 0 ? <p className={styles.emptyText}>{copy.noEvents}</p> : (
        <ol>
          {events.map((event) => (
            <TimelineEvent copy={copy} event={event} key={event.id} locale={locale} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineEvent({
  copy,
  event,
  locale
}: {
  copy: (typeof COPY)[Locale];
  event: ServiceFlowEvent;
  locale: Locale;
}) {
  const reason = typeof event.details.reason === "string" ? event.details.reason : null;
  const fromState = isState(event.details.fromState) ? copy.states[event.details.fromState] : null;
  const toState = isState(event.details.toState) ? copy.states[event.details.toState] : null;
  return (
    <li>
      <span className={styles.timelineSequence}>{String(event.sequence).padStart(2, "0")}</span>
      <div>
        <strong>{copy.events[event.type]}</strong>
        <p>
          <code>{event.actorId}</code>
          {fromState && toState ? <span>{fromState} → {toState}</span> : null}
        </p>
        {reason ? <blockquote>{reason}</blockquote> : null}
      </div>
      <time dateTime={event.createdAt}>{formatTime(event.createdAt, locale)}</time>
    </li>
  );
}

function StateBadge({
  copy,
  state
}: {
  copy: (typeof COPY)[Locale];
  state: ServiceRequestState;
}) {
  return <span className={`${styles.stateBadge} ${styles[`state${state}`]}`}>{copy.states[state]}</span>;
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.panelTitle}>{children}</h3>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Metric({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "danger" | "accent" | "success";
  value: number;
}) {
  return (
    <article className={`${styles.metric} ${styles[`metric${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatusCard({
  alert = false,
  children,
  message
}: {
  alert?: boolean;
  children?: React.ReactNode;
  message: string;
}) {
  return (
    <section className={styles.statusCard} role={alert ? "alert" : "status"}>
      <p>{message}</p>
      {children}
    </section>
  );
}

function commandBody(
  action: Exclude<BusyAction, "RESET">,
  currentCase: ServiceFlowCase,
  reason: string
): Record<string, unknown> | null {
  const { request, evaluation } = currentCase;
  if (action === "APPROVE") {
    const proposal = evaluation.proposal;
    if (!proposal) return null;
    return {
      action,
      requestRevision: request.revision,
      technicianId: proposal.technicianId,
      proposalPolicyVersion: proposal.policyVersion,
      proposalRuleVersion: proposal.ruleVersion,
      reason
    };
  }
  if (action === "ATTACH_EVIDENCE") {
    return {
      action,
      requestRevision: request.revision,
      evidenceType: "DEMO_INTERNAL_FIXTURE",
      evidenceAssetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_01"
    };
  }
  return { action, requestRevision: request.revision, reason };
}

async function mutationRequest(path: string, body: Record<string, unknown>): Promise<unknown> {
  const headers = new Headers({
    "content-type": "application/json",
    "idempotency-key": createIdempotencyKey()
  });
  const csrf = readCookie("__Host-manovaflow-csrf");
  if (csrf) headers.set("x-csrf-token", csrf);
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error("ServiceFlow command rejected");
  return payload;
}

function createIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `serviceflow-ui-${random}`;
}

function readCookie(name: string): string | null {
  for (const segment of document.cookie.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() === name) {
      const value = segment.slice(separator + 1).trim();
      return value || null;
    }
  }
  return null;
}

function isServiceFlowSnapshot(value: unknown): value is ServiceFlowSnapshot {
  if (!isRecord(value) || value.outboundActionCount !== 0 || !Array.isArray(value.cases)) return false;
  if (!Array.isArray(value.approvals) || !Array.isArray(value.assignments)) return false;
  if (!Array.isArray(value.completionEvidence) || !Array.isArray(value.audit)) return false;
  const tenantIds = new Set<string>();
  for (const item of value.cases) {
    if (!isRecord(item) || !isRecord(item.request) || !isRecord(item.evaluation)) return false;
    if (item.request.input === null || !isRecord(item.request.input)) return false;
    if (item.request.input.synthetic !== true || typeof item.request.tenantId !== "string") return false;
    if (!isState(item.request.state) || typeof item.request.id !== "string") return false;
    tenantIds.add(item.request.tenantId);
  }
  for (const collection of [value.approvals, value.assignments, value.completionEvidence, value.audit]) {
    for (const item of collection) {
      if (!isRecord(item) || typeof item.tenantId !== "string") return false;
      tenantIds.add(item.tenantId);
    }
  }
  return tenantIds.size <= 1;
}

function isState(value: unknown): value is ServiceRequestState {
  return [
    "NEW",
    "NEEDS_INFO",
    "REVIEW",
    "BLOCKED",
    "APPROVED",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CLOSED"
  ].includes(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafetyLocked(item: ServiceFlowCase): boolean {
  return item.evaluation.blockReason === "POSSIBLE_EMERGENCY" || item.evaluation.blockReason === "SAFETY_UNKNOWN";
}

function caseTitle(
  item: ServiceFlowCase,
  copy: (typeof COPY)[Locale],
  index: number
): string {
  return isSafetyLocked(item) || index === 1 ? copy.hazardTitle : copy.standardTitle;
}

function humanizeCode(value: string | undefined): string {
  return value ? value.replaceAll("_", " ") : "—";
}

function formatTime(value: string, locale: Locale): string {
  const localeName = locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(localeName, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(new Date(value));
}

function buildMetrics(snapshot: ServiceFlowSnapshot | null) {
  const cases = snapshot?.cases ?? [];
  return {
    cases: cases.length,
    safety: cases.filter(isSafetyLocked).length,
    active: cases.filter((item) => ["ASSIGNED", "IN_PROGRESS", "BLOCKED", "COMPLETED"].includes(item.request.state) && !isSafetyLocked(item)).length,
    closed: cases.filter((item) => item.request.state === "CLOSED" && item.request.completionEvidenceIds.length > 0).length,
    events: snapshot?.audit.length ?? 0
  };
}
