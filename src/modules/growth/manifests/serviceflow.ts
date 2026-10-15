import type { VerticalManifest } from "./types";

export const serviceflowManifest = Object.freeze({
  key: "serviceflow",
  displayName: "ServiceFlow",
  packState: "ACTIVE_DEVELOPMENT",
  initialState: "RESEARCH_ONLY",
  icp: "شرکت کوچک خدمات تعمیر و نگه‌داری غیراضطراری با گردش کار تکرارشونده",
  scoring: {
    threshold: 60,
    signals: [
      {
        key: "non_emergency_maintenance",
        label: "خدمت نگه‌داری غیراضطراری",
        weight: 25
      },
      { key: "team_size_visible", label: "شاهد عمومی اندازه تیم", weight: 15 },
      { key: "service_area_visible", label: "محدوده خدمت روشن", weight: 10 },
      {
        key: "recurring_request_flow",
        label: "درخواست تکرارشونده",
        weight: 15
      },
      {
        key: "visible_intake_gap",
        label: "شکاف قابل مشاهده در دریافت درخواست",
        weight: 15
      },
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
      "emergency_dispatch",
      "regulated_safety_decision",
      "personal_contact_data",
      "hidden_location_tracking"
    ]
  },
  prohibitedRiskFlags: [
    "emergency_dispatch",
    "regulated_safety_decision",
    "personal_contact_data",
    "hidden_location_tracking"
  ],
  allowedClaims: [
    "نمونه پژوهشی برای مدیریت درخواست غیراضطراری",
    "تخصیص نهایی همیشه با انسان است"
  ],
  forbiddenClaims: [
    "اعزام اضطراری خودکار",
    "ردیابی GPS",
    "صرفه‌جویی یا درآمد تضمین‌شده"
  ],
  dailyCaps: {
    sourceUrls: 40,
    organizations: 20,
    drafts: 5,
    markets: 4,
    elapsedMs: 5_000,
    consecutiveLowValue: 2,
    paidSpend: 0
  },
  draftKind: "PRODUCT_DISCOVERY",
  draftTemplate:
    "پیش‌نویس داخلی پژوهش محصول ServiceFlow برای {company}؛ ارسال نشده است.",
  killRules: ["هر اثر بیرونی", "هر داده شخصی", "هر تصمیم ایمنی خودکار"]
} satisfies VerticalManifest);
