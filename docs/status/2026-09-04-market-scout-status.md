# وضعیت واقعی Market Scout چندبازاری

- وضعیت: `LOCAL_CORE_VERIFIED`
- دامنه: coordinator و workerهای محلی برای ماتریس `۳ lane × ۴ market`؛ بدون provider واقعی، fetch شبکه، route عملیاتی، scheduler، deploy یا اقدام بیرونی.
- این گزارش ادعای اتصال زنده Apollo، کشف واقعی مشتری یا production readiness نیست.

## پیاده‌سازی

- `MarketScoutSource` یک port فقط‌خواندنی و تزریق‌پذیر است. خروجی آن در runtime نامطمئن فرض و قبل از ورود به هسته validate می‌شود.
- coordinator پیش از هر source call مجوز `RUN_RESEARCH`، batch key و concurrency بین ۱ تا ۱۲ را کنترل می‌کند.
- taskها به ترتیب پایدار lane و market ساخته و با worker pool محدود اجرا می‌شوند؛ concurrency پیش‌فرض ۴ است.
- سقف `sourceUrls` و `organizations` هر manifest به‌صورت قطعی میان marketهای همان lane تقسیم می‌شود و مجموع سهم‌ها دقیقاً برابر سقف manifest است.
- هر source envelope دارای سقف زمان، `paidSpend=0` و محدودیت شمارنده است؛ envelope خراب، پرهزینه یا بیش‌ازبودجه فقط همان worker را fail می‌کند.
- فقط `OFFICIAL_REGISTRY`، `PUBLIC_COMPANY_WEBSITE`، `OFFICIAL_ASSOCIATION` و `OFFICIAL_PROCUREMENT` پذیرفته می‌شوند؛ `WARM_REFERRAL`، `SYNTHETIC`، PII/فیلد اضافه، URL خصوصی یا credentialدار و ناسازگاری lane/market/country رد می‌شوند.
- candidateهای پذیرفته‌شده به `runAllLanes` موجود تحویل می‌شوند؛ dedupe، suppression، scoring، Compliance Gate، ذخیره draft و audit در مسیرهای موجود باقی مانده‌اند.
- یک نقص TDD آشکار و رفع شد: domain تکراری از دو worker بازار در یک lane قبلاً دو shortlist row و دو draft تولید می‌کرد؛ اکنون اولین رکورد پردازش و تکرار بعدی با `TENANT_DEDUPLICATED` حذف می‌شود.

## زبان

- زبان‌های خروجی دقیقاً `en`، `fr` و `ar` هستند.
- تشخیص از متن عمومی NFKC-normalized و حداکثر ۴۰۰۰ کاراکتر انجام می‌شود؛ متن مبهم به اولین locale پشتیبانی‌شده بازار و سپس English fallback می‌کند.
- French و English برابر `LTR` و Arabic برابر `RTL` هستند.
- shortlist metadata شامل language، direction و basis است.
- متن subject/body پیش‌نویس داخلی به زبان تشخیص‌داده‌شده تولید می‌شود. projection پیش‌نویس `state=INTERNAL_ONLY` و `outboundEnabled=false` دارد.
- پوسته اصلی محصول و فایل‌های UI تغییر نکردند و اسکن آن‌ها هیچ literal فارسی پیدا نکرد؛ رابط اصلی English-only باقی مانده است.

## مرز ایمنی

- نتیجه coordinator صریحاً `humanSend=BLOCKED` است.
- تمام Compliance Decisionهای Human-Send در fixture فعلی `HUMAN_SEND_BLOCKED` و تمام authorization tokenها `null` هستند.
- aggregate و همه lane reportها `outboundActions=0` دارند.
- اسکن فایل‌های جدید هیچ `fetch(`، Apollo، provider، credential، contact، phone، email، `send(` یا outbound gateway پیدا نکرد.
- هیچ فایل route، provider adapter، public-site style یا deployment artifact برای این قابلیت ساخته نشد.

## وضعیت Apollo.io

- پس از اعلام ثبت‌نام و اتصال نیز هیچ ابزار دارای نام Apollo در inventory فعال این task وجود نداشت.
- دو درخواست نصب با شناسه `apollo@openai-curated-remote` با خطای دقیق `plugin_id must match one of the entries in the <recommended_plugins> list` رد شدند.
- بنابراین آزمون خواندنی Apollo اجرا نشد و هیچ credit مصرف نشد.

## شواهد TDD

- RED شماره ۱: دو suite زبان/worker به‌علت نبود module شکست خوردند.
- GREEN شماره ۱: `2` فایل و `11` تست موفق.
- RED شماره ۲: suite coordinator به‌علت نبود module شکست خورد.
- GREEN شماره ۲: `3` فایل و `15` تست موفق؛ تکرار دوم نیز `15/15` موفق.
- RED شماره ۳: end-to-end مقدار `humanSend=BLOCKED` را انتظار داشت و `undefined` دریافت کرد.
- RED شماره ۴: تست dedupe انتظار یک shortlist row داشت و دو ردیف دریافت کرد.
- GREEN متمرکز همراه regressionهای orchestration: `6` فایل و `24` تست موفق.

## راستی‌آزمایی تازه

- ESLint کامل: موفق، exit code صفر.
- TypeScript strict: موفق، exit code صفر.
- تمام تست‌های غیرintegration: `30` فایل و `175` تست، همگی موفق.
- build بهینه Next.js `16.3.4`: موفق؛ route جدیدی اضافه نشد.
- اجرای اولیه build داخل sandbox در مرحله TypeScript با `spawn EPERM` متوقف شد؛ اجرای مجاز خارج از sandbox کامل و با exit code صفر تمام شد.
- `TEST_DATABASE_URL` در environment موجود نبود؛ تست PostgreSQL اجرا نشد. این قابلیت schema یا migration پایگاه‌داده را تغییر نمی‌دهد، اما gate یکپارچگی دیتابیس همچنان خارج از شواهد این گزارش است.

## فایل‌ها

- `src/modules/growth/application/market-scout-contracts.ts`
- `src/modules/growth/application/market-scout-language.ts`
- `src/modules/growth/application/market-scout-worker.ts`
- `src/modules/growth/application/market-scout-coordinator.ts`
- `src/modules/growth/application/run-lane.ts`
- `src/modules/growth/application/run-parallel.ts`
- `tests/unit/market-scout-language.test.ts`
- `tests/unit/market-scout-worker.test.ts`
- `tests/unit/market-scout-coordinator.test.ts`
- `tests/e2e/market-scout-research-only.test.ts`

نتیجه: هسته Market Scout در محدوده محلی و provider-neutral پیاده‌سازی و تأیید شده است؛ اتصال زنده Apollo، داده واقعی، ارسال و هر عملیات بیرونی همچنان غیرفعال و خارج از این checkpoint هستند.
