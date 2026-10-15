import type { MarketScoutLanguage } from "@/modules/growth/application/market-scout-contracts";
import type { WebsiteReviewUnknown } from "@/modules/growth/application/market-scout-review-evidence";
import type { WebsiteReviewFact } from "@/modules/growth/application/market-scout-website-review";

const en = {
  title: "Market Scout activity",
  subtitle: "Public-source research · Recorded agent events",
  language: "Display language",
  empty: "No recorded activity",
  emptyDetail: "No agent events are available for this run.",
  error: "Activity unavailable",
  errorDetail:
    "The activity record could not be loaded. Agent status is unknown.",
  stale: "Activity may be out of date",
  staleDetail:
    "The last recorded event does not confirm that an agent is still working.",
  recorded: "Recorded activity",
  updated: "Last update",
  country: "Country / market",
  domain: "Business area",
  query: "Search expression",
  filters: "Source filters",
  source: "Source",
  site: "Website",
  stage: "Stage",
  reason: "Reason",
  events: "Event history",
  agent: "Agent",
  run: "Run",
  missing: "Not recorded",
  refresh: "Refresh activity",
  refreshing: "Refreshing activity…",
  evidence: "Recorded evidence",
  noSearch: "No search expression recorded",
  historical:
    "This record describes observed events; it does not confirm current agent activity.",
  evidenceUnavailable:
    "Detailed website-review evidence was not recorded for this historical run.",
  evidenceUnavailableDetail:
    "Page signals, fit context, unknowns and execution counters are unavailable; no backfill was inferred.",
  observedEvidence: "Page signals / recorded evidence",
  evidenceCaveat:
    "Automated allowlisted keyword matches; human review is required.",
  noObservedEvidence: "No allowlisted page signal was recorded.",
  potentialFit: "Potential fit, not proven need",
  potentialFitReady:
    "Potential fit for human review; this does not prove need or customer interest.",
  potentialFitUnknown: "Potential fit remains unassessed.",
  unknowns: "Unknowns",
  noUnknowns: "No allowlisted unknown was recorded.",
  reviewMetrics: "Review counters",
  safety: "Recorded cost and outbound status",
  safetyPrimary: "Paid spend: 0 · Apollo credits: 0 · Outbound actions: 0",
  safetySecondary: "Messages: 0 · Forms: 0 · Contact reveals: 0"
};

type ActivityCopy = { [K in keyof typeof en]: string };

