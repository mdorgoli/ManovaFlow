# آزمون محلی جست‌وجوی خودرو اهواز

مالک آماده‌سازی: مهندس جست‌وجوی منووا فلو. این سند اصلاح محلی، آزمون کد و نتیجه اجرای واقعی ثبت‌شده در خود برنامه را مستند می‌کند. نتیجه منبع، مشاهده پژوهشی است و مشتری یا نمایشگاه مستقل تأییدشده محسوب نمی‌شود.

## اجرای داخل برنامه

- صفحه: `http://127.0.0.1:3000/market-scout#ahvaz-car-scout`
- دکمه: «اجرای جست‌وجوی واقعی اهواز»
- خواندن وضعیت: `GET /api/market-scout/ahvaz-cars`؛ هیچ تماس با منبع انجام نمی‌دهد.
- اجرا: `POST /api/market-scout/ahvaz-cars` با JSON دقیق `{"scope":"AHVAZ-CAR-SCOUT-1"}` و هدر `Idempotency-Key: ahvaz-car-scout-1-osm-v1`.
- برای آزمون مرورگر، ابتدا صفحه را دوباره بارگذاری کنید. دکمه تا پایان خواندن وضعیت و هنگام درخواست غیرفعال است. یک کلیک یک تلاش منبع را ثبت می‌کند. تازه‌سازی فقط گزارش همان تلاش را می‌خواند.

در صورت نیاز به اجرای همان فرمان با PowerShell، فرمان زیر همان API برنامه را اجرا می‌کند. این فرمان طی آماده‌سازی اجرا نشده است:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/market-scout/ahvaz-cars' -Method Post -ContentType 'application/json' -Headers @{ 'Idempotency-Key' = 'ahvaz-car-scout-1-osm-v1' } -Body '{"scope":"AHVAZ-CAR-SCOUT-1"}'
```

## منبع و محدوده

منبع، endpoint ثابت عمومی `https://overpass-api.de/api/interpreter` است. HTTP POST تنها حامل کوئری خواندن OpenStreetMap است. کوئری از هیچ نام از پیش آماده، دامنه، شماره تماس یا نتیجه تحقیق دستی استفاده نمی‌کند. خودرو یک موضوع پژوهشی مستقل است؛ به ServiceFlow، BeautyFlow یا BriefFlow نگاشت نمی‌شود و هیچ candidate/lead/qualification/draft ایجاد نمی‌کند.

کادر انتخاب‌شده، با ترتیب جنوب، غرب، شمال، شرق، `31.15, 48.40, 31.60, 48.95` است. این انتخاب محدوده پژوهش است، نه مرز رسمی اهواز. پوشش نمایشگاه‌ها و شهرک‌های خودرویی صرفاً به ثبت شدن آن‌ها در OSM، قرار گرفتن در کادر و تگ `shop=car` وابسته است. کد ادعای فهرست کامل نمی‌کند. مرکز کادر هندسی way/relation نیز باید داخل این محدوده باشد.

```overpass
[out:json][timeout:20][maxsize:33554432];
nwr(31.15,48.4,31.6,48.95)["shop"="car"];
convert car_observation osm_id=id(),osm_type=type(),name=t["name"],name_fa=t["name:fa"],category=t["shop"],latitude=lat(),longitude=lon(),website=t["website"],contact_website=t["contact:website"];
out tags 201;
```

شناسه خودکار عنصر تبدیل‌شده Overpass برای هویت کسب‌وکار استفاده نمی‌شود. `osm_type` و `osm_id` اصلی به هویت `osm:{type}:{id}` و لینک عمومی متناظر تبدیل می‌شوند؛ دو ردیف دارای دامنه مشترک حذف نمی‌شوند. شناسه تکراری OSM کنار گذاشته می‌شود.

