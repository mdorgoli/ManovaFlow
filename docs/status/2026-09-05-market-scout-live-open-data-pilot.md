# گزارش پایلوت زندهٔ Market Scout — OpenStreetMap / Overpass

**تاریخ اجرا:** 2026-09-05  
**وضعیت:** `LIVE_OPEN_DATA_RESEARCH_ONLY`  
**مرز:** کشف اولیه و پیش‌نویس داخلی؛ نه تأیید شرکت، نه lead واجدشرایط و نه outreach

## منبع و مسیر تکرار

منبع اجرا `OpenStreetMap Overpass API` است؛ دادهٔ مشارکتی OSM رجیستری رسمی، صفحهٔ بررسی‌شدهٔ شرکت یا اثبات نیاز/علاقهٔ مشتری نیست. OSM داده را تحت ODbL عرضه می‌کند و انتساب لازم است: [Copyright and License](https://www.openstreetmap.org/copyright). نمونهٔ عمومی Overpass برای کار کوچک، User-Agent مشخص، عدم اجرای موازی، cache/rate limit و تحمل دسترس‌پذیری پایین را الزام/توصیه می‌کند: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).

```powershell
pnpm pilot:market-scout -- FR serviceflow
pnpm pilot:market-scout -- FR beautyflow
pnpm pilot:market-scout -- FR briefflow
```

CLI فقط دو ورودی می‌گیرد: کشور و حوزه. هر اجرا یک query، concurrency برابر ۱ و حداکثر ۳ سازمان دارد؛ سه اجرای بالا در مجموع حداکثر ۹ سازمان می‌دهند. نمونهٔ فعلی فقط bounding box حدود یک کیلومتر در مرکز پاریس است و نمایندهٔ کل فرانسه نیست.

## شاهد کشف سیستمی

سه دستور بالا به‌ترتیب و از مسیر `OverpassMarketScoutSource -> MarketScoutSource -> runMarketScoutWorker -> runMarketScout` اجرا شدند؛ نام شرکت دستی به harness تزریق نشد.

| حوزه | کشف زنده | امتیاز داخلی | شاهد مشارکتی OSM | وب‌سایت گزارش‌شده در OSM |
|---|---|---:|---|---|
| ServiceFlow | Au comptoir des serruriers | 45/100، زیر آستانه | https://www.openstreetmap.org/node/9525603860 | https://www.comptoirdesserruriers.fr |
| ServiceFlow | Barazetti - Fils | 45/100، زیر آستانه | https://www.openstreetmap.org/node/12178462235 | https://www.barazzetti-fils.fr |
| ServiceFlow | Anil | 45/100، زیر آستانه | https://www.openstreetmap.org/node/12178470018 | https://www.anil-electricite.fr |
| BeautyFlow | Hair Studio | 60/100، عبور از آستانهٔ کشف؛ **نه qualified** | https://www.openstreetmap.org/node/679495122 | https://hairstudiobyanissa.com |
| BeautyFlow | Tchip | 60/100، عبور از آستانهٔ کشف؛ **نه qualified** | https://www.openstreetmap.org/node/1430808019 | https://tchip.fr/salon/view/1667 |
| BeautyFlow | Charlene Ramon | 60/100، عبور از آستانهٔ کشف؛ **نه qualified** | https://www.openstreetmap.org/node/2708938307 | https://www.charlene-ramon-paris.fr |
| BriefFlow | La Chose | 45/100، زیر آستانه | https://www.openstreetmap.org/node/8016758869 | https://lachose.fr |

هر ۷ مورد سه نسخهٔ `en/fr/ar` با برچسب صریح `INTERNAL ONLY / NOT SENT` دریافت کردند؛ بنابراین ۲۱ نسخهٔ متن داخلی تولید شد. BeautyFlow و BriefFlow در متن‌ها `RESEARCH_CONCEPT_NOT_READY` هستند و ServiceFlow `LOCAL_DEMO_NOT_PRODUCTION` است. هیچ صفحهٔ وب شرکت fetch یا بررسی نشد و وجود تگ website در OSM رسمی‌بودن، فعال‌بودن یا مالکیت آن وب‌سایت را اثبات نمی‌کند.

## کنترل‌ها و شمارنده‌ها

- query در سمت Overpass با `convert` فقط `osm_type`، `name`، `website`، `category` و `opening_hours` را برمی‌گرداند؛ phone/email/contact name درخواست نمی‌شود.
- endpoint ثابت HTTPS، redirect برابر `error`، User-Agent مشخص، timeout query برابر ۴ ثانیه، worker cap برابر ۵ ثانیه، response cap برابر 512000 byte و concurrency برابر ۱ است.
- URLهای HTTP، credential-bearing، localhost و IP خصوصی رد می‌شوند؛ domainها قبل از پذیرش حذف تکرار می‌شوند.
- repository همچنان tenant-keyed است؛ تست جداسازی tenant اجرا شد.
- `sourceRequests=3`، `organizationsReturned=7`، `acceptedCandidates=7`، `paidSpend=0`، `apolloCredits=0`، `messagesSent=0`، `contactReveals=0` و `outboundActions=0`.
- `humanSend=BLOCKED` و هیچ authorization token، فرم، ارسال، پرداخت، deploy یا mutation بیرونی ایجاد نشد.

## راستی‌آزمایی

- `vitest run --exclude tests/integration/**`: ۳۸ فایل، ۲۶۴ تست، همه pass.
- `eslint .`: بدون error یا warning.
- `tsc --noEmit`: pass.
- `next build`: pass؛ ۸ صفحه تولید شد.

## محدودیت واقعی

این پایلوت فقط کشف اولیهٔ bounded از یک دیتاست مشارکتی را ثابت می‌کند. منبع اصلی شرکت، وضعیت حقوقی، اندازهٔ تیم، درد workflow، اختیار خرید، علاقهٔ مشتری، صحت/تازگی تگ‌ها و آمادگی بازار تأیید نشده‌اند. پوشش OSM نامتوازن و public Overpass کم‌دسترس است؛ طبق سیاست instance، استفادهٔ منظم/تجاری باید به extract، self-host یا provider مناسب منتقل شود. پیش از هر ارزیابی qualified، منبع اصلی باید در مرحله‌ای جدا و مجاز بررسی شود؛ این مرحله چنین کاری نکرده است.
