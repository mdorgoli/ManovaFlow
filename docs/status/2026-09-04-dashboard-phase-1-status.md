# وضعیت واقعی Dashboard Phase 1

- تاریخ: ۲۰۲۶-۰۹-۰۴
- وضعیت: `IMPLEMENTED_LOCAL_VERIFIED_WITH_POSTGRES_GATE_BLOCKED`
- Design Gate مرجع: `docs/superpowers/specs/2026-09-04-three-agent-rtl-dashboard-design-gate.md`
- دامنه: قراردادها و projectionهای backend برای dashboard؛ بدون UI، ledger روزانه، export، provider، deploy یا outbound.
- این وضعیت ادعای production readiness نیست.

## قراردادهای نسخه‌دار

Envelope اصلی با نسخه `manovaflow.dashboard.v1` فقط شش read model زیر را برمی‌گرداند:

| read model | نسخه |
|---|---|
| Safety Context | `manovaflow.dashboard.safety-context.v1` |
| Lane Summary | `manovaflow.dashboard.lane-summary.v1` |
| Cap Usage | `manovaflow.dashboard.cap-usage.v1` |
| Market Ranking | `manovaflow.dashboard.market-ranking.v1` |
| Evidence Matrix | `manovaflow.dashboard.evidence-matrix.v1` |
| Safe Audit Feed | `manovaflow.dashboard.safe-audit-feed.v1` |

قرارداد مشترک مقدار فقط دو حالت دارد:

- `PRESENT`: مقدار همراه با حداقل یک provenance؛
- `MISSING`: reason typed همراه با provenance علت فقدان.

`zeroFromAbsence=false` بخشی از قرارداد است. نبود run، score، ledger، elapsed، audit یا شاهد واجدشرایط هرگز به صفر تبدیل نمی‌شود.

## رفتار پیاده‌سازی‌شده

### Safety Context

- فقط محیط غیرproduction با `DEMO_MODE=true` و dataset صریح `SYNTHETIC` پذیرفته می‌شود.
- storage mode از سرور ثبت می‌شود.
- tenant scope برابر tenant احراز‌شده request است و شناسه tenant/actor در payload بازتاب داده نمی‌شود.
- `Outbound=0` فقط با invariant سروری `gateway=DISABLED`، `credentials=ABSENT`، `outboundActions=0`، `paidSpend=0`، draftهای `outboundEnabled=false` و نبود authorization token ساخته می‌شود.
- هر ناسازگاری runtime یا outbound کل read model را fail-closed می‌بندد.

### Lane Summary

- برای هر سه lane دقیقاً یک entry بر اساس manifest ساخته می‌شود.
- pack state و `RESEARCH_ONLY` provenance پیکربندی دارند.
- آخرین run بر اساس timestamp معتبر انتخاب می‌شود؛ نبود run برابر `MISSING/NO_RECORDED_RUN` است.
- error خام run در payload قرار نمی‌گیرد.

### Cap Usage

- scope فعلی صادقانه `LAST_COMPLETED_RUN` است، نه «مصرف امروز».
- سقف‌ها از manifest و مصرف URL/organization/draft/market/paid-spend از آخرین run تکمیل‌شده می‌آید.
- window روزانه برابر `MISSING/LEDGER_NOT_IMPLEMENTED` است.
- elapsed و consecutive-low-value برابر `MISSING/NOT_PERSISTED` باقی می‌مانند.
- مصرف بالاتر از cap یا summary ناسازگار به source-integrity failure تبدیل می‌شود.

### Market Ranking

- ranking برای هر lane و فقط بر اساس آخرین run تکمیل‌شده همان lane ساخته می‌شود.
- score مساوی رتبه مساوی می‌گیرد؛ market key فقط ترتیب دیداری tie را پایدار می‌کند.
- بازار فاقد score با `MISSING/NO_MARKET_SCORE` باقی می‌ماند.
- score یتیم، lane ناسازگار، duplicate یا مجموعه score ناقص برای run تکمیل‌شده fail-closed است.
- scope جغرافیایی profile حفظ می‌شود و score هیچ مجوز ورود یا Human-Send ایجاد نمی‌کند.

### Evidence Matrix

