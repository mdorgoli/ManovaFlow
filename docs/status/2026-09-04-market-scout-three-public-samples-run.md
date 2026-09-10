# گزارش اجرای سه نمونه عمومی در Market Scout

- تاریخ اجرا: ۲۰۲۶-۰۹-۰۴
- batch key: `three-public-samples-2026-09-04`
- دامنه: فقط `Lale Teknik`، `Chaps & Co` و `L’Alchimiste`
- حالت: `RESEARCH_ONLY`
- persistence: مخزن in-memory محلی؛ داده‌های این اجرا پس از پایان process پایدار نیستند

## مسیر اجرای واقعی

سه ورودی با قرارداد موجود `MarketScoutSource` به coordinator موجود داده شدند. coordinator همهٔ ۱۲ assignment ثابتِ سه lane در چهار بازار را اجرا کرد؛ ۹ assignment بدون ورودی، envelope خالی و معتبر دریافت کردند و فقط سه assignment زیر سازمان برگرداندند:

1. `serviceflow × tr-istanbul`
2. `beautyflow × ae-dubai`
3. `briefflow × fr-france`

این اجرا هیچ connector یا رابط ورودی زنده‌ای نداشت. اطلاعات عمومی که پیش‌تر از وب‌سایت رسمی سازمان‌ها بررسی شده بود، با یک harness موقت مستقیماً به قرارداد موجود داده شد. بنابراین نتیجه، اعتبارسنجی مسیر محلی از ورودی تا shortlist/draft است؛ اثبات discovery یا fetch زنده توسط خود Market Scout نیست.

## خروجی کل اجرا

| شاخص | مقدار مشاهده‌شده |
|---|---:|
| exit code runner | ۰ |
| workers completed | ۱۲ |
| workers failed | ۰ |
| source URLs reviewed | ۳ |
| organizations returned | ۳ |
| accepted candidates | ۳ |
| rejected candidates | ۰ |
| lanes completed | ۳ |
| lanes failed | ۰ |
| company scores | ۳ |
| market scores | ۱۲ |
| internal drafts | ۳ |
| deduplicated companies | ۰ |
| suppressed companies | ۰ |
| paid spend | ۰ |
| outbound actions | ۰ |

خروجی coordinator صریحاً `humanSend=BLOCKED` بود. هر ۱۲ تصمیم compliance برای چهار بازار در سه lane مقدار `HUMAN_SEND_BLOCKED` و `authorizationToken=null` داشتند.

## نتیجه هر سازمان

### ۱. Lale Teknik — ServiceFlow / Istanbul

- نتیجه worker validation: پذیرفته‌شده
- source kind: `PUBLIC_COMPANY_WEBSITE`
- شاهد عمومی: <https://laleteknik.com.tr/>
- domain نرمال‌شده: `laleteknik.com.tr`
- امتیاز fit: **۸۵/۱۰۰**
- وضعیت scoring: `ELIGIBLE`
- ردها: صفر
- dedupe: صفر؛ domain دیگری با این مقدار در lane وجود نداشت
- پیش‌نویس: `PRODUCT_DISCOVERY`، تصمیم `PENDING`، `outboundEnabled=false`
- زبان پیش‌نویس: انگلیسی/LTR با basis برابر `MARKET_LOCALE_FALLBACK`

سیگنال‌های امتیازگرفته: نگه‌داری غیراضطراری، محدوده خدمت، جریان درخواست تکرارشونده، شکاف قابل مشاهدهٔ intake، زبان عمومی قابل پشتیبانی و آمادگی صرفاً پژوهشی بازار.

محدودیت زبانی: detector فعلی ترکی را در مجموعه زبان‌های خروجی ندارد؛ متن عمومی ترکی به fallback بازار و سپس انگلیسی تبدیل شد. این یک محدودیت واقعی است و نباید به‌عنوان تشخیص زبان ترکی گزارش شود.

### ۲. Chaps & Co — BeautyFlow / Dubai

- نتیجه worker validation: پذیرفته‌شده
- source kind: `PUBLIC_COMPANY_WEBSITE`
- شاهد عمومی: <https://chapsandco.com/en-ae/collections/dubai-locations>
- شاهد تکمیلی ساعات/شعبه: <https://chapsandco.com/en-ae/pages/locations/bloomingdales>
- domain نرمال‌شده: `chapsandco.com`
- امتیاز fit: **۹۰/۱۰۰**
- وضعیت scoring: `ELIGIBLE`
- ردها: صفر
- dedupe: صفر؛ domain دیگری با این مقدار در lane وجود نداشت
- پیش‌نویس: `WAITLIST_PREVIEW`، تصمیم `PENDING`، `outboundEnabled=false`
- زبان پیش‌نویس: انگلیسی/LTR با basis برابر `PUBLIC_TEXT`

