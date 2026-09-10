import type { MarketScoutLanguage } from "@/modules/growth/application/market-scout-contracts";
import type { QUALIFICATION_REASONS } from "@/modules/growth/application/marketing-workflow-contract";

const en = {
  title: "Marketing workflow", description: "Rule-based analysis of saved records — not a new search or live agent activity. Previews are not saved or sent.",
  prospector: "Prospector", qualifier: "Qualifier", pitcher: "Pitcher", supervisor: "Supervisor",
  collect: "Normalize recorded public sources", qualify: "Check the recorded fit score", pitch: "Draft only for qualified records", supervise: "Validate copy and hold external actions",
  reviewed: "Reviewed sites", qualified: "Fit-qualified", proposals: "Internal previews", recorded: "Recorded public source",
  score: "Recorded score / threshold", missing: "Not recorded", reference: "Scoring evidence", source: "Source evidence",
  noDraft: "No draft: qualification has not passed", held: "Held for human review", blocked: "Blocked",
  holds: "Sending is disabled. Legal review and customer-need verification are still required. This check is not legal advice.",
  fitCaveat: "Fit qualification is not proof of customer interest or unmet need.",
  restricted: "Workflow details are restricted for this role.", notRecorded: "Required records are missing; no qualification was invented.",
  incomplete: "The recorded run is not complete; the workflow is not evaluated.", unsupported: "This workflow currently supports the France / ServiceFlow scope only."
};
type Copy = { [K in keyof typeof en]: string };
export const workflowCopy: Record<MarketScoutLanguage, Copy> = {
  en,
  fr: {
    title: "Parcours marketing", description: "Analyse par règles des données enregistrées — ni nouvelle recherche ni activité d’agent en direct. Les aperçus ne sont ni sauvegardés ni envoyés.",
    prospector: "Prospecteur", qualifier: "Évaluateur", pitcher: "Rédacteur", supervisor: "Superviseur",
    collect: "Normaliser les sources publiques enregistrées", qualify: "Vérifier le score d’adéquation enregistré", pitch: "Rédiger uniquement pour les fiches qualifiées", supervise: "Valider le texte et bloquer les actions externes",
    reviewed: "Sites examinés", qualified: "Adéquation validée", proposals: "Aperçus internes", recorded: "Source publique enregistrée",
    score: "Score enregistré / seuil", missing: "Non enregistré", reference: "Référence du score", source: "Référence de la source",
    noDraft: "Aucun brouillon : qualification non validée", held: "En attente de vérification humaine", blocked: "Bloqué",
    holds: "L’envoi est désactivé. Un examen juridique et la vérification des besoins restent nécessaires. Ce contrôle ne constitue pas un avis juridique.",
    fitCaveat: "L’adéquation ne prouve ni l’intérêt du client ni un besoin non satisfait.",
    restricted: "Les détails du parcours sont restreints pour ce rôle.", notRecorded: "Des données nécessaires manquent ; aucune qualification n’a été inventée.",
    incomplete: "L’exécution enregistrée n’est pas terminée ; le parcours n’est pas évalué.", unsupported: "Ce parcours prend actuellement en charge uniquement France / ServiceFlow."
  },
  ar: {
    title: "مسار التسويق", description: "تحليل قائم على قواعد للسجلات المحفوظة — ليس بحثاً جديداً أو نشاطاً حياً للوكلاء. المعاينات لا تُحفظ ولا تُرسل.",
    prospector: "الباحث", qualifier: "المقيّم", pitcher: "كاتب المقترح", supervisor: "المشرف",
    collect: "توحيد المصادر العامة المسجلة", qualify: "فحص درجة الملاءمة المسجلة", pitch: "صياغة مقترح للسجلات المؤهلة فقط", supervise: "التحقق من النص وإيقاف الإجراءات الخارجية",
    reviewed: "المواقع المراجعة", qualified: "المؤهلة من حيث الملاءمة", proposals: "المعاينات الداخلية", recorded: "مصدر عام مسجل",
    score: "الدرجة المسجلة / الحد", missing: "غير مسجل", reference: "مرجع التقييم", source: "مرجع المصدر",
    noDraft: "لا توجد مسودة: لم يجتز السجل التأهيل", held: "بانتظار مراجعة بشرية", blocked: "محظور",
    holds: "الإرسال معطّل. ما زالت المراجعة القانونية والتحقق من حاجة العميل مطلوبين. هذا الفحص ليس استشارة قانونية.",
    fitCaveat: "التأهيل لا يثبت اهتمام العميل أو وجود حاجة غير ملباة.",
    restricted: "تفاصيل المسار مقيّدة لهذا الدور.", notRecorded: "بعض السجلات اللازمة مفقودة؛ لم يتم اختلاق تأهيل.",
    incomplete: "التشغيل المسجل غير مكتمل؛ لم يُقيّم المسار.", unsupported: "يدعم هذا المسار حالياً نطاق فرنسا / ServiceFlow فقط."
  }
};

export const qualificationReasonCopy: Record<MarketScoutLanguage, Record<(typeof QUALIFICATION_REASONS)[number], string>> = {
  en: { RECORDED_FIT_THRESHOLD_MET: "Recorded fit threshold met", BELOW_FIT_THRESHOLD: "Below the recorded fit threshold", RISK_RULE_BLOCKED: "Blocked by a risk rule", SUPPRESSED_DOMAIN: "Domain is on the suppression list", NOT_SCORED_IN_THIS_RUN: "Not scored in this run", WEBSITE_REVIEW_NOT_SUCCESSFUL: "Website review did not succeed", NO_REVIEW_SIGNALS: "No reviewed page signals", UNTRUSTED_INSTRUCTION_DETECTED: "Instruction-like source content requires review" },
  fr: { RECORDED_FIT_THRESHOLD_MET: "Seuil d’adéquation enregistré atteint", BELOW_FIT_THRESHOLD: "Sous le seuil d’adéquation enregistré", RISK_RULE_BLOCKED: "Bloqué par une règle de risque", SUPPRESSED_DOMAIN: "Domaine sur la liste d’exclusion", NOT_SCORED_IN_THIS_RUN: "Non évalué dans cette exécution", WEBSITE_REVIEW_NOT_SUCCESSFUL: "L’examen du site n’a pas réussi", NO_REVIEW_SIGNALS: "Aucun signal de page examiné", UNTRUSTED_INSTRUCTION_DETECTED: "Le contenu ressemblant à des instructions nécessite une vérification" },
  ar: { RECORDED_FIT_THRESHOLD_MET: "تم بلوغ حد الملاءمة المسجل", BELOW_FIT_THRESHOLD: "أقل من حد الملاءمة المسجل", RISK_RULE_BLOCKED: "محظور بقاعدة مخاطر", SUPPRESSED_DOMAIN: "النطاق في قائمة الاستبعاد", NOT_SCORED_IN_THIS_RUN: "لم يُقيّم في هذا التشغيل", WEBSITE_REVIEW_NOT_SUCCESSFUL: "لم تنجح مراجعة الموقع", NO_REVIEW_SIGNALS: "لا توجد إشارات صفحة مراجعة", UNTRUSTED_INSTRUCTION_DETECTED: "محتوى يشبه التعليمات يحتاج إلى مراجعة" }
};
