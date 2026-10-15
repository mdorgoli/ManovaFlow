import type { VerticalManifest } from "./types";

export const briefflowManifest = Object.freeze({
  key: "briefflow",
  displayName: "BriefFlow",
  packState: "VALIDATION_BACKLOG",
  initialState: "RESEARCH_ONLY",
  icp: "تیم کوچک خدمات حرفه‌ای غیررگوله با brief و تحویل تکرارشونده",
  scoring: {
    threshold: 60,
    signals: [
      {
        key: "non_regulated_service",
        label: "خدمت حرفه‌ای غیررگوله",
        weight: 25
      },
      {
        key: "packaged_repeatable_service",
        label: "خدمت بسته‌بندی‌شده و تکرارشونده",
        weight: 20
      },
      { key: "public_brief_path", label: "مسیر عمومی brief", weight: 15 },
      {
        key: "approval_steps_visible",
        label: "گام‌های تأیید قابل مشاهده",
        weight: 10
      },
      { key: "small_team_visible", label: "شاهد تیم کوچک", weight: 10 },
      {
        key: "supported_public_language",
        label: "زبان عمومی قابل پشتیبانی",
        weight: 10
      },
      {
        key: "country_research_ready",
        label: "آمادگی صرفاً پژوهشی بازار",
        weight: 10
      }
    ],
    prohibitedRiskFlags: [
      "legal_advice",
      "financial_advice",
      "employment_decision",
      "confidential_document"
    ]
  },
  prohibitedRiskFlags: [
    "legal_advice",
    "financial_advice",
    "employment_decision",
    "confidential_document"
  ],
  allowedClaims: [
    "پیش‌نمایش پژوهشی BriefFlow",
    "بررسی علاقه به فهرست انتظار بدون انتشار"
  ],
  forbiddenClaims: [
    "محصول آماده فروش است",
    "مشاوره حقوقی یا مالی",
    "پردازش سند محرمانه"
  ],
  dailyCaps: {
    sourceUrls: 25,
    organizations: 10,
    drafts: 3,
    markets: 4,
    elapsedMs: 5_000,
    consecutiveLowValue: 2,
    paidSpend: 0
  },
  draftKind: "WAITLIST_PREVIEW",
  draftTemplate:
    "پیش‌نویس داخلی فهرست انتظار BriefFlow برای {company}؛ محصول آماده نیست و پیام ارسال نشده است.",
  killRules: ["هر اثر بیرونی", "هر سند محرمانه", "هر توصیه تخصصی رگوله"]
} satisfies VerticalManifest);
