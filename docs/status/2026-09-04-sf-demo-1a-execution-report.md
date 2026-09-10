# گزارش اجرای `SF-DEMO-1A`

- تاریخ اجرا: ۲۰۲۶-۰۹-۰۴
- محدوده: هستهٔ مستقل و محلی ServiceFlow برای intake ساختگی، ارزیابی policy و پیشنهاد مسئول
- نتیجه: **محدودهٔ درخواستی `SF-DEMO-1A` تکمیل و تأیید شد**
- مرجع پذیرش: `docs/status/2026-09-04-serviceflow-90-second-demo-gap-audit.md`

## خروجی اجرایی

یک ماژول مستقل در `src/modules/serviceflow` ساخته شد که به `modules/growth` وابسته نیست و رفتار سه lane پژوهشی موجود را تغییر نمی‌دهد. ورودی‌ها و تکنسین‌ها در runtime به دادهٔ visibly synthetic و `DEMO` محدود شده‌اند و هیچ فیلد هویتی مشتری در قرارداد intake وجود ندارد.

مسیر اجرایی این برش:

1. دریافت درخواست ساختگی و نرمال‌سازی قطعی payload؛
2. ارزیابی نسخه‌دارِ ایمنی، کامل‌بودن، خدمت، منطقه و ساعات؛
3. توقف fail-closed برای خطر صریح، ایمنی مبهم/نامشخص یا محدودیت‌های خدمت؛
4. انتخاب قطعی تکنسین synthetic واجد شرایط بر اساس active/skill/area/hour؛
5. تولید `AssignmentProposal` توضیح‌دار بدون ایجاد assignment؛
6. ثبت اتمیک request، idempotency و audit tenant-scoped در repository حافظه‌ای.

## فایل‌های ساخته‌شده

- `src/modules/serviceflow/index.ts`
- `src/modules/serviceflow/domain/types.ts`
- `src/modules/serviceflow/domain/schema.ts`
- `src/modules/serviceflow/domain/policy.ts`
- `src/modules/serviceflow/application/repository.ts`
- `src/modules/serviceflow/application/service.ts`
- `src/modules/serviceflow/infrastructure/in-memory-repository.ts`
- `tests/unit/serviceflow-intake.test.ts`
- `docs/status/2026-09-04-sf-demo-1a-execution-report.md`

## پوشش سناریوهای پذیرش

| سناریو | نتیجهٔ پیاده‌سازی‌شده |
|---:|---|
| ۲ | درخواست کامل، امن و داخل دامنه به `REVIEW` می‌رود؛ گذار `NEW → REVIEW` و هر پنج نتیجهٔ policy در audit ثبت می‌شود. |
| ۳ | شرح، آدرس یا خدمت ناقص به `NEEDS_INFO` می‌رود؛ فهرست فیلدهای ناقص و checkهای اجراشده/نشده ثبت و proposal حذف می‌شود. |
| ۴ | خدمت خارج از allowlist با `OUT_OF_SCOPE_SERVICE` مسدود می‌شود. |
| ۵ | منطقهٔ خارج از پوشش با `OUT_OF_SERVICE_AREA` مسدود می‌شود. |
| ۶ | ساعت خارج از بازهٔ ثابت با `OUTSIDE_SUPPORTED_HOURS` مسدود می‌شود. |
| ۷ | واژگان خطر صریح انگلیسی/فارسی با تقدم قطعی به `POSSIBLE_EMERGENCY` و بدون proposal می‌رسند. |
| ۸ | عبارت ایمنی مبهم یا assessment برابر `UNKNOWN` به `SAFETY_UNKNOWN` و حالت fail-closed می‌رسد. |
| ۹ | تنها تکنسین فعالِ مطابق skill/area/hour همراه policy version، rule version و explanation پیشنهاد می‌شود. |
| ۱۰ | در تساوی، شناسهٔ تکنسین tie-break قطعی است و ارزیابی تکراری نتیجهٔ یکسان دارد. |
| ۱۱ | نبود تکنسین واجد شرایط به `NO_ELIGIBLE_ASSIGNEE` می‌رسد؛ شمارندهٔ exception tenant-scoped است و با replay/reevaluate کاذب افزایش نمی‌یابد. |
| ۱۲ | proposal در `REVIEW` باقی می‌ماند؛ `ownerId` و `assigneeId` تهی و `outboundActionCount` صفر هستند. |
| ۱۵ | read و reevaluate بین tenantها همان خطای غیر‌افشاگر not-found را می‌دهند و هیچ mutation یا audit ایجاد نمی‌کنند. |
| ۱۶، بخش create | یک idempotency key با payload نرمال‌شدهٔ یکسان همان نتیجه را بدون request/event تکراری برمی‌گرداند؛ استفادهٔ همان کلید با payload متفاوت صریحاً رد می‌شود. |

