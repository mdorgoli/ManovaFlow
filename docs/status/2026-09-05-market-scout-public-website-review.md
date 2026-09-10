# گزارش Market Scout — بررسی محدود وب‌سایت‌های عمومی

**تاریخ اجرا:** 2026-09-05  
**وضعیت:** اجرای محلی `SEARCH` و فقط پژوهشی  
**محدوده:** ماژول Growth، اسکریپت Market Scout، تست‌های اختصاصی و این گزارش؛ بدون UI/API/ServiceFlow/build/dev

## قرارداد فعالیت برای پنل

قرارداد exportشده `MarketScoutActivitySnapshotV1` با نسخهٔ `manovaflow.market-scout.activity.v1` در `src/modules/growth/application/market-scout-activity.ts` قرار دارد. فیلدهای نهایی:

- `runId` و `agent=market-scout`؛
- `status`: `IDLE | RUNNING | STOPPED | FAILED | COMPLETED`؛
- `query.origin`: `SEARCH | SEED` به‌همراه کشور، حوزه و filter واقعی؛
- رویدادهای ترتیبی با `sequence`، زمان واقعی، stage، URL، outcome، decision، reason و error؛
- `startedAt`، `finishedAt`، `snapshotAt` و `staleAfterMs=15000`.

اجرای فعلی `SEARCH` است و snapshot واقعی در `result.activity` و stdout اسکریپت منتشر می‌شود. API یا پنل موازی ساخته نشد.

## کنترل بررسی سایت

- URL از کشف زندهٔ OSM می‌آید؛ نام یا فهرست دستی به reviewer تزریق نمی‌شود.
- فقط HTTPS بدون credential و port پذیرفته می‌شود.
- تمام A/AAAAهای DNS پیش از هر درخواست و هر redirect بررسی می‌شوند؛ private، loopback، link-local، multicast، documentation و metadata ranges رد می‌شوند.
- redirect خودکار خاموش است؛ حداکثر دو redirect و چهار HTTP request برای هر سایت.
- `robots.txt` پیش از صفحه خوانده می‌شود و group matching/Allow/Disallow مطابق [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) اعمال می‌شود.
- سقف هر سایت: ۸ ثانیه، حداکثر ۲۵۶۰۰۰ بایت برای صفحه و ۶۴۰۰۰ بایت برای robots.
- راهنمای OWASP نیز خاموش‌کردن redirect خودکار، بررسی همهٔ IPهای DNS و رد IPهای خصوصی را برای کاهش SSRF توصیه می‌کند: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- HTML اجرا نمی‌شود؛ script/style/svg حذف و متن به‌عنوان `UNTRUSTED_DATA_ONLY` پردازش می‌شود. فقط fact keyهای allowlisted ثبت می‌شوند؛ نام فرد، ایمیل، تلفن، فرم یا متن خام ذخیره نمی‌شود.

## نتیجهٔ اجرای واقعی

سه حوزه به‌صورت ترتیبی روی `FR` اجرا شدند. نخستین اجرای BriefFlow در timeout منبع Overpass fail-closed شد؛ تنها retry محدود بعدی موفق بود.

| حوزه | مورد | نتیجهٔ سایت | واقعیت‌های عمومی ثبت‌شده | نتیجهٔ محدود |
|---|---|---|---|---|
| ServiceFlow | Au comptoir des serruriers | موفق؛ ۲ درخواست | شرح خدمت، ساعات، زبان خدمات بسته‌بندی‌شده | فقط مناسب بررسی انسانی بعدی؛ نیاز/علاقه نامعلوم |
| ServiceFlow | Barazetti - Fils | موفق؛ ۲ درخواست | شرح خدمت، ساعات، زبان خدمات بسته‌بندی‌شده | فقط مناسب بررسی انسانی بعدی؛ نیاز/علاقه نامعلوم |
| ServiceFlow | Anil | موفق؛ ۲ درخواست | شرح خدمت، مسیر رزرو/درخواست، زبان خدمات بسته‌بندی‌شده | فقط مناسب بررسی انسانی بعدی؛ نیاز/علاقه نامعلوم |
| BeautyFlow | Hair Studio | ناموفق؛ ۲ درخواست | هیچ fact ثبت نشد؛ `WEBSITE_RESPONSE_TOO_LARGE` | بررسی‌نشده به‌علت سقف ۲۵۶KB |
| BeautyFlow | Tchip | موفق؛ ۴ درخواست و redirect اعتبارسنجی‌شده | شرح خدمت، چند محل، زبان خدمات بسته‌بندی‌شده | فقط مناسب بررسی انسانی بعدی؛ نیاز/علاقه نامعلوم |
| BeautyFlow | Charlene Ramon | موفق؛ ۲ درخواست | شرح خدمت، ساعات | فقط مناسب بررسی انسانی بعدی؛ نیاز/علاقه نامعلوم |
| BriefFlow | La Chose | موفق؛ ۲ درخواست | شرح خدمت خلاقه | Brief عمومی/approval/نیاز/علاقه همچنان نامعلوم |

جمع واقعی این مرحله: ۴ تلاش Overpass شامل یک timeout و یک retry، ۱۶ درخواست محدود robots/page، ۷ تلاش بررسی سایت، ۶ بررسی موفق، ۱ شکست اندازهٔ پاسخ و صفر منع robots. هیچ موردی مشتری واجدشرایط یا علاقه‌مند نامیده نشد.

## هزینه و اثر بیرونی

- `paidSpend=0`
- `apolloCredits=0`
- `messagesSent=0`
- `contactReveals=0`
- `formsSubmitted=0`
- `outboundActions=0`
- `humanSend=BLOCKED`

## تست اختصاصی

- دروازهٔ نهایی پنج فایل واحد اختصاصی Market Scout را پوشش داد: ۱۶ تست، همه pass.
- `tsc --noEmit`: pass.
- طبق تقسیم مسئولیت، `next build`، `next dev` و آزمون مرورگر اجرا نشدند و در اختیار مجری QA باقی ماندند.

## محدودیت‌ها

واقعیت‌های ثبت‌شده فقط وجود واژه/الگوی allowlisted در صفحهٔ عمومی را نشان می‌دهند؛ صحت حقوقی شرکت، مالکیت دامنه، تازگی محتوا، اندازه تیم، درد workflow، اختیار خرید و علاقهٔ مشتری اثبات نشده است. extractor قطعی و محدود است و ممکن است متن عمومی را از دست بدهد یا یک عبارت را بدون زمینهٔ کامل ثبت کند. Hair Studio عمداً به‌خاطر response cap بررسی نشد. کنترل DNS پیش از هر fetch و redirect اجرا می‌شود، اما network-level egress allowlist یا IP pinning در این پایلوت محلی وجود ندارد؛ پیش از استقرار server-side باید به‌عنوان دفاع تکمیلی اضافه شود.
