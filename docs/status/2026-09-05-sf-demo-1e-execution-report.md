# گزارش اجرای SF-DEMO-1E

- تاریخ: ۲۰۲۶-۰۹-۰۵
- محدوده: UI کلیک‌پذیر محلی ServiceFlow روی API و reset تحویل‌شده در SF-DEMO-1D
- وضعیت: تکمیل‌شده در محدودهٔ دستور لیدر؛ فقط مسیر مستقل `/serviceflow`

## نتیجه

یک کنسول عملیاتی مستقل و واکنش‌گرا برای ServiceFlow ساخته شد که با English به‌عنوان زبان پیش‌فرض، Français و العربية کار می‌کند. انتخاب عربی روی ریشهٔ همین تجربه `lang="ar"` و `dir="rtl"` واقعی اعمال می‌کند. تغییر زبان فقط ارائه را عوض می‌کند و snapshot، case انتخاب‌شده و workflow state را reset نمی‌کند؛ پیام‌های وضعیت موجود نیز بدون درخواست شبکه دوباره ترجمه می‌شوند.

UI به‌صورت واضح با `DEMO · SYNTHETIC DATA · NO OUTBOUND` برچسب‌گذاری شده و شامل موارد زیر است:

- صف دو case ثابت synthetic و شاخص‌های عملیاتی؛
- نمایش مستقل Proposal و Assignment، با عبارت صریح recommendation-only پیش از تأیید انسانی؛
- reason انسانی اجباری با پیشوند `DEMO:` برای mutationهای تصمیمی؛
- approve، start، block، resume، افزودن evidence داخلی، complete و close مطابق state؛
- قفل غیرقابل‌کلیک برای case خطرناک `POSSIBLE_EMERGENCY`؛
- timeline ممیزی شامل actor، زمان، transition و reason؛
- reset قطعی tenant جاری و حفظ زبان انتخاب‌شده.

کلاینت هیچ `tenantId`، `actorId` یا role ارسال نمی‌کند. همهٔ درخواست‌ها same-origin هستند، mutationها `Idempotency-Key` مستقل دارند و در صورت وجود CSRF cookie معتبر، مقدار آن فقط در `x-csrf-token` بازتاب داده می‌شود. احراز هویت، membership، RBAC، tenant scope و قفل hazard همچنان در سمت سرور اعمال می‌شوند. خطاهای UI متن داخلی پاسخ سرور را نمایش نمی‌دهند و state فعلی را حفظ می‌کنند.

## فایل‌های این برش

- `src/app/serviceflow/page.tsx`
- `src/components/serviceflow-demo.tsx`
- `src/components/serviceflow-demo.module.css`
- `src/modules/serviceflow/index.ts` (فقط export نوع `ServiceRequestState`)
- `tests/unit/serviceflow-demo-ui.test.tsx`

صفحهٔ عمومی `src/app/page.tsx`، استایل عمومی Growth در `src/app/globals.css`، لوگو و مسیر `/` در این برش ویرایش نشدند.

## شواهد TDD و کیفیت

- RED اولیه: suite رابط کاربری به‌علت نبود `@/components/serviceflow-demo` در transform متوقف شد؛ capability هنوز وجود نداشت.
- پس از پیاده‌سازی، ۶ آزمون گذشت و ۳ assertion تک‌نمونه‌ای به‌علت نمایش درست state در چند محل شکست خورد؛ assertionها به کنترل «حداقل یک نمونه» اصلاح شدند.
- بررسی مرورگر یک نقص بازترجمهٔ notice پس از تغییر زبان را آشکار کرد؛ regression test ابتدا قرمز شد، سپس notice به‌صورت کلید ترجمه ذخیره شد و تست سبز شد.
- آزمون متمرکز UI: ۱ فایل، ۹ از ۹ پاس.
- رگرسیون کامل محلی با حذف صریح `tests/integration/**`: ۳۶ فایل، ۲۵۸ از ۲۵۸ پاس.
- TypeScript: `tsc --noEmit` پاس.
- ESLint کامل پروژه: پاس، بدون warning.
- build تولیدی Next.js 16.3.4 با Turbopack: پاس؛ `/serviceflow` به‌عنوان route پویا ثبت شد.

## اعتبارسنجی واقعی مرورگر

سرور توسعه فقط روی `127.0.0.1:3000` و با DemoAuth server-side معتبر اجرا شد:

- `DEMO_MODE=true`
- tenant و actor ثابت UUID synthetic
- role برابر `OWNER`

هویت در header، body یا client state تزریق نشد. نتیجهٔ مرورگر:

- دسکتاپ `1440×900`: صفحه، دو case، تفکیک Proposal/Assignment، metrics و timeline بدون شکست چیدمان نمایش داده شدند.
- موبایل `390×844`: چیدمان responsive و Arabic RTL واقعی نمایش داده شد؛ صف و metrics به ستون‌های موبایل تبدیل شدند.
- دو reset متوالی پاسخ ۲۰۰ دادند و baseline یکسان شامل ۲ case، ۱ safety hold و ۵ audit event باقی ماند؛ یک reset اضافی پس از اصلاح hot-reload، حفظ عربی و notice عربی را تأیید کرد.
- case خطرناک در مرورگر با Safety Lock و دکمهٔ disabled نمایش داده شد.
- console مرورگر: صفر error و صفر warning.
- viewport آزمایشی در پایان reset و سرور محلی موقت متوقف شد.

## مرز ادعا

این خروجی یک UI محلی و synthetic است، نه سرویس production یا pilot. اتصال واقعی provider/connector، ارسال پیام یا تماس، upload/URL evidence، PostgreSQL operational persistence، deploy، پرداخت، دادهٔ واقعی و تغییر سایت عمومی انجام نشد. هیچ دسترسی شبکهٔ خارجی یا استفاده از Apollo صورت نگرفت و هیچ اعتبار Apollo مصرف نشد.