- شش دسته ثابت Outreach، Data، AI Disclosure، Contract، Payment و Sanctions/KYC پوشش داده می‌شوند.
- precedence اصلی `UNKNOWN → FACT → INFERENCE → MISSING` است.
- FACT فقط از شاهد رسمی HTTPS و تازه می‌آید؛ FACT/INFERENCE منقضی یا نامعتبر وضعیت را ارتقا نمی‌دهد و در نبود شاهد واجدشرایط نتیجه MISSING است. UNKNOWN صریح تا زمان حل‌شدن UNKNOWN و blocker باقی می‌ماند.
- provenance URL قبل از خروج، credential/query/fragment را عبور نمی‌دهد.
- تمام cellها و همه gate stateها در Phase 1 مقدار `humanSend=BLOCKED` دارند.
- disclaimer «این ابزار جایگزین وکیل نیست.» بخشی از قرارداد است.

### Safe Audit Feed

- فقط event typeهای allowlisted پذیرفته می‌شوند و sequence باید از ابتدا contiguous باشد؛ gap، duplicate یا event ناشناخته fail-closed است.
- OWNER/OPERATOR projection جزئیات محدود و VIEWER فقط health metadata دریافت می‌کند.
- raw `details`، `actorId`، `tenantId` و `entityId` وارد payload نمی‌شوند.
- feed نزولی، cursor-based و با page size بین ۱ تا ۱۰۰ محدود است.
- endpoint فقط `auditBefore` و `auditLimit` را برای pagination می‌پذیرد.
- این بخش فقط projection امن است؛ DB-level immutability برای Growth audit در این Phase افزوده یا ادعا نشده است.

## مرز API

- `GET /api/dashboard` پس از authentication، RBAC و repository tenant scope، snapshot را به read model نسخه‌دار تبدیل می‌کند.
- snapshot خام، draft body، audit details، company rows یا identity security events برگردانده نمی‌شوند.
- پاسخ موفق `Cache-Control: private, no-store` دارد.
- integrity failure با HTTP `503` و payload ثابت `DASHBOARD_UNAVAILABLE` پاسخ می‌گیرد و علت/داده خام را echo نمی‌کند.
- route در build به‌صورت dynamic باقی مانده است.

## TDD و شواهد تازه

- چرخه‌های RED/GREEN ثبت‌شده برای:
  - نبود قرارداد و semantics اشتباه absent-as-zero؛
  - projection مصرف و ranking per-lane؛
  - FACT/INFERENCE/UNKNOWN/MISSING و expiry؛
  - tenant leak، non-synthetic data، outbound contradiction و summary خراب؛
  - redaction، pagination، Viewer access و audit integrity؛
  - cap violation، orphan score و wiring واقعی Route Handler.
- تست‌های هدفمند Dashboard: `2` فایل و `15` تست، همگی موفق.
- کل تست‌های غیرintegration: `26` فایل و `150` تست، همگی موفق.
- TypeScript strict (`tsc --noEmit`): موفق، صفر خطا.
- ESLint کامل: موفق، صفر خطا.
- build بهینه Next.js `16.3.4`: موفق؛ `/api/dashboard` dynamic است.

## فایل‌های Phase 1

- `src/modules/growth/application/dashboard-contracts.ts`
- `src/modules/growth/application/dashboard-read-model.ts`
- `src/app/api/dashboard/route.ts`
- `src/lib/api-response.ts`
- `tests/unit/dashboard-read-model.test.ts`
- `tests/unit/dashboard-route.test.ts`
- `docs/status/2026-09-04-dashboard-phase-1-status.md`

## موارد عمداً خارج از دامنه یا اثبات‌نشده

- هیچ UI یا تغییر CSS/component انجام نشده است.
- ledger روزانه، timezone/window واقعی و elapsed persistence ساخته نشده‌اند.
- export audit، provider، deployment، outbound gateway/credential و Human-Send ساخته یا فعال نشده‌اند.
- repository فعلی برای ساخت snapshot هنوز audit را پیش از projection به‌صورت کامل می‌خواند؛ response bounded است، اما query-level audit pagination یک gate مقیاس‌پذیری آینده است.
- DB-level append-only حفاظت Growth audit در این Phase وجود ندارد؛ فقط projection خروجی امن است.
- تست‌های PostgreSQL در این turn اجرا نشدند، زیرا `TEST_DATABASE_URL` از مسیر امن در محیط Leader تزریق نشده بود. هیچ credential حدس زده/ذخیره و هیچ database جدیدی ساخته نشد.
- مرورگر واقعی و accessibility acceptance اجرا نشدند، چون این Phase هیچ UI ندارد.

نتیجه: Dashboard Phase 1 در محدوده backend/read-model محلی پیاده‌سازی و با lint، typecheck، ۱۵۰ تست غیرintegration و build تأیید شده است؛ gate PostgreSQL و تمام قابلیت‌های UI/عملیاتی بعدی همچنان باز هستند.
