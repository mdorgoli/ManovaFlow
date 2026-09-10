export type HomeLocale = "en" | "fr" | "ar";

export const homeLanguageOptions = [
  { locale: "en", label: "English", short: "EN", href: "/" },
  { locale: "fr", label: "Français", short: "FR", href: "/fr" },
  { locale: "ar", label: "العربية", short: "العربية", href: "/ar" }
] as const;

export interface HomeHeaderCopy {
  home: string;
  navigation: readonly [string, string, string, string, string];
  mainNavigation: string;
  mobileNavigation: string;
  language: string;
  openMenu: string;
  closeMenu: string;
  menu: string;
  explore: string;
  workflow: string;
  serviceflow: string;
}

interface HomeCopy {
  metadata: { title: string; description: string };
  header: HomeHeaderCopy;
  skip: string;
  title: readonly [string, string];
  introduction: readonly [string, string, string];
  preview: string;
  workflowLabel: string;
  stages: readonly [string, string, string, string, string];
  closed: string;
  flowsLabel: string;
  development: string;
  validation: string;
  valuesTitle: string;
  valuesIntro: string;
  values: readonly [
    { title: string; detail: string },
    { title: string; detail: string },
    { title: string; detail: string },
    { title: string; detail: string }
  ];
  aboutEyebrow: string;
  aboutTitle: readonly [string, string];
  about: readonly [string, string];
  resourcesEyebrow: string;
  resourcesTitle: string;
  resourcesDescription: string;
  resourceLinks: readonly [string, string, string];
  backToTop: string;
}