export const activityCopy: Record<MarketScoutLanguage, ActivityCopy> = {
  en,
  fr: {
    title: "Activité Market Scout",
    subtitle: "Recherche sur sources publiques · Événements enregistrés",
    language: "Langue d’affichage",
    empty: "Aucune activité enregistrée",
    emptyDetail:
      "Aucun événement d’agent n’est disponible pour cette exécution.",
    error: "Activité indisponible",
    errorDetail:
      "Impossible de charger les événements. L’état des agents est inconnu.",
    stale: "L’activité peut être obsolète",
    staleDetail:
      "Le dernier événement ne confirme pas qu’un agent travaille encore.",
    recorded: "Activité enregistrée",
    updated: "Dernière mise à jour",
    country: "Pays / marché",
    domain: "Secteur d’activité",
    query: "Expression de recherche",
    filters: "Filtres de source",
    source: "Source",
    site: "Site web",
    stage: "Étape",
    reason: "Motif",
    events: "Historique des événements",
    agent: "Agent",
    run: "Exécution",
    missing: "Non enregistré",
    refresh: "Actualiser l’activité",
    refreshing: "Actualisation de l’activité…",
    evidence: "Éléments enregistrés",
    noSearch: "Aucune expression de recherche enregistrée",
    historical:
      "Ces données décrivent les événements observés ; elles ne confirment pas l’activité actuelle des agents.",
    evidenceUnavailable:
      "Les détails de l’examen du site n’ont pas été enregistrés pour cette exécution historique.",
    evidenceUnavailableDetail:
      "Les signaux de page, le contexte d’adéquation, les inconnues et les compteurs d’exécution sont indisponibles ; aucune donnée n’a été reconstituée.",
    observedEvidence: "Signaux de page / éléments enregistrés",
    evidenceCaveat:
      "Correspondances automatisées de mots-clés autorisés ; une vérification humaine est requise.",
    noObservedEvidence: "Aucun signal de page autorisé n’a été enregistré.",
    potentialFit: "Adéquation potentielle, besoin non prouvé",
    potentialFitReady:
      "Adéquation potentielle à examiner par un humain ; cela ne prouve ni besoin ni intérêt client.",
    potentialFitUnknown: "L’adéquation potentielle reste non évaluée.",
    unknowns: "Inconnues",
    noUnknowns: "Aucune inconnue autorisée n’a été enregistrée.",
    reviewMetrics: "Compteurs de l’examen",
    safety: "Coûts et actions sortantes enregistrés",
    safetyPrimary:
      "Dépense payante : 0 · Crédits Apollo : 0 · Actions sortantes : 0",
    safetySecondary:
      "Messages : 0 · Formulaires : 0 · Révélations de contact : 0"
  },
  ar: {
    title: "نشاط Market Scout",
    subtitle: "بحث في المصادر العامة · أحداث الوكلاء المسجلة",
    language: "لغة العرض",
    empty: "لا يوجد نشاط مسجل",
    emptyDetail: "لا تتوفر أحداث للوكلاء في هذا التشغيل.",
    error: "النشاط غير متاح",
    errorDetail: "تعذر تحميل سجل النشاط. حالة الوكلاء غير معروفة.",
    stale: "قد يكون سجل النشاط قديماً",
    staleDetail: "لا يؤكد آخر حدث مسجل أن الوكيل لا يزال يعمل.",
    recorded: "النشاط المسجل",
    updated: "آخر تحديث",
    country: "البلد / السوق",
    domain: "مجال العمل",
    query: "عبارة البحث",
    filters: "مرشحات المصدر",
    source: "المصدر",
    site: "الموقع الإلكتروني",
    stage: "المرحلة",
    reason: "السبب",
    events: "سجل الأحداث",
    agent: "الوكيل",
    run: "التشغيل",
    missing: "غير مسجل",
    refresh: "تحديث النشاط",
    refreshing: "جارٍ تحديث النشاط…",
    evidence: "الأدلة المسجلة",
    noSearch: "لم تُسجل عبارة بحث",
    historical: "يصف هذا السجل الأحداث المرصودة، ولا يؤكد نشاط الوكلاء الحالي.",
    evidenceUnavailable: "لم تُسجل تفاصيل مراجعة الموقع لهذا التشغيل التاريخي.",
    evidenceUnavailableDetail:
      "إشارات الصفحة وسياق الملاءمة والمجهولات وعدادات التنفيذ غير متاحة؛ لم يتم استنتاج بيانات بديلة.",
    observedEvidence: "إشارات الصفحة / الأدلة المسجلة",
    evidenceCaveat:
      "مطابقات آلية لكلمات مفتاحية مسموح بها؛ المراجعة البشرية مطلوبة.",
    noObservedEvidence: "لم تُسجل إشارة صفحة مسموح بها.",
    potentialFit: "ملاءمة محتملة، وليست حاجة مثبتة",
    potentialFitReady:
      "ملاءمة محتملة للمراجعة البشرية؛ لا يثبت ذلك وجود حاجة أو اهتمام من العميل.",
    potentialFitUnknown: "الملاءمة المحتملة غير مقيّمة بعد.",
    unknowns: "المجهولات",
    noUnknowns: "لم يُسجل مجهول مسموح به.",
    reviewMetrics: "عدادات المراجعة",
    safety: "حالة التكلفة والإجراءات الصادرة المسجلة",
    safetyPrimary:
      "الإنفاق المدفوع: 0 · أرصدة Apollo: 0 · الإجراءات الصادرة: 0",
    safetySecondary: "الرسائل: 0 · النماذج: 0 · كشف جهات الاتصال: 0"
  }
};

