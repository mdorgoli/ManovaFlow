# گزارش اجرای SF-DEMO-1B

- تاریخ: ۲۰۲۶-۰۹-۰۵
- محدوده: هستهٔ محلی و synthetic تأیید انسانی proposal و ایجاد assignment
- وضعیت: تکمیل‌شده در محدودهٔ تأییدشده؛ بدون API، UI، persistence تولیدی یا outbound

## نتیجه

درخواست `REVIEW` فقط با proposal جاری و امن، actor معتبر با نقش `OWNER` یا `OPERATOR` در همان tenant، دلیل انسانی معتبر و کلید idempotency پذیرفته می‌شود. عملیات به‌صورت اتمیک دو رویداد `REVIEW → APPROVED` و `APPROVED → ASSIGNED` را ثبت می‌کند و approval و assignment نام‌دار می‌سازد. خود proposal همچنان recommendation است و به‌تنهایی assignment ایجاد نمی‌کند.

کلید idempotency تأیید علاوه بر command به `actorId` و role همان تأییدکننده متصل است؛ بنابراین بازپخش همان کلید توسط principal دیگری در همان tenant نیز fail-closed می‌شود.

## پوشش سناریوهای پذیرفته‌شده

| سناریو | پوشش این مرحله |
|---:|---|
| ۱۳ | Owner و Operator همان tenant با actor و reason معتبر؛ approval و assignment اتمیک و audit‌شده. بخش API عمداً خارج از SF-DEMO-1B است. |
| ۱۴ | Viewer forbidden؛ request، approval، assignment و event sequence بدون تغییر. |
| ۱۵ | actor tenant دیگر پاسخ non-disclosing `not found` می‌گیرد و هیچ mutation یا audit رخ نمی‌دهد. |
| ۱۶ (نیمهٔ approve) | replay همان actor/key/command همان نتیجه را بدون رکورد یا event تکراری برمی‌گرداند؛ reuse متعارض یا توسط principal دیگر رد می‌شود. |
| ۱۷ | proposal stale/دست‌کاری‌شده و transition مانند `blocked → assigned` رد می‌شود؛ state اتمیک می‌ماند و دلیل رد audit می‌شود. |

همچنین re-evaluation نمی‌تواند request دارای state `ASSIGNED` را دوباره به `REVIEW` برگرداند و failure هنگام staging هیچ state، approval، assignment، idempotency record یا audit ناقصی commit نمی‌کند.

## فایل‌های تغییرکرده

- `src/modules/serviceflow/domain/types.ts`
- `src/modules/serviceflow/domain/schema.ts`
- `src/modules/serviceflow/application/repository.ts`
- `src/modules/serviceflow/application/service.ts`
- `src/modules/serviceflow/infrastructure/in-memory-repository.ts`
- `src/modules/serviceflow/index.ts`
- `tests/unit/serviceflow-approval.test.ts`

## شواهد اجرای تازه

- دروازهٔ اولیه: اجرای کامل ESLint با binary نصب‌شدهٔ محلی و بدون network wrapper — پاس.
- TDD RED اولیهٔ معتبر: ۱۴ از ۱۴ آزمون approval به علت نبود capability شکست خوردند. پس از پیاده‌سازی، یک آزمون امنیتی مستقل برای اتصال idempotency به principal نیز ابتدا به‌طور معتبر شکست خورد و سپس با اصلاح پیاده‌سازی سبز شد.
- آزمون متمرکز approval: ۱ فایل، ۱۶ از ۱۶ تست پاس.
- رگرسیون کامل محلی با حذف صریح `tests/integration/**`: ۳۲ فایل، ۲۲۳ از ۲۲۳ تست پاس.
- TypeScript: `tsc --noEmit` پاس.
- ESLint کامل پروژه: پاس.

## مرز ادعا

این خروجی فقط هستهٔ in-memory و تک‌پردازهٔ دموی synthetic است. API، UI، start، block/resume، completion evidence، complete، close، reset، migration عملیاتی PostgreSQL، provider/connector، دادهٔ واقعی، پیام، تماس، خرید، deploy و laneهای Growth در این مرحله ساخته یا تغییر داده نشدند. شمار outbound action و مصرف اعتبار Apollo صفر باقی ماند. این نتیجه ادعای production-ready یا pilot-ready بودن ServiceFlow نیست.
