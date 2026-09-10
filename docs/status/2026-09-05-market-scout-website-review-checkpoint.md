# Checkpoint — Market Scout Website Review

**زمان توقف:** 2026-09-05  
**وضعیت:** متوقف طبق دستور مالک؛ فایل‌ها و تغییرات فعلی حفظ شدند.

## انجام‌شده

- اتصال خودکار `country + vertical` از Overpass تا بررسی وب‌سایت عمومی پیاده شد.
- قرارداد `manovaflow.market-scout.activity.v1` با run/agent/status/query/events/timestamps/freshness اضافه شد.
- robots، HTTPS، credential/port rejection، DNS/IP خصوصی، redirect دستی، timeout، request cap و response cap اعمال شد.
- متن HTML فقط به‌عنوان دادهٔ نامطمئن و با استخراج deterministic fact key پردازش می‌شود؛ دادهٔ تماس و متن خام در خروجی ذخیره نمی‌شود.
- هفت سایت هدف تلاش شدند: شش بررسی موفق و یک شکست fail-closed با `WEBSITE_RESPONSE_TOO_LARGE`.
- نخستین BriefFlow در timeout منبع شکست خورد و تنها retry محدود بعدی موفق شد.
- هزینه، Apollo، Contact Reveal، فرم، پیام و outbound همگی صفر باقی ماندند.

## ناتمام / مانع

- Hair Studio به‌دلیل عبور پاسخ از سقف ۲۵۶۰۰۰ بایت بررسی نشد؛ افزایش سقف یا دریافت range نیازمند تصمیم جداست.
- network-level egress allowlist و IP pinning وجود ندارد؛ DNS/IP پیش از هر fetch و redirect بررسی می‌شود، اما دفاع TOCTOU برای استقرار server-side کامل نیست.
- UI پنل، read API، مرورگر، `next build` و `next dev` عمداً در این task انجام نشدند و متعلق به مجریان دیگر هستند.
- هیچ نتیجه‌ای qualified lead، نیاز اثبات‌شده یا علاقهٔ مشتری محسوب نمی‌شود.

## فایل‌های این مرحله

- `src/modules/growth/application/market-scout-activity.ts`
- `src/modules/growth/application/market-scout-website-review.ts`
- `src/modules/growth/application/live-market-scout-pilot.ts`
- `src/modules/growth/infrastructure/public-website-reviewer.ts`
- `src/modules/growth/infrastructure/overpass-market-scout-source.ts`
- `scripts/run-market-scout-pilot.ts`
- `tests/unit/market-scout-activity.test.ts`
- `tests/unit/public-website-reviewer.test.ts`
- `tests/unit/live-market-scout-pilot.test.ts`
- `tests/unit/overpass-market-scout-source.test.ts`
- `docs/status/2026-09-05-market-scout-live-open-data-pilot.md`
- `docs/status/2026-09-05-market-scout-public-website-review.md`

## شواهد و تست

- اجرای زنده: ServiceFlow سه سایت موفق؛ BeautyFlow دو موفق و یک response-cap failure؛ BriefFlow یک سایت موفق پس از یک retry محدود منبع.
- آخرین gate اجراشده پیش از دستور توقف: پنج فایل تست واحد Market Scout، ۱۶ تست pass؛ ESLint فایل‌های محدوده بدون error؛ `tsc --noEmit` pass.
- `next build/dev` و تست مرورگر طبق مالکیت QA اجرا نشد.
- گزارش شواهد: `docs/status/2026-09-05-market-scout-public-website-review.md`.

## قدم بعدی پیشنهادی پس از دستور صریح جدید

1. مصرف قرارداد activity توسط پنل مستقل و read API احراز‌شده/tenant-scoped را هماهنگ و فقط در مالکیت مجری مربوطه پیاده‌سازی کنید.
2. دربارهٔ Hair Studio تصمیم بگیرید: حفظ unresolved یا یک strategy محدود Range بدون افزایش سقف.
3. پیش از هر استقرار server-side، IP pinning/egress policy را به‌عنوان gate امنیتی اضافه و تست کنید.

هیچ فرآیند موقتی متعلق به این task فعال نمانده و هیچ فرآیند دیگر، lock، host یا انتشار تغییر نکرده است.
