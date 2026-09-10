# وضعیت واقعی Dashboard Phase 2A

- تاریخ: ۲۰۲۶-۰۹-۰۴
- وضعیت: `IMPLEMENTED_LOCAL_AND_VERIFIED`
- Design Gate مرجع: `docs/superpowers/specs/2026-09-04-three-agent-rtl-dashboard-design-gate.md`
- Design QA: `design-qa.md` با نتیجه دقیق `passed`
- دامنه: فقط پوسته اصلی تیره و RTL، نوار Safety Context و سه ستون موازی ServiceFlow، BeautyFlow و BriefFlow.
- این وضعیت ادعای deploy، production readiness یا اتصال provider نیست.

## اتصال به Phase 1

- صفحه فقط از قرارداد `manovaflow.dashboard.v1` در `GET /api/dashboard` می‌خواند.
- هیچ manifest، نتیجه اجرای خام، market profile یا مقدار نمایشی ساختگی در component وارد نشده است.
- payload قبل از render از نظر نسخه، Safety Context، سه lane یکتا، cap limit/usage و شکل مقادیر `PRESENT/MISSING` کنترل می‌شود.
- payload ناقص یا ناسازگار fail-closed است و به alert عمومی تبدیل می‌شود؛ داده نیمه‌معتبر render نمی‌شود.
- درخواست فقط same-origin، `GET` و `cache: no-store` است.

## رفتار رابط

- Safety Context مستقیماً `DEMO`، `SYNTHETIC DATA`، `RESEARCH-ONLY` و `Outbound = 0` را از read model نمایش می‌دهد.
- تاریخ از `generatedAt` قرارداد گرفته می‌شود.
- سه lane به‌ترتیب بصری ServiceFlow، BeautyFlow و BriefFlow و با نام قابل‌دسترسی مستقل render می‌شوند.
- pack state فقط ترجمه نمایشی enum قرارداد است: `ACTIVE_DEVELOPMENT` به «توسعه فعال» و `VALIDATION_BACKLOG` به «صف اعتبارسنجی / محصول آماده نیست».
- آخرین اجرا، مرجع مصرف، دلیل توقف و تمام usageهای غایب صریحاً `MISSING` باقی می‌مانند.
- capهای ثبت‌شده از read model نمایش داده می‌شوند؛ remaining محاسبه یا جعل نشده است.
- هیچ button، اجرای پژوهش، ارسال، رزرو، خرید، تبلیغ یا outbound action در Phase 2A وجود ندارد.
- حالت‌های loading و error مستقل و قابل‌اعلام هستند.

## TDD ثبت‌شده

- RED اول: تست Phase 2A در برابر UI قدیمی، main نام‌گذاری‌شده، Safety Context جدید و محدودیت «بدون button» را پیدا نکرد.
- GREEN اول: پوسته RTL، Safety Context و سه lane فقط بر پایه read model پیاده‌سازی شدند.
- RED دوم: payload ظاهراً v1 اما ناقص از guard سطحی عبور کرد و render را شکست.
- GREEN دوم: validation fail-closed ساختاری اضافه شد و payload ناقص پیش از render به alert تبدیل شد.
- تست component هدفمند: `3/3` موفق.

## Design QA مرورگر

- مرورگر: Codex in-app browser.
- viewport نهایی: `1487 × 1058` CSS pixel با DPR برابر `1`؛ دقیقاً هم‌اندازه مرجع `1487 × 1058`.
- مرجع و implementation نهایی در یک ورودی مقایسه و سپس دو mismatch چیدمانی طی دو دور اصلاح شدند.
- شواهد:
  - `docs/status/2026-09-04-dashboard-phase-2a-pass-1.jpg`
  - `docs/status/2026-09-04-dashboard-phase-2a-pass-2.jpg`
  - `docs/status/2026-09-04-dashboard-phase-2a-implementation.jpg`
- accessibility tree حضور main، Safety Context و هر سه article نام‌گذاری‌شده را تأیید کرد.
- console مرورگر در ready state: صفر warning و صفر error.
- جزئیات کامل تاریخچه mismatch/fix در `design-qa.md` ثبت شده است.

## شواهد تازه گیت نهایی

- کل تست‌های غیرintegration: `26` فایل و `152` تست، همگی موفق.
- TypeScript strict (`tsc --noEmit`): موفق، صفر خطا.
- ESLint کامل: موفق، صفر خطا.
- build بهینه Next.js `16.3.4`: موفق؛ `/` و `/api/dashboard` هر دو dynamic باقی مانده‌اند.

## فایل‌های Phase 2A

- `src/components/growth-dashboard.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `tests/component/growth-dashboard.test.tsx`
- `design-qa.md`
- `docs/status/2026-09-04-dashboard-phase-2a-status.md`
- سه تصویر QA در `docs/status/`.

## موارد عمداً خارج از دامنه یا اثبات‌نشده

- بخش‌های پایین مرجع شامل Market Ranking، Evidence Matrix، Safe Audit Feed و Actions در Phase 2A ساخته نشده‌اند.
- هیچ provider، external API، deploy، ads، outbound gateway، credential یا Human-Send افزوده یا فعال نشده است.
- iconهای خطی مرجع بدون asset واقعی یا icon library تأییدشده جایگزین نشدند؛ emoji، SVG دست‌ساز و CSS art نیز استفاده نشده است. افزودن icon واقعی یک polish سطح P3 است.
- منبع font دقیق مرجع ارائه نشده است؛ رابط از fallback محلی Tahoma/Segoe UI استفاده می‌کند.
- منبع طراحی mobile وجود ندارد؛ breakpointهای stack پیاده‌سازی شده‌اند، اما mobile visual acceptance هنوز شواهد مستقل ندارد.
- تست PostgreSQL اجرا نشده است، چون `TEST_DATABASE_URL` از مسیر امن تزریق نشده بود؛ هیچ credential حدس زده یا ذخیره نشد.

نتیجه: Dashboard Phase 2A در محدوده محلی تعیین‌شده پیاده‌سازی و با TDD، ۱۵۲ تست غیرintegration، lint، typecheck، build و مقایسه مرورگر هم‌اندازه تأیید شد؛ قابلیت‌های Phase 2B و تمام عملیات خارجی همچنان خارج از دامنه و غیرفعال‌اند.