export const evidenceLabels: Record<
  MarketScoutLanguage,
  {
    facts: Record<WebsiteReviewFact, string>;
    unknowns: Record<WebsiteReviewUnknown, string>;
  }
> = {
  en: {
    facts: {
      PUBLIC_SERVICE_DESCRIPTION: "Service-description keyword pattern",
      PUBLIC_BOOKING_PATH: "Booking-path keyword pattern",
      PUBLIC_HOURS: "Public-hours keyword pattern",
      PUBLIC_MULTI_LOCATION: "Multi-location keyword pattern",
      PUBLIC_BRIEF_PATH: "Project-brief keyword pattern",
      PUBLIC_APPROVAL_LANGUAGE: "Approval-language keyword pattern",
      PUBLIC_PACKAGED_SERVICE_LANGUAGE: "Packaged-service keyword pattern"
    },
    unknowns: {
      WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED:
        "Website ownership was not independently verified",
      WORKFLOW_PAIN_UNVERIFIED: "Workflow pain is unverified",
      BUYER_AUTHORITY_UNVERIFIED: "Buyer authority is unverified",
      CUSTOMER_INTEREST_UNVERIFIED: "Customer interest is unverified"
    }
  },
  fr: {
    facts: {
      PUBLIC_SERVICE_DESCRIPTION: "Motif de mots-clés décrivant les services",
      PUBLIC_BOOKING_PATH: "Motif de mots-clés indiquant une réservation",
      PUBLIC_HOURS: "Motif de mots-clés indiquant les horaires publics",
      PUBLIC_MULTI_LOCATION: "Motif de mots-clés indiquant plusieurs sites",
      PUBLIC_BRIEF_PATH: "Motif de mots-clés indiquant un brief de projet",
      PUBLIC_APPROVAL_LANGUAGE: "Motif de mots-clés liés à l’approbation",
      PUBLIC_PACKAGED_SERVICE_LANGUAGE:
        "Motif de mots-clés décrivant une offre structurée"
    },
    unknowns: {
      WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED:
        "La propriété du site n’a pas été vérifiée indépendamment",
      WORKFLOW_PAIN_UNVERIFIED:
        "La difficulté du flux de travail n’est pas vérifiée",
      BUYER_AUTHORITY_UNVERIFIED: "L’autorité de l’acheteur n’est pas vérifiée",
      CUSTOMER_INTEREST_UNVERIFIED: "L’intérêt du client n’est pas vérifié"
    }
  },
  ar: {
    facts: {
      PUBLIC_SERVICE_DESCRIPTION: "نمط كلمات مفتاحية يصف الخدمة",
      PUBLIC_BOOKING_PATH: "نمط كلمات مفتاحية لمسار الحجز",
      PUBLIC_HOURS: "نمط كلمات مفتاحية لساعات العمل العامة",
      PUBLIC_MULTI_LOCATION: "نمط كلمات مفتاحية لتعدد المواقع",
      PUBLIC_BRIEF_PATH: "نمط كلمات مفتاحية لموجز المشروع",
      PUBLIC_APPROVAL_LANGUAGE: "نمط كلمات مفتاحية للموافقة",
      PUBLIC_PACKAGED_SERVICE_LANGUAGE: "نمط كلمات مفتاحية لخدمة مجمعة"
    },
    unknowns: {
      WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED:
        "ملكية الموقع لم يتم التحقق منها بشكل مستقل",
      WORKFLOW_PAIN_UNVERIFIED: "مشكلة سير العمل غير متحقق منها",
      BUYER_AUTHORITY_UNVERIFIED: "صلاحية المشتري غير متحقق منها",
      CUSTOMER_INTEREST_UNVERIFIED: "اهتمام العميل غير متحقق منه"
    }
  }
};