export const homeCopy: Record<HomeLocale, HomeCopy> = {
  en: {
    metadata: {
      title: "ManovaFlow — Every request, clearly handled.",
      description: "A research preview of human-controlled service workflows. AI-assisted review, human approval, and recorded completion evidence."
    },
    header: {
      home: "ManovaFlow home", navigation: ["Product", "Flows", "How it works", "About", "Resources"],
      mainNavigation: "Main navigation", mobileNavigation: "Mobile navigation", language: "Language",
      openMenu: "Open menu", closeMenu: "Close menu", menu: "Navigation menu", explore: "Explore ManovaFlow",
      workflow: "See the workflow", serviceflow: "Meet ServiceFlow"
    },
    skip: "Skip to content",
    title: ["Every request,", "clearly handled"],
    introduction: ["ManovaFlow brings structure to incoming work.", "AI-assisted review. Human approval.", "Verified outcomes. Every time."],
    preview: "Research preview · Human-controlled",
    workflowLabel: "How a request moves through ManovaFlow",
    stages: ["Request received", "AI-assisted review", "Human approval", "Work completed", "Proof of completion"],
    closed: "Request closed",
    flowsLabel: "Flows and their current development status",
    development: "In active development", validation: "In validation",
    valuesTitle: "Built for service businesses",
    valuesIntro: "One platform for every request type, every team, every step.",
    values: [
      { title: "Human in control", detail: "People approve every assignment before work begins." },
      { title: "AI-assisted", detail: "AI helps check, summarize, and propose the next step." },
      { title: "Clear progress", detail: "Everyone sees what’s next, who’s doing it, and why." },
      { title: "Verifiable outcomes", detail: "Completion proof is captured and linked to every request." }
    ],
    aboutEyebrow: "A considered starting point",
    aboutTitle: ["People make the decisions.", "The workflow keeps the context."],
    about: [
      "We’re developing ManovaFlow around a simple idea: a request should have a clear owner, a visible next step, and evidence of its outcome.",
      "ServiceFlow is our first research preview, focused on non-emergency service requests. The sequence above shows the intended workflow—not a live activity feed or a claim of completed customer work."
    ],
    resourcesEyebrow: "Explore the research preview", resourcesTitle: "See what’s taking shape.",
    resourcesDescription: "Try a synthetic request, or inspect recorded research. Sending messages, booking services, and payments are not enabled.",
    resourceLinks: ["Explore the ServiceFlow demo", "View recorded market research", "Open research dashboard"],
    backToTop: "Back to top"
  },
  fr: {
    metadata: {
      title: "ManovaFlow — Chaque demande, clairement traitée.",
      description: "Un aperçu de recherche sur la gestion des demandes de services sous contrôle humain. Analyse assistée par l’IA, validation humaine et preuves de réalisation."
    },
    header: {
      home: "Accueil ManovaFlow", navigation: ["Le produit", "Les parcours", "Comment ça marche", "À propos", "Ressources"],
      mainNavigation: "Navigation principale", mobileNavigation: "Navigation mobile", language: "Langue",
      openMenu: "Ouvrir le menu", closeMenu: "Fermer le menu", menu: "Menu de navigation", explore: "Explorer ManovaFlow",
      workflow: "Voir le parcours", serviceflow: "Découvrir ServiceFlow"
    },
    skip: "Aller au contenu",
    title: ["Chaque demande,", "clairement traitée"],
    introduction: ["ManovaFlow structure les demandes entrantes.", "Analyse assistée par l’IA. Validation humaine.", "Des résultats vérifiés. À chaque étape."],
    preview: "Aperçu de recherche · Sous contrôle humain",
    workflowLabel: "Le parcours d’une demande dans ManovaFlow",
    stages: ["Demande reçue", "Analyse assistée par l’IA", "Validation humaine", "Travail terminé", "Preuve de réalisation"],
    closed: "Demande clôturée",
    flowsLabel: "Les parcours et leur état de développement",
    development: "En développement actif", validation: "En cours de validation",
    valuesTitle: "Pensé pour les entreprises de services",
    valuesIntro: "Une plateforme pour chaque type de demande, chaque équipe, chaque étape.",
    values: [
      { title: "L’humain garde la main", detail: "Chaque mission est approuvée par une personne avant le début du travail." },
      { title: "L’IA en soutien", detail: "L’IA aide à vérifier, à synthétiser et à proposer la prochaine étape." },
      { title: "Un suivi clair", detail: "Chacun voit la prochaine étape, la personne responsable et les raisons du choix." },
      { title: "Des résultats vérifiables", detail: "Les preuves de réalisation sont enregistrées et reliées à chaque demande." }
    ],
    aboutEyebrow: "Un point de départ réfléchi",
    aboutTitle: ["Les décisions restent humaines.", "Le parcours conserve le contexte."],
    about: [
      "Nous développons ManovaFlow autour d’une idée simple : chaque demande doit avoir un responsable identifié, une prochaine étape visible et des preuves de son résultat.",
      "ServiceFlow est notre premier aperçu de recherche, consacré aux demandes de services non urgentes. La séquence ci-dessus illustre le parcours prévu : ce n’est ni un suivi d’activité en direct, ni une affirmation de travaux déjà réalisés pour des clients."
    ],
    resourcesEyebrow: "Explorer l’aperçu de recherche", resourcesTitle: "Découvrez ce qui prend forme.",
    resourcesDescription: "Testez une demande fictive ou consultez les recherches enregistrées. L’envoi de messages, la réservation de services et les paiements ne sont pas activés.",
    resourceLinks: ["Explorer la démo ServiceFlow", "Consulter les recherches de marché", "Ouvrir le tableau de recherche"],
    backToTop: "Retour en haut"
  },
  ar: {
    metadata: {
      title: "ManovaFlow — كل طلب، يُدار بوضوح.",
      description: "نسخة بحثية تجريبية لإدارة طلبات الخدمات بإشراف بشري. مراجعة بمساعدة الذكاء الاصطناعي، وموافقة بشرية، وأدلة إنجاز مسجّلة."
    },
    header: {
      home: "الصفحة الرئيسية لمنصة ManovaFlow", navigation: ["المنتج", "المسارات", "كيف يعمل", "عن المنصة", "الموارد"],
      mainNavigation: "التنقل الرئيسي", mobileNavigation: "التنقل على الهاتف", language: "اللغة",
      openMenu: "فتح القائمة", closeMenu: "إغلاق القائمة", menu: "قائمة التنقل", explore: "استكشف ManovaFlow",
      workflow: "شاهد مسار العمل", serviceflow: "تعرّف على ServiceFlow"
    },
    skip: "انتقل إلى المحتوى",
    title: ["كل طلب،", "يُدار بوضوح"],
    introduction: ["تنظّم ManovaFlow الطلبات الواردة.", "مراجعة بمساعدة الذكاء الاصطناعي. موافقة بشرية.", "نتائج موثّقة. في كل مرة."],
    preview: "نسخة بحثية تجريبية · بإشراف بشري",
    workflowLabel: "مراحل معالجة الطلب في ManovaFlow",
    stages: ["استلام الطلب", "مراجعة بمساعدة الذكاء الاصطناعي", "موافقة بشرية", "إنجاز العمل", "إثبات الإنجاز"],
    closed: "إغلاق الطلب",
    flowsLabel: "المسارات وحالة تطويرها الحالية",
    development: "قيد التطوير الفعلي", validation: "قيد التحقق",
    valuesTitle: "مصمّمة لقطاع الخدمات",
    valuesIntro: "منصة واحدة لكل نوع من الطلبات، ولكل فريق، ولكل خطوة.",
    values: [
      { title: "القرار بيد الإنسان", detail: "يوافق الأشخاص على كل مهمة قبل بدء العمل." },
      { title: "بمساعدة الذكاء الاصطناعي", detail: "يساعد الذكاء الاصطناعي في المراجعة والتلخيص واقتراح الخطوة التالية." },
      { title: "تقدّم واضح", detail: "يرى الجميع الخطوة التالية، والمسؤول عنها، وسبب اختيارها." },
      { title: "نتائج قابلة للتحقق", detail: "تُسجَّل أدلة الإنجاز وتُربط بكل طلب." }
    ],
    aboutEyebrow: "بداية مدروسة",
    aboutTitle: ["الناس يتخذون القرارات.", "ومسار العمل يحفظ السياق."],
    about: [
      "نطوّر ManovaFlow انطلاقًا من فكرة بسيطة: لكل طلب مسؤول واضح، وخطوة تالية ظاهرة، ودليل على نتيجته.",
      "ServiceFlow هي نسختنا البحثية التجريبية الأولى، وتركّز على طلبات الخدمات غير الطارئة. يوضّح التسلسل أعلاه مسار العمل المستهدف، وليس نشاطًا مباشرًا أو ادعاءً بإنجاز أعمال لعملاء."
    ],
    resourcesEyebrow: "استكشف النسخة البحثية التجريبية", resourcesTitle: "اطّلع على ما نطوّره.",
    resourcesDescription: "جرّب طلبًا ببيانات مصطنعة أو اطّلع على الأبحاث المسجّلة. إرسال الرسائل وحجز الخدمات والمدفوعات غير مفعّلة.",
    resourceLinks: ["استكشف العرض التجريبي لـ ServiceFlow", "اطّلع على أبحاث السوق المسجّلة", "افتح لوحة البحث"],
    backToTop: "العودة إلى الأعلى"
  }
};