مبنای فنی: [تعریف رسمی shop=car](https://wiki.openstreetmap.org/wiki/Tag:shop%3Dcar)، [مرجع Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)، [محدوده نقشه](https://www.openstreetmap.org/export?bbox=48.4,31.15,48.95,31.6). داده با انتساب به مشارکت‌کنندگان OpenStreetMap و [مجوز ODbL 1.0](https://www.openstreetmap.org/copyright) نمایش داده می‌شود.

## معنای نتیجه

- `RECORDED`: لینک HTTP/HTTPS عمومی از `website` یا `contact:website` در منبع ثبت شده؛ محتوای سایت و مالکیت لینک بررسی نشده است.
- `NOT_RECORDED`: «لینک سایت در منبع ثبت نشده / نیازمند بررسی». این وضعیت به معنی «سایت ندارد» نیست.
- `REJECTED_UNSAFE`: تگ سایت وجود داشت ولی URL قابل نمایش ایمن نبود؛ URL خام ذخیره/نمایش داده نمی‌شود.
- `EMPTY`: منبع با پاسخ معتبر هیچ رکوردی برنگرداند؛ نبود نمایشگاه در واقعیت استنتاج نمی‌شود.
- `NO_ACCEPTED_ROWS`: رکورد دریافت شد اما تمام ردیف‌های بررسی‌شده رد شدند؛ شمارنده علت‌ها موجود است.
- `FAILED`: خطای شبکه، HTTP، timeout، runtime منبع، پاسخ بیش از حد یا پاسخ نامعتبر. با نتیجه خالی یکی نمی‌شود.

گزارش شامل شناسه اجرا، زمان شروع/پایان، تعداد تلاش واقعی HTTP، کد پاسخ HTTP دریافت‌شده یا null، زمان مشاهده، زمان نسخه OSM در صورت ارائه، هویت و لینک شاهد عمومی و شمارنده ردیف‌هاست. HTTP 200 همراه `remark` خطای runtime موفقیت محسوب نمی‌شود. هیچ متنی از خطای خام منبع در گزارش افشا نمی‌شود. هر نام و URL دریافتی داده غیرقابل‌اعتماد است و فقط با React و قرارداد سخت‌گیرانه نمایش داده می‌شود.

## حدود و کنترل‌ها

- یک درخواست منبع در هر تلاش؛ بدون retry، redirect، خزش سایت یا provider پولی.
- سقف منبع: ۲۰۱ ردیف خام برای تشخیص محدودشدن؛ نمایش حداکثر ۲۰۰ ردیف. رسیدن به سقف در UI مشخص است.
- سقف زمان منبع: ۳۰ ثانیه در worker و ۲۰ ثانیه در کوئری؛ سقف پاسخ ۵۱۲٬۰۰۰ بایت هنگام stream، حتی بدون Content-Length.
- فقط فیلدهای انتخاب‌شده عمومی از Overpass؛ phone/email/contactName درخواست نمی‌شوند. فیلدهای اضافی ورودی رد می‌شوند؛ نام حاوی الگوی تماس نیز پذیرفته نمی‌شود.
- URLهای غیر HTTP/HTTPS، IP، میزبان محلی، credentials و پورت سفارشی رد می‌شوند؛ query/fragment حذف می‌شود. این پالایش تأیید امنیت یا مالکیت سایت نیست.
- هویت از `resolveRequestActor` و سیاست قابلیت‌های موجود برنامه می‌آید؛ شناسه tenant از body/header پذیرفته نمی‌شود.
- GET نیازمند VIEW_DASHBOARD و POST نیازمند RUN_RESEARCH است. تزریق scope/city/candidates/tenant، کلید متفاوت، درخواست cross-origin و بدنه غیر JSON/بزرگ رد می‌شود.
- کلید ثابت و قفل tenant اجرای هم‌زمان یا تکراری را به همان نتیجه برمی‌گرداند؛ تلاش ناموفق نیز دوباره اجرا نمی‌شود. در هر لحظه فقط یک tenant می‌تواند منبع را اجرا کند. ظرفیت حافظه ۳۲ tenant است و پرشدن آن fail-closed است.
- حالت حافظه فرایند محلی؛ HMR داده و قفل‌ها را نگه می‌دارد. راه‌اندازی مجدد کامل فرایند این داده و کلیدهای تکرار را پاک می‌کند. این ذخیره‌سازی پایدار یا چندفرایندی نیست. هر دو متد در production غیرفعال‌اند.
- هیچ schema پایگاه‌داده، سرویس فروش، outreach، پیام یا deployment تغییر نکرده است.

## فایل‌ها و نسخه پشتیبان

دو فایل موجود پیش از اولین تغییر با تطبیق SHA-256 در `.tmp/ahvaz-scout-baseline` کپی شدند. نسخه‌ها پسوند `.bak` دارند تا TypeScript آن‌ها را به‌عنوان کد پروژه وارد نکند. `manifest.json` مسیر و hash اصل را ثبت کرده است.

فایل‌های موجود اصلاح‌شده:

1. `src/app/(default)/market-scout/page.tsx`: افزودن کارت مستقل اهواز.
2. `src/modules/growth/infrastructure/overpass-market-scout-source.ts`: استفاده از transport مشترک و محدودشده Overpass؛ قرارداد lane/candidate قبلی دست‌نخورده است.

فایل‌های تازه:

- `src/modules/growth/infrastructure/overpass-transport.ts`
- `src/modules/growth/infrastructure/overpass-ahvaz-car-source.ts`
- `src/modules/growth/application/ahvaz-car-scout-contracts.ts`
- `src/modules/growth/application/ahvaz-car-scout-worker.ts`
- `src/modules/growth/application/ahvaz-car-scout-execution.ts`
- `src/app/api/market-scout/ahvaz-cars/route.ts`
- `src/components/market-scout/ahvaz-car-scout.tsx`
- `src/components/market-scout/ahvaz-car-scout.module.css`
- `tests/unit/ahvaz-car-scout-source.test.ts`
- `tests/unit/ahvaz-car-scout-execution.test.ts`
- `tests/unit/ahvaz-car-scout-route.test.ts`
- `tests/component/ahvaz-car-scout.test.tsx`
- `.tmp/ahvaz-scout-typecheck.json`
- همین سند و manifest تحویل در `.tmp/ahvaz-scout-baseline/change-manifest.json`.

## آزمون‌های آماده‌سازی

۵۷ آزمون در ۶ فایل پاس شد: چهار فایل جدید منبع/worker/API/UI و دو regression موجود `overpass-market-scout-source.test.ts` و `market-scout-activity-command-route.test.ts`. fetch در این آزمون‌ها mock است؛ fixtureها به اپ تزریق نمی‌شوند. TypeScript محدود به src/tests/scripts و فایل‌های پیکربندی همین برنامه، و ESLint تمام فایل‌های TS/TSX تغییریافته، exit 0 داشتند.

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/vitest/vitest.mjs run tests/unit/ahvaz-car-scout-source.test.ts tests/unit/ahvaz-car-scout-execution.test.ts tests/unit/ahvaz-car-scout-route.test.ts tests/component/ahvaz-car-scout.test.tsx tests/unit/overpass-market-scout-source.test.ts tests/unit/market-scout-activity-command-route.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --project .tmp/ahvaz-scout-typecheck.json --noEmit --incremental false
```

TypeScript سراسری با tsconfig اصلی پاس نشد: include گسترده `**/*.ts` پروژه‌های واردشده در `artifacts/grok-imports/.../source` و `working` را نیز می‌خواند و برای وابستگی‌ها و aliasهای جداگانه آن پروژه خطا می‌دهد. این artifactها و tsconfig اصلی تغییر نکرده‌اند. Full build اجرا نشد؛ سرور dev فعال نگه داشته شد. تست Vitest در sandbox ابتدا با `spawn EPERM` متوقف شد؛ اجرای همان تست محلی با escalation موفق شد.

## اصلاح مبدأ در Next 16

اولین کلیک مدیر کار پیش از اجرای worker با `403 SCOUT_ORIGIN_REJECTED` رد شد. علت در کد نصب‌شده `node_modules/next/dist/server/web/next-url.js:15-19` تأیید شد: NextURL میزبان loopback ازجمله `127.0.0.1` را به `localhost` نرمال می‌کند. تکیه بر `request.url` برای مقایسه Origin، مبدأ واقعی مرورگر را اشتباه رد می‌کرد.

اصلاح، Origin را با `Host` واقعیِ معتبرِ loopback و scheme/port دقیق مقایسه می‌کند؛ `x-forwarded-host` مرجع نیست و cross-site/opaque/mismatched origin همچنان رد می‌شود. ده تست بر اساس NextRequest واقعی برای localhost، 127، IPv6، پورت/طرح متفاوت و مبدأ مهاجم اضافه شد.

تأیید زنده محدود با `scope:INVALID-LOCAL-PREFLIGHT` انجام شد؛ هیچ‌کدام امکان اجرای منبع ندارند:

| Host مقصد | Origin | پاسخ پس از اصلاح |
| --- | --- | --- |
| 127.0.0.1:3000 | http://127.0.0.1:3000 | 400 VALIDATION_ERROR، عبور صحیح از guard و رد scope نامعتبر |
| localhost:3000 | http://localhost:3000 | 400 VALIDATION_ERROR |
| 127.0.0.1:3000 | http://localhost:3000 | 403 SCOUT_ORIGIN_REJECTED |
| 127.0.0.1:3000 | https://attacker.example | 403 SCOUT_ORIGIN_REJECTED |

GET پس از این بررسی‌های بدون منبع، `snapshot:null` برگرداند. سپس مدیر کار دکمه اجرای واقعی را در Chrome کلیک کرد؛ نتیجه زیر از worker خود برنامه ثبت شد.

## نتیجه واقعی ثبت‌شده در خود برنامه

شناسه اجرا: `3834dfbb-fcd4-47d9-be2b-9d6ad3b3ca66`.

- وضعیت `COMPLETED`، یک تلاش HTTP و پاسخ منبع `200`؛ خطای منبع ثبت نشد.
- شروع: `2026-09-10T16:55:09.595Z`؛ پایان: `2026-09-10T16:55:11.669Z`.
- زمان مشاهده: `2026-09-10T16:55:11.661Z`؛ نسخه داده OSM: `2026-09-10T16:53:36.000Z`.
- ۳۵ عنصر دریافتی و ۳۵ ردیف پذیرفته‌شده از نظر قرارداد داده؛ همه شمارنده‌های رد ورودی صفر و سقف خروجی پر نشده است.
- ۷ مشاهده با لینک سایت ثبت‌شده در منبع، ۲۸ مشاهده بدون تگ سایت و صفر URL ردشده به دلیل پالایش ایمنی.

این اعداد **۳۵ مشاهده OSM** هستند؛ نه ۳۵ مشتری، نه الزاماً ۳۵ نمایشگاه مستقل و نه ۲۸ کسب‌وکار قطعاً بدون سایت. بررسی مدیر کار در خروجی، چند شعبه و مواردی با عنوان تعمیرگاه/ماشین‌آلات کشاورزی را نشان داد. تگ `shop=car` به‌تنهایی برای تأیید نوع کسب‌وکار، استقلال شعب یا مناسب بودن برای خدمات کافی نیست. ردیف‌ها با قواعد معنایی یا داده دستی تغییر داده نشدند.

نام و لینک مجموعه معرفی‌شده توسط کاربر نیز در همین پاسخ منبع ظاهر شد؛ هیچ نام یا دامنه‌ای برای تولید این نتیجه به کوئری/fixture برنامه تزریق نشده بود. مهندس آماده‌سازی فقط GET گزارش ثبت‌شده را خواند؛ کلیک اجرای واقعی توسط مدیر کار در UI انجام شد.

شاهد خروجی خود برنامه: [live-result.json](../../outputs/ahvaz-car-scout-20260910/live-result.json). طبق گزارش QA مدیر کار، خروجی پس از اجرا در عرض‌های ۱۴۴۰ و ۳۹۰ با HTTP 200، بدون pageerror و بدون overflow بررسی شد. تصاویر و JSON در `outputs/ahvaz-car-scout-20260910` نگه داشته شده‌اند. فایل شاهد، خروجی QA مستقل است؛ ذخیره‌سازی خود API همچنان موقت و در حافظه فرایند است.
