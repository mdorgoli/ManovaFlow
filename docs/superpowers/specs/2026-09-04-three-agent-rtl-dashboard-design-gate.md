# Design Gate — داشبورد RTL سه ایجنت ManovaFlow

- تاریخ: ۲۰۲۶-۰۹-۰۴
- وضعیت: `DESIGN_GATE_AWAITING_OWNER_APPROVAL`
- دامنه: طراحی اجرایی داشبورد مشترک `ServiceFlow`، `BeautyFlow` و `BriefFlow`
- حالت محصول: `G0 / RESEARCH_ONLY / DEMO / SYNTHETIC`
- اثر بیرونی: ممنوع؛ `Outbound=0`
- این سند فقط طراحی است؛ هیچ کد، migration، داده، KPI، اتصال بیرونی یا تغییر runtime را مجاز نمی‌کند.

## ۱. قرارداد حقیقت

داشبورد باید بین چهار نوع مقدار تفاوت صریح بگذارد:

1. **CONFIG FACT:** مقدار نسخه‌دار و خوانده‌شده از manifest یا policy؛ مانند hard cap هر lane.
2. **OBSERVED FACT:** مقدار ثبت‌شده در اجرای واقعی همان tenant/run، همراه با زمان و شناسه منبع.
3. **DERIVED:** مقدار محاسبه‌شده فقط از FACTهای قابل ردیابی؛ فرمول و پنجره محاسبه باید قابل مشاهده باشد.
4. **MISSING:** مقدار لازم وجود ندارد، منقضی است یا برای نمایش ایمن قابل احراز نیست.

قواعد غیرقابل‌مذاکره:

- نبود رکورد هرگز به `0` تبدیل نمی‌شود؛ مقدار آن `MISSING` یا «هنوز ثبت نشده» است.
- `0` فقط وقتی نمایش داده می‌شود که یک رکورد معتبر یا invariant سروری آن را اثبات کند.
- داده مصنوعی در سطح محیط و تک‌تک رکوردها با `SYNTHETIC` مشخص می‌شود.
- امتیاز آمادگی بازار با امتیاز تطابق شرکت ترکیب نمی‌شود.
- رتبه بازار توصیه ورود، ثبت شرکت، قرارداد، پرداخت یا مجوز outbound نیست.
- هیچ claim، KPI، trend، درصد رشد، نرخ موفقیت، ROI یا مقایسه زمانی بدون داده ثبت‌شده ساخته نمی‌شود.

## ۲. وضعیت واقعی ورودی‌های موجود

منابع فعلی قابل استفاده در طراحی:

- manifestهای سه lane برای حالت pack، ICP، سقف‌ها و kill ruleها؛
- `research_runs.summary` برای گزارش آخرین اجرای تکمیل‌شده؛
- `market_scores` برای امتیاز و confidence بازار به تفکیک lane و run؛
- `compliance_decisions` و رجیستری بازار برای وضعیت gate و unknownهای صریح؛
- `audit_events` برای رخدادهای عملیاتی Growth؛
- invariant فعلی دامنه که `outboundActions` و `paidSpend` را صفر نگه می‌دارد.

شکاف‌هایی که UI نباید پنهان کند:

- نام `dailyCaps` در manifest وجود دارد، اما پیاده‌سازی فعلی مصرف را داخل هر run محدود می‌کند و ledger تجمیعی روزانه ندارد. بنابراین تا ایجاد read model معتبر، عبارت «مصرف امروز» مجاز نیست.
- زمان واقعی مصرف‌شده و low-value streak نهایی در summary فعلی persist نمی‌شوند؛ این خانه‌ها باید `MISSING` باشند.
- `MISSING` یک classification ذخیره‌شده نیست و باید از نبود شاهد واجدشرایط مشتق شود.
- endpoint فعلی dashboard آرایه‌های خام و نامحدود برمی‌گرداند؛ برای UI نهایی باید به projection حداقلی و صفحه‌بندی‌شده تبدیل شود.
- `audit_events` در نقش application فقط مجوز `SELECT/INSERT` دارد، اما هنوز نباید در UI «tamper-proof» یا هم‌سطح audit امنیتی append-only فاز ۲C معرفی شود مگر حفاظت دیتابیسی آن جداگانه اثبات شود.

## ۳. جهت واحد انتخاب‌شده

### Evidence-first Operational Cockpit