سیگنال‌های امتیازگرفته: خدمت زیبایی/آرایش غیرپزشکی، کاتالوگ و ساعات عمومی، چند شعبه یا اپراتور، مسیر رزرو عمومی، زبان پشتیبانی‌شده و آمادگی صرفاً پژوهشی بازار. برای شکاف confirmation امتیازی ثبت نشد.

### ۳. L’Alchimiste — BriefFlow / France

- نتیجه worker validation: پذیرفته‌شده
- source kind: `PUBLIC_COMPANY_WEBSITE`
- شاهد عمومی: <https://lalchimiste-studio.fr/>
- domain نرمال‌شده: `lalchimiste-studio.fr`
- امتیاز fit: **۹۰/۱۰۰**
- وضعیت scoring: `ELIGIBLE`
- ردها: صفر
- dedupe: صفر؛ domain دیگری با این مقدار در lane وجود نداشت
- پیش‌نویس: `WAITLIST_PREVIEW`، تصمیم `PENDING`، `outboundEnabled=false`
- زبان پیش‌نویس: فرانسوی/LTR با basis برابر `PUBLIC_TEXT`

سیگنال‌های امتیازگرفته: خدمت حرفه‌ای غیررگوله، خدمت تکرارشونده/بسته‌بندی‌شده، مسیر عمومی brief، گام‌های validation، زبان پشتیبانی‌شده و آمادگی صرفاً پژوهشی بازار. برای اندازهٔ تیم امتیازی ثبت نشد.

## شواهد ذخیره‌سازی محلی در اجرای in-memory

- runs: ۳
- companies: ۳
- company scores: ۳
- market scores: ۱۲
- compliance decisions: ۱۲
- drafts: ۳
- suppressions: ۰
- audit events: ۶ (`RUN_STARTED` × ۳ و `RUN_COMPLETED` × ۳)

## محدودیت‌ها و مرز ادعا

1. Market Scout هنوز رابط ورودی عمومی/زنده، Apollo adapter، route یا scheduler ندارد؛ قابلیت تازه‌ای در این اجرا ساخته نشد.
2. source evidence پیش از اجرا به‌صورت دستی گردآوری شد؛ runner شبکه را فراخوانی نکرد و صحت لحظه‌ای URL را اثبات نمی‌کند.
3. امتیازها حاصل signalهای مستندشدهٔ ورودی هستند؛ ادعای خرید، تمایل به پرداخت، آمادگی قرارداد یا آمادگی فروش نیستند.
4. dedupe بررسی شد اما هر سه domain یکتا بودند؛ بنابراین شمارندهٔ حذف تکراری صفر است.
5. مخزن in-memory است؛ dashboard پایدار یا دیتابیس production در این اجرا به‌روزرسانی نشد.
6. Apollo اجرا نشد، credit یا Contact Reveal مصرف نشد و هیچ دادهٔ شخصی وارد ورودی نشد.
7. هیچ deploy، خرید، فرم، رزرو، outreach یا پیام خروجی انجام نشد.

## نتیجه کنترل ایمنی

هر سه سازمان به shortlist پژوهشی lane مربوطه راه یافتند و پیش‌نویس داخلی دریافت کردند. هیچ‌کدام مجوز تماس یا ارسال ندارند: `humanSend=BLOCKED`، `authorizationToken=null`، `outboundEnabled=false` و `outboundActions=0`.

## تأیید تازه پس از اجرا

- runner مستقیم محلی: exit code برابر ۰
- تست‌های متمرکز:
  - `tests/unit/market-scout-worker.test.ts`
  - `tests/unit/market-scout-coordinator.test.ts`
  - `tests/e2e/market-scout-research-only.test.ts`
- نتیجه تست: **۳ فایل از ۳ فایل و ۱۱ تست از ۱۱ تست پاس شدند**؛ exit code برابر ۰
- harness موقت اجرای نمونه پس از ثبت نتیجه حذف شد؛ قابلیت یا رابط تازه‌ای در کد محصول باقی نماند.

یادداشت عملیاتی: تلاش اول با wrapper مدیر بسته وارد بررسی lockfile و درخواست رجیستری شد. همهٔ درخواست‌ها با `ECONNREFUSED` شکست خوردند و process پیش از هر دانلود یا نصب متوقف شد. اجرای نهایی و تست‌ها مستقیماً با binaryهای ازپیش‌نصب‌شدهٔ محلی انجام شدند.
