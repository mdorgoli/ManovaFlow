import type { VerticalManifest } from "./types";

export const beautyflowManifest = Object.freeze({
  key: "beautyflow",
  displayName: "BeautyFlow",
  packState: "VALIDATION_BACKLOG",
  initialState: "RESEARCH_ONLY",
  icp: "سالن زیبایی غیرپزشکی با کاتالوگ عمومی و چند اپراتور یا شعبه",
  scoring: {
    threshold: 60,
    signals: [
      { key: "non_medical_beauty", label: "خدمت زیبایی غیرپزشکی", weight: 25 },
      { key: "catalog_hours_visible", label: "کاتالوگ و ساعات عمومی", weight: 15 },
      { key: "multi_operator_or_location", label: "چند اپراتور یا محل", weight: 15 },
      { key: "booking_path_visible", label: "مسیر رزرو قابل مشاهده", weight: 15 },
      { key: "confirmation_gap_visible", label: "شکاف تأیید قابل مشاهده", weight: 10 },
      { key: "supported_public_language", label: "زبان عمومی قابل پشتیبانی", weight: 10 },
      { key: "country_research_ready", label: "آمادگی صرفاً پژوهشی بازار", weight: 10 }
    ],
    prohibitedRiskFlags: [
      "medical_treatment",
      "health_or_biometric_data",
      "minor_services",
      "diagnostic_claim"
    ]
  },
  prohibitedRiskFlags: [
    "medical_treatment",
    "health_or_biometric_data",
    "minor_services",
    "diagnostic_claim"
  ],
  allowedClaims: [
    "پیش‌نمایش پژوهشی BeautyFlow",
    "عضویت احتمالی در فهرست انتظار بدون انتشار"
  ],
  forbiddenClaims: [
    "محصول آماده فروش است",
    "رزرو یا تأیید خودکار فعال است",
    "ادعای پزشکی یا تشخیصی"
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
  draftTemplate: "پیش‌نویس داخلی فهرست انتظار BeautyFlow برای {company}؛ محصول آماده نیست و پیام ارسال نشده است.",
  killRules: ["هر اثر بیرونی", "هر داده سلامت یا بیومتریک", "هر رزرو واقعی"]
} satisfies VerticalManifest);