صفحه از بالا به پایین به این ترتیب خوانده می‌شود:

1. نوار ایمنی دائمی؛
2. وضعیت منبع داده و تازگی؛
3. جدول مصرف و سقف‌ها؛
4. سه پنل مستقل ایجنت؛
5. رتبه‌بندی بازار برای lane انتخاب‌شده؛
6. ماتریس شواهد و compliance؛
7. audit عملیاتی امن.

این ترتیب باعث می‌شود کاربر قبل از دیدن هر score بداند داده synthetic است، outbound وجود ندارد، اعداد از کجا آمده‌اند و چه چیزهایی هنوز MISSING هستند.

دو جهت بررسی‌شده و کنار گذاشته‌شده:

- **Card wall صرف:** برای معرفی سه ایجنت مناسب است، اما مصرف، تازگی و شواهد را در عمق کارت‌ها پنهان می‌کند.
- **Market-first analytics:** بازار را بیش از حد شبیه توصیه تصمیم‌گیری نشان می‌دهد و مرز Research-Only را تضعیف می‌کند.

## ۴. معماری اطلاعات و چیدمان دسکتاپ

```text
┌─ DEMO ─ SYNTHETIC DATA ─ RESEARCH-ONLY ─ OUTBOUND = 0 ─ NO EXTERNAL ACTION ┐
├─ عنوان / tenant / storage mode / زمان snapshot / وضعیت تازگی                 ┤
├─ ناوبری درون‌صفحه: مصرف | ایجنت‌ها | بازار | شواهد | audit                 ┤
├─ جدول مصرف و سقف سه lane                                                    ┤
├─ ServiceFlow ───────── BeautyFlow ───────── BriefFlow                       ┤
├─ رتبه‌بندی بازار برای lane انتخاب‌شده                                       ┤
├─ ماتریس FACT / INFERENCE / UNKNOWN / MISSING                                ┤
└─ رخدادهای عملیاتی امن و صفحه‌بندی‌شده                                       ┘
```

صفحه RTL و بر پایه grid دوازده‌ستونه است. نوار ایمنی به بالای viewport می‌چسبد و در scroll یا تغییر فیلتر ناپدید نمی‌شود. ناوبری فقط anchorهای همان صفحه است و هیچ وضعیت safety را مخفی نمی‌کند.

### ۴.۱ نوار ایمنی دائمی

متن ثابت دیداری:

- `DEMO`
- `SYNTHETIC DATA`
- `RESEARCH-ONLY`
- `OUTBOUND = 0`
- `هیچ پیام، تماس، تبلیغ، رزرو یا خریدی انجام نمی‌شود`

`Outbound=0` یک KPI بازاریابی نیست؛ invariant ایمنی است. نسخه اجرایی فقط وقتی صفر را نشان می‌دهد که projection سروری هم‌زمان این موارد را تأیید کند: هر سه lane در G0 هستند، gateway غیرفعال است، credential خروجی وجود ندارد و شمارنده action ثبت‌شده صفر است. اگر احراز کامل ممکن نباشد، نوار باید به `OUTBOUND STATUS MISSING — ACTIONS BLOCKED` تغییر کند؛ client حق hardcode کردن یک صفر اطمینان‌بخش را ندارد.

نوار با متن و آیکون معنا می‌دهد و فقط به رنگ متکی نیست. هیچ کنترل بستن، collapse یا dismiss ندارد.

### ۴.۲ سربرگ و تازگی

سربرگ فقط این داده‌ها را نمایش می‌دهد:

- نام محیط و tenant مجاز؛
- `MEMORY_DEMO` یا `POSTGRESQL` از پاسخ سرور؛
- زمان تولید snapshot، نه زمان ساعت مرورگر؛
- حالت تازگی: «تازه»، «قدیمی» یا `MISSING` بر اساس policy نسخه‌دار؛
- آخرین اجرای ثبت‌شده هر lane، بدون تبدیل نبود اجرا به صفر.

واژه‌های «زنده» و «real-time» تا وقتی subscription یا refresh تضمین‌شده وجود ندارد استفاده نمی‌شوند.

## ۵. جدول مصرف و سقف‌ها

جدول desktop یک ردیف برای هر lane دارد و این ستون‌ها را نشان می‌دهد:

| ستون | منبع | قاعده نمایش |
|---|---|---|
| ایجنت و pack state | manifest/lane state | همیشه با `RESEARCH_ONLY` همراه است |
| پنجره مصرف | ledger معتبر | start، end و timezone؛ در نبود ledger برابر `MISSING` |
| URL | مصرف ثبت‌شده + cap manifest | `used / cap`؛ remaining فقط وقتی هر دو معلوم‌اند |
| شرکت deduplicated | مصرف ثبت‌شده + cap manifest | مصرف و سقف جدا، بدون درصد ساختگی |
| بازار | market scoreهای همان run + cap manifest | تعداد ارزیابی ثبت‌شده، نه تعداد profile موجود |
| draft | draftهای همان run/window + cap manifest | draft داخلی؛ هرگز معادل ارسال نیست |
| زمان | elapsed ثبت‌شده + cap manifest | تا persist شدن elapsed برابر `MISSING` |
| توقف | summary ثبت‌شده | ترجمه مستقیم `INPUT_EXHAUSTED`، `DAILY_CAP`، `DIMINISHING_RETURNS` یا `TIME_CAP` |
| هزینه بیرونی | invariant/ledger | حالت قفل‌شده؛ صفر فقط با شاهد معتبر |

### سقف‌های CONFIG FACT فعلی

این اعداد از manifestهای موجود می‌آیند و هدف عملکرد یا KPI نیستند:

| lane | URL | شرکت | بازار | draft | زمان هر اجرا | low-value متوالی | هزینه پولی |
|---|---:|---:|---:|---:|---:|---:|---:|
| ServiceFlow | ۴۰ | ۲۰ | ۴ | ۵ | ۵ ثانیه | ۲ | ۰ |
| BeautyFlow | ۲۵ | ۱۰ | ۴ | ۳ | ۵ ثانیه | ۲ | ۰ |
| BriefFlow | ۲۵ | ۱۰ | ۴ | ۳ | ۵ ثانیه | ۲ | ۰ |

تا وقتی مرز روز و ledger روزانه تأیید و پیاده‌سازی نشده، عنوان جدول «مصرف آخرین اجرای ثبت‌شده / سقف پیکربندی‌شده» است. progress bar فقط برای نسبت‌های دارای numerator و denominator معتبر رسم می‌شود؛ وضعیت MISSING هیچ نوار خالی یا صفر درصد ندارد.

## ۶. پنل‌های سه ایجنت

سه پنل از یک component contract و visual grammar استفاده می‌کنند؛ تفاوت فقط از manifest و داده lane می‌آید.

### ServiceFlow

- عنوان: `ServiceFlow Growth Agent`
- pack state فعلی: `ACTIVE_DEVELOPMENT`
- برچسب دائمی: `RESEARCH_ONLY`
- CTAهای مجاز: مشاهده شواهد، مشاهده shortlist، مشاهده draft داخلی و اجرای research synthetic برای نقش مجاز.
- CTA outbound وجود ندارد؛ متن غیرفعال «ارسال در G0 وجود ندارد» صرفاً وضعیت را توضیح می‌دهد.

### BeautyFlow

- عنوان: `BeautyFlow Growth Agent`
- pack state فعلی: `VALIDATION_BACKLOG`
- برچسب‌های دائمی: `RESEARCH_ONLY` و «محصول آماده نیست»
- هیچ واژه‌ای مانند آماده فروش، رزرو فعال یا قابلیت پزشکی نمایش داده نمی‌شود.

### BriefFlow

- عنوان: `BriefFlow Growth Agent`
- pack state فعلی: `VALIDATION_BACKLOG`
- برچسب‌های دائمی: `RESEARCH_ONLY` و «محصول آماده نیست»
- هیچ ادعای پردازش سند محرمانه، مشاوره حقوقی/مالی یا محصول آماده نمایش داده نمی‌شود.

هر پنل این اطلاعات را با provenance نشان می‌دهد: وضعیت آخرین run، زمان run، stop reason، مصرف run، تعداد shortlist ثبت‌شده، تعداد draft ثبت‌شده، تعداد suppression ثبت‌شده و خطای ایزوله. queue depth تا زمانی که queue persist نشده `MISSING` است. شکست یک lane دو پنل دیگر را به خطا تبدیل نمی‌کند.

## ۷. رتبه‌بندی بازار

رتبه‌بندی به‌صورت جدول پژوهشی برای **یک lane انتخاب‌شده** نمایش داده می‌شود. ترکیب score سه lane یا تولید «بهترین بازار جهانی» ممنوع است، زیرا `market_scores` به lane و run وابسته است.