## تضمین‌های repository

- کلیدهای request و idempotency با `tenantId` ترکیب شده‌اند.
- شناسه‌های actor، tenant، request و audit در runtime محدود و اعتبارسنجی می‌شوند.
- برخورد شناسهٔ request در همان tenant پیش از هر mutation رد می‌شود.
- request، idempotency، دو رویداد create/evaluate، sequence و شناسه‌های audit ابتدا کامل stage و سپس یک‌جا commit می‌شوند.
- شکست تولید شناسه/زمان یا برخورد audit ID هیچ state نیمه‌ثبت‌شده‌ای باقی نمی‌گذارد و retry سالم ممکن است.
- خروجی‌ها، catalog تکنسین و audit با clone دفاعی از state داخلی جدا هستند.
- audit برای هر tenant sequence مستقل، actor، گذار، نسخهٔ policy، نتایج کامل checkها، دلیل block، missing fields و وجود/عدم وجود proposal را نگه می‌دارد.

## شواهد TDD و تأیید نهایی

چرخه‌های RED واقعی شامل نبود ماژول، نبود metric، تقدم نادرست safety، برخورد request ID، ضعف مرز synthetic، mutation catalog، marker خالی `DEMO:`, اتمی‌نبودن audit و نبود snapshot کامل policy در audit بودند. هر دسته ابتدا با تست شکست خورد و سپس با کمترین تغییر در همان محدوده سبز شد.

نتایج تازه روی وضعیت نهایی:

- تست متمرکز: **۱ فایل از ۱ و ۳۲ تست از ۳۲ پاس**.
- رگرسیون کامل غیرintegration: **۳۱ فایل از ۳۱ و ۲۰۷ تست از ۲۰۷ پاس**؛ سه lane موجود سبز ماندند.
- TypeScript: `tsc --noEmit` با exit code صفر.
- lint محدوده: `src/modules/serviceflow` و `tests/unit/serviceflow-intake.test.ts` با exit code صفر.
- بازبینی مستقل نهایی: هیچ یافتهٔ blocker/high/medium در محدودهٔ اصلاح‌شده باقی نماند.

lint کل workspace سبز نیست، اما شکست خارج از این task و در فایل موجود `docs/design/brand-assets/render-assets.cjs` است: چهار خطای `@typescript-eslint/no-require-imports` در خطوط ۲ تا ۵. این فایل برای حفظ مرز کار تغییر نکرد.

## خارج از محدوده و محدودیت‌های صریح

- UI، API، approval، assignment mutation، start، evidence، complete و close ساخته نشدند.
- migration یا persistence تولیدی ساخته نشد؛ repository فعلی عمداً in-memory و تک‌فرآیندی است.
- safety یک policy واژگانی/ساختاری محدود و قطعی برای دموی synthetic است، نه درک عمومی زبان یا سامانهٔ ایمنی تولیدی.
- هیچ provider، پیام، تماس، ایمیل، WhatsApp، پرداخت، خرید، deploy یا outreach اجرا نشد.
- هیچ Apollo credit، Contact Reveal یا دادهٔ شخصی مصرف/دریافت نشد.
- `D:\ManovaFlow` در زمان اجرا Git repository نبود؛ بنابراین commit، branch، merge یا PR ایجاد نشد.

## وضعیت نهایی

`SF-DEMO-1A` در محدودهٔ تعریف‌شده آماده است: intake ساختگی، policyهای قطعی، proposal بدون assignment، repository حافظه‌ای چندمستاجری/idempotent/اتمیک و تست‌های سناریوهای ۲ تا ۱۲، ۱۵ و بخش create سناریوی ۱۶. این نتیجه به‌معنای تکمیل کل `SF-DEMO-1` یا آمادگی production/pilot نیست.
