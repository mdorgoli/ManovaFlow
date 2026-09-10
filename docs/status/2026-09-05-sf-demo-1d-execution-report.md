# گزارش اجرای SF-DEMO-1D

- تاریخ: ۲۰۲۶-۰۹-۰۵
- محدوده: API محلی ServiceFlow و reset قطعی دموی synthetic
- وضعیت: تکمیل‌شده در محدودهٔ دستور لیدر؛ UI و سایت عمومی خارج از این برش‌اند

## نتیجه

چهار Route Handler محلی اضافه شد:

- `GET /api/serviceflow` برای snapshot خصوصی tenant جاری؛
- `POST /api/serviceflow/reset` برای بازسازی قطعی دادهٔ دمو؛
- `POST /api/serviceflow/requests` برای intake کاملاً synthetic؛
- `POST /api/serviceflow/requests/[requestId]/commands` برای approve، start، block، resume، evidence، complete و close.

هویت در همهٔ routeها فقط از `resolveRequestActor` و session/membership معتبر سرور می‌آید. body و header اجازهٔ تعیین `tenantId`، `actorId` یا role ندارند. headerهای هویتی کنترل‌شده توسط کلاینت رد می‌شوند؛ mutation فقط برای Owner/Operator و با `Idempotency-Key` محدود و معتبر مجاز است. Viewer فقط snapshot tenant خود را می‌خواند.

API فقط در `DEMO_MODE=true` و محیط غیرproduction فعال است. خطاهای cross-tenant با پاسخ عمومی 404 و بدون افشای وجود یا وضعیت رکورد برگردانده می‌شوند؛ خطاهای ناشناخته نیز متن داخلی را افشا نمی‌کنند.

reset فقط state tenant احراز‌شده را حذف و دقیقاً دو درخواست ثابت می‌سازد:

- درخواست عادی در `REVIEW` با proposal؛
- درخواست دارای نشانهٔ خطر در `BLOCKED/POSSIBLE_EMERGENCY` بدون proposal.

شناسه‌ها، زمان‌ها، ترتیب eventها و نتیجهٔ snapshot قطعی‌اند. اجرای دوبارهٔ reset، حتی پس از mutation و با همان key، همان baseline را بازمی‌سازد. request، audit، approval، assignment، evidence و idempotency tenantهای دیگر دست‌نخورده می‌مانند.

## فایل‌های تغییرکرده یا افزوده‌شده

- `src/app/api/serviceflow/route.ts`
- `src/app/api/serviceflow/reset/route.ts`
- `src/app/api/serviceflow/requests/route.ts`
- `src/app/api/serviceflow/requests/[requestId]/commands/route.ts`
- `src/lib/serviceflow-api.ts`
- `src/lib/api-policy.ts`
- `src/lib/container.ts`
- `src/modules/growth/domain/rbac.ts`
- `src/modules/serviceflow/demo/fixtures.ts`
- `src/modules/serviceflow/domain/types.ts`
- `src/modules/serviceflow/application/repository.ts`
- `src/modules/serviceflow/application/service.ts`
- `src/modules/serviceflow/infrastructure/in-memory-repository.ts`
- `src/modules/serviceflow/index.ts`
- `tests/unit/serviceflow-reset.test.ts`
- `tests/unit/serviceflow-api.test.ts`
- `tests/unit/api-policy.test.ts`

## شواهد اجرای تازه

- راهنمای Route Handler و Vitest از نسخهٔ محلی Next پیش از کدنویسی خوانده شد.
- TDD RED reset: هر ۳ آزمون به‌علت نبود capability شکست خورد.
- TDD RED policy: هر ۲ آزمون جدید به‌علت نبود مجوزهای ServiceFlow شکست خورد.
- TDD RED routeها: هر ۶ آزمون اولیه به‌علت نبود routeها شکست خورد.
- آزمون‌های متمرکز API، reset، ServiceFlow و مرز هویت: ۸ فایل، ۱۰۴ از ۱۰۴ تست پاس.
- رگرسیون کامل محلی با حذف صریح `tests/integration/**`: ۳۵ فایل، ۲۴۹ از ۲۴۹ تست پاس.
- TypeScript: `tsc --noEmit` پاس.
- ESLint کامل پروژه: پاس.

## مرز ادعا

این خروجی API محلی و in-memory دموی synthetic است. UI، سایت عمومی، upload، URL evidence، فایل واقعی، PostgreSQL operational migration، provider/connector، پیام، تماس، خرید، deploy، لوگو و laneهای پژوهشی ساخته یا تغییر رفتاری داده نشدند. هیچ فراخوانی شبکه یا Apollo انجام نشد و اعتبار Apollo مصرف نشد. این مرحله ادعای production-ready یا pilot-ready بودن ServiceFlow نیست.