ستون‌ها:

- رتبه پژوهشی؛
- بازار و scope دقیق جغرافیایی؛
- market readiness score ثبت‌شده؛
- confidence؛
- تعداد evidence واجدشرایط؛
- تعداد وضعیت‌های UNKNOWN/MISSING؛
- زمان score و run؛
- وضعیت Human-Send که در این فاز همواره blocked است.

قواعد رتبه:

- فقط scoreهای آخرین run تکمیل‌شده همان lane وارد جدول می‌شوند.
- sort اصلی score نزولی است؛ score برابر، رتبه برابر می‌گیرد و کلید بازار فقط ترتیب دیداری tie را پایدار می‌کند.
- بازار بدون score ثبت‌شده رتبه نمی‌گیرد و در بخش `MISSING` پایین جدول می‌ماند.
- scope اربیل/KRI هرگز به کل عراق تعمیم داده نمی‌شود؛ استانبول و دبی نیز با scope دقیق profile نمایش داده می‌شوند.
- score یا rank به‌تنهایی هیچ gate حقوقی، قراردادی، پرداخت یا KYC را باز نمی‌کند.

با انتخاب هر بازار، پنل جزئیات explanation وزن‌ها و منابع را باز می‌کند. هر معیار فاقد شاهد امتیاز صفر همان engine یا `MISSING` می‌گیرد؛ UI دلیل جدید تولید نمی‌کند.

## ۸. ماتریس FACT / INFERENCE / UNKNOWN / MISSING

ردیف‌ها بازارها و ستون‌ها شش دسته ثابت هستند:

1. Outreach
2. Data
3. AI Disclosure
4. Contract
5. Payment
6. Sanctions/KYC

هر cell دقیقاً یک حالت اصلی دارد:

| حالت | تعریف اجرایی | اثر بر Human-Send |
|---|---|---|
| `FACT` | حداقل یک منبع رسمی HTTPS، تاریخ‌دار و داخل پنجره freshness policy وجود دارد و UNKNOWN حل‌نشده ندارد | به‌تنهایی مجوز نیست |
| `INFERENCE` | استنباط ثبت‌شده و متصل به منبع وجود دارد، اما FACT رسمی واجدشرایط وجود ندارد | blocked |
| `UNKNOWN` | پرسش حل‌نشده صریحاً ثبت شده است | blocked |
| `MISSING` | هیچ شاهد واجدشرایط وجود ندارد یا تنها شاهد موجود منقضی/نامعتبر است | blocked |

قاعده انتخاب حالت اصلی: `UNKNOWN`، سپس `FACT`، سپس `INFERENCE`، سپس `MISSING`. وجود رکوردهای دیگر در drawer جزئیات پنهان نمی‌شود. `MISSING` رکورد جعلی در دیتابیس نیست؛ نتیجه نبود شاهد واجدشرایط است.

هر cell با متن، آیکون و رنگ نمایش داده می‌شود و drawer آن فقط publisher، classification، خلاصه ثبت‌شده، URL امن، checked-at و freshness را نشان می‌دهد. متن منبع یا نتیجه حقوقی توسط UI بازنویسی نمی‌شود. بالای ماتریس همیشه نوشته می‌شود: «این ابزار جایگزین وکیل نیست.»

## ۹. audit امن

بخش audit یک projection حداقلی و tenant-scoped است، نه dump جدول یا JSON viewer.

### فیلدهای مجاز در فهرست

- sequence؛
- زمان سرور؛
- event type allowlisted؛
- lane؛
- نتیجه؛
- نوع entity و reference غیرحساس؛
- actor label مجاز، بدون نمایش credential یا claim هویتی خام؛
- correlation/run reference؛
- نسخه policy/manifest در صورت ثبت‌شدن.

### داده‌های ممنوع

- token، cookie، authorization header، password، CSRF یا database URL؛
- draft body و prompt کامل؛
- request/response body خام؛
- ایمیل، تلفن، نام فرد، شناسه تبلیغاتی یا داده حساس؛
- URL دارای username/password یا query حساس؛
- error stack و پیام خطای خامی که ممکن است secret داشته باشد؛
- JSON آزاد بدون schema و allowlist رویداد.

جزئیات هر event باید روی سرور و بر اساس schema همان event project شود. خطای ناشناخته فقط error code و correlation reference می‌دهد. pagination cursor-based و bounded است؛ کل audit یکجا به client ارسال نمی‌شود. filterها فقط lane، event type، result و بازه زمانی مجاز دارند.

پیشنهاد دسترسی: `OWNER` و `OPERATOR` audit پالایش‌شده را می‌بینند؛ `VIEWER` فقط وضعیت سلامت audit و آخرین sequence ثبت‌شده را می‌بیند. export در این Design Gate وجود ندارد. audit امنیتی Identity با audit عملیاتی Growth مخلوط نمی‌شود و endpoint/permission جدا می‌خواهد.

تا قبل از اثبات DB-level immutability برای Growth audit، عنوان UI «سوابق عملیاتی ثبت‌شده» است، نه «audit تغییرناپذیر». اگر توالی، تازگی یا سلامت projection قابل احراز نباشد، بخش با `AUDIT INTEGRITY MISSING` fail-closed می‌شود.

## ۱۰. نسخه موبایل

در عرض موبایل، همان اولویت اطلاعات حفظ می‌شود و هیچ جدول عریضی به scroll افقی اجباری تبدیل نمی‌شود:

1. نوار sticky دوخطی: خط اول `DEMO / SYNTHETIC / OUTBOUND=0` و خط دوم `RESEARCH_ONLY / NO EXTERNAL ACTION`؛
2. خلاصه snapshot و تازگی؛
3. سه کارت مصرف، هر کدام با جفت `used / cap` و حالت MISSING مستقل؛
4. کارت‌های agent به ترتیب ServiceFlow، BeautyFlow، BriefFlow؛
5. فهرست رتبه بازار با selector lane؛
6. accordion جدا برای هر بازار و شش ردیف evidence؛
7. timeline audit صفحه‌بندی‌شده.

قواعد موبایل:

- ترتیب DOM با ترتیب دیداری RTL یکسان است.
- URL، domain، ID و timestamp در isolate با جهت LTR نمایش داده می‌شوند.
- targetهای لمسی حداقل ۴۴ در ۴۴ پیکسل‌اند.
- status فقط با رنگ منتقل نمی‌شود؛ icon و label متنی الزامی است.
- focus، skip-link، heading hierarchy و اعلان خطا برای screen reader حفظ می‌شوند.
- نوار sticky محتوای anchor یا focus را نمی‌پوشاند و safe-area دستگاه را رعایت می‌کند.
- هیچ action حساس در swipe، long-press یا gesture پنهان قرار نمی‌گیرد.

## ۱۱. حالت‌های loading، empty، stale و error

- **Loading:** skeleton بدون عدد یا score.
- **Empty:** «هنوز اجرای ثبت‌شده‌ای وجود ندارد»؛ همه مصرف‌ها `MISSING`، نه صفر.
- **Partial failure:** خطا فقط روی lane مربوط؛ دو lane دیگر داده معتبر خود را حفظ می‌کنند.
- **Stale:** timestamp و علت؛ score قبلی قابل مشاهده ولی برای gate معتبر نیست.
- **Unauthorized:** هیچ snapshot قبلی در client باقی نمی‌ماند و محتوای tenant نمایش داده نمی‌شود.
- **Invariant failure:** اگر Outbound=0 احراز نشود، نوار critical، همه actionهای run/decision غیرفعال و incident reference نمایش داده می‌شود.
- **API failure:** UI به fixture synthetic fallback نمی‌کند مگر کاربر از ابتدا در محیط صریح DEMO باشد.

## ۱۲. معماری تحویل پس از تأیید Design Gate

### read modelهای لازم

| read model | مسئولیت |
|---|---|
| Safety Context | mode، synthetic scope، lane state، gateway state و outbound invariant |
| Lane Summary | آخرین run معتبر، pack state، stop reason و شمارنده‌های ثبت‌شده |
| Cap Usage | window/timezone، used، cap، remaining و provenance هر lane |
| Market Ranking | آخرین score به تفکیک lane/run، confidence و scope |
| Evidence Matrix | شش دسته، حالت مشتق‌شده، freshness و gate result |
| Safe Audit Feed | projection allowlisted، cursor و integrity state |

projectionها روی سرور، پس از authentication/RBAC و داخل tenant context ساخته می‌شوند. cache مشترک بین tenantها ممنوع است. داده خام draft، audit details یا identity security events وارد payload عمومی dashboard نمی‌شود.

### ترتیب اجرای آینده

1. تصویب تصمیم‌های مالک در بخش ۱۴؛
2. تعریف contract نسخه‌دار read modelها و semantics حالت MISSING؛
3. افزودن ledger معتبر برای پنجره مصرف و elapsed، پیش از نمایش «روزانه»؛
4. ساخت projection امن audit و pagination؛
5. ساخت shell RTL و نوار safety؛
6. اتصال جدول مصرف، پنل agent، رتبه بازار و ماتریس evidence؛
7. پیاده‌سازی mobile transformation و accessibility؛
8. آزمون truthfulness، RBAC/tenant isolation، failure states، viewport و مرورگر واقعی.

این ترتیب برنامه پیاده‌سازی نیست و اجازه شروع کدنویسی نمی‌دهد؛ فقط dependencyهای طراحی را مشخص می‌کند.

## ۱۳. معیار پذیرش Design

- نوار `DEMO / SYNTHETIC / RESEARCH_ONLY / Outbound=0` در تمام viewportها دائماً قابل مشاهده است.
- هیچ مقدار absent به صفر، درصد یا trend تبدیل نمی‌شود.
- هر مقدار عددی نوع `CONFIG FACT`، `OBSERVED FACT` یا `DERIVED` و provenance قابل مشاهده دارد.
- مصرف هر lane از دو lane دیگر مستقل است و پنجره/timezone مبهم نیست.
- رتبه‌بندی فقط برای lane انتخاب‌شده و آخرین run معتبر انجام می‌شود.
- ماتریس هر شش دسته و هر چهار حالت را بدون اتکا به رنگ پوشش می‌دهد.
- UNKNOWN، INFERENCE و MISSING همگی Human-Send را blocked نگه می‌دارند.
- ServiceFlow فعال‌درحال‌توسعه و BeautyFlow/BriefFlow validation backlog بدون ادعای آمادگی نمایش داده می‌شوند.
- audit خام، secret، PII، draft body یا error stack به client نمی‌رسد.
- Viewer به جزئیات audit دسترسی ندارد، مگر مالک صریحاً مدل دیگری را تصویب کند.
- موبایل بدون overflow افقی، با ترتیب RTL و دسترسی صفحه‌کلید/screen reader قابل استفاده است.
- هیچ کنترل outbound، پرداخت، تبلیغ، رزرو یا ارسال در G0 وجود ندارد.

## ۱۴. تصمیم‌های نیازمند تأیید مالک

1. **جهت بصری و معماری اطلاعات:** تأیید Evidence-first Operational Cockpit با نوار safety دائمی و ترتیب مصرف ← ایجنت‌ها ← بازار ← evidence ← audit.
2. **معنای Outbound=0:** تأیید اینکه این عبارت invariant ایمنیِ احرازشده سرور است، نه KPI و نه مقدار hardcoded client؛ در نبود احراز، وضعیت MISSING و block کامل نمایش داده شود.
3. **مرز مصرف روزانه:** انتخاب timezone سطح tenant و لحظه شروع روز. تا این تصمیم و وجود ledger، فقط «آخرین run / سقف پیکربندی‌شده» نمایش داده می‌شود.
4. **رتبه بازار:** تأیید رتبه مستقل per-lane، رتبه برابر برای score برابر و ممنوعیت ساخت رتبه global/blended یا توصیه ورود.
5. **قاعده evidence:** تأیید تعریف `MISSING` و تقدم `UNKNOWN → FACT → INFERENCE → MISSING` برای حالت اصلی cell، همراه با block بودن هر وضعیت غیر FACT.
6. **دسترسی audit:** تأیید پیشنهاد مشاهده projection پالایش‌شده برای OWNER/OPERATOR و فقط health/sequence برای VIEWER.
7. **retention و export audit:** تعیین policy نگه‌داری و مرجع مجاز export؛ تا آن زمان export در UI وجود ندارد.
8. **زبان بصری:** تأیید ادامه جهت control-plane تیره فعلی با semantic color محدود؛ هیچ font، لوگو یا asset جدید پیش از تأیید و احراز مجوز آن وارد نمی‌شود.

تا تصویب صریح این تصمیم‌ها، وضعیت سند `DESIGN_GATE_AWAITING_OWNER_APPROVAL` باقی می‌ماند و شروع پیاده‌سازی مجاز نیست.
