# ممیزی فاصلهٔ کد موجود تا دموی ۹۰ثانیه‌ای ServiceFlow

- تاریخ: ۲۰۲۶-۰۹-۰۴
- نوع بررسی: read-only source/test audit
- تصمیم محصول مبنا: اولین فروش فقط `ServiceFlow Standard` برای تیم‌های تعمیر و نگه‌داری غیراضطراری ۲ تا ۲۰ نفر
- زنجیرهٔ هدف: درخواست → بررسی → پیشنهاد مسئول → تأیید انسان → مدرک انجام → بستن
- قید ثابت: `ServiceFlow` تنها pack فعال توسعه است؛ سه lane پژوهشی `ServiceFlow`، `BeautyFlow` و `BriefFlow` موازی و `RESEARCH_ONLY` می‌مانند

## نتیجهٔ اجرایی

کد فعلی **دموی عملیاتی ServiceFlow را ندارد**. آنچه پیاده‌سازی شده یک Growth/Research control plane چندمستاجری برای کشف شرکت، امتیازدهی، compliance و پیش‌نویس داخلی است. پایه‌های هویت، tenant isolation، RBAC، repository، PostgreSQL/RLS، audit و fail-closed outbound ارزش بازاستفاده دارند، اما هیچ‌یک جای موجودیت و گردش‌کار درخواست تعمیر را نمی‌گیرند.

برای رسیدن به دموی ۹۰ثانیه‌ای، کوچک‌ترین مرحلهٔ بعدی باید یک vertical slice محلی و کاملاً synthetic از **فقط ServiceFlow** بسازد؛ نه گسترش Growth Core و نه ساخت BeautyFlow/BriefFlow.

## شواهد ممیزی

- تصمیم و سناریوی ۹۰ثانیه‌ای در `docs/research/2026-09-04-manovaflow-final-strategy-decision.md:9-23,111-165` تعریف شده است.
- صفحهٔ اصلی فقط `GrowthDashboard` را render می‌کند: `src/app/page.tsx:1-7`.
- داشبورد فعلی خود را `ManovaFlow research operations dashboard` و `Three parallel lanes` معرفی می‌کند: `src/components/growth-dashboard.tsx:31-145`.
- APIهای کسب‌وکاری موجود فقط dashboard، research run، تصمیم draft و suppression هستند؛ route مربوط به request/case/assignment/evidence وجود ندارد: `src/app/api/`.
- payload مسیر research شرکت‌محور است و `candidateSchema` می‌گیرد، نه درخواست تعمیر: `src/app/api/research/run/route.ts:9-51`.
- قابلیت‌های RBAC فقط `VIEW_DASHBOARD`، `RUN_RESEARCH`، `MANAGE_SUPPRESSION` و `DECIDE_DRAFT` هستند: `src/modules/growth/domain/rbac.ts:3-34`.
- `serviceflowManifest` فعلی manifest بازاریابی است: ICP، scoring، claim، cap و draft؛ intake schema، state، transition، technician skill یا approval rule ندارد: `src/modules/growth/manifests/serviceflow.ts:3-54` و `src/modules/growth/manifests/types.ts:4-18`.
- migration رشد جدول‌های research/company/score/compliance/draft/audit را دارد، اما `cases`، `service_requests`، `tasks`، `assignments`، `approvals`، `completion_evidence` و `workflow_events` ندارد: `db/migrations/0001_growth_core.sql:26-179`.
- fixture و CLI موجود فقط شرکت‌های ساختگی سه lane را اجرا می‌کنند، نه درخواست تعمیر: `src/modules/growth/demo/fixtures.ts` و `scripts/run-demo.ts`.
- اجرای تازهٔ تست‌های غیرintegration: **۳۰ فایل از ۳۰ و ۱۷۵ تست از ۱۷۵ پاس**؛ exit code صفر. این نتیجه سلامت محدودهٔ موجود را نشان می‌دهد، نه وجود دموی ServiceFlow.

## جدول موجود / ناقص / غایب

| قابلیت موردنیاز | وضعیت | شاهد فعلی | فاصله تا دمو |
|---|---|---|---|
| تصمیم محصول و ICP تیم ۲ تا ۲۰ نفر | **موجود** | سند راهبرد و ICP در manifest رشد | تصمیم ثبت شده، اما هنوز قرارداد اجرایی محصول نیست |
| سه lane پژوهشی موازی و مستقل | **موجود** | `run-parallel.ts`، dashboard و تست‌ها | باید در مرحلهٔ بعد بدون تغییر رفتار حفظ شوند |
| حالت Research-Only و ممنوعیت outbound | **موجود** | `outboundEnabled=false`، gateway مسدود و compliance gate | برای دمو نیز invariant باقی بماند |
| هویت server-owned، membership و tenant context | **موجود** | ماژول identity، session و request auth | قابل بازاستفاده برای commandهای ServiceFlow |
| RLS و tenant isolation در PostgreSQL | **موجود به‌عنوان پایه** | migration و تست‌های repository/identity | جدول‌های عملیاتی ServiceFlow هنوز وجود ندارند |
| الگوی repository، idempotency و audit | **موجود به‌عنوان پایه** | GrowthRepository و audit فعلی | قراردادهای آن فقط Growth هستند؛ قابل استفاده مستقیم برای case نیستند |
| ServiceFlow operational manifest | **ناقص** | manifest فعلی فقط scoring/caps پژوهشی دارد | `intake_schema`، service catalog، states، transitions، policies، skills و approval rules غایب‌اند |
| ورودی درخواست تعمیر | **غایب** | فرم، schema، entity و command وجود ندارد | گام «درخواست» قابل نمایش نیست |
| کاتالوگ خدمت، مناطق، ساعات و مهارت‌ها | **غایب** | فقط signalهای پژوهشی وجود دارند | validation قطعی ورودی مرجع ندارد |
| کنترل کامل‌بودن درخواست | **غایب** | `candidateSchema` مربوط به شرکت است | `needs_info` برای درخواست عملیاتی وجود ندارد |
| تشخیص و توقف اضطراری/ناامن/خارج از دامنه | **غایب در محصول** | risk flag رشد فقط نامزد بازار را kill می‌کند | هیچ policy روی متن درخواست یا transition امن وجود ندارد |
| پیشنهاد مسئول و بازه زمانی | **غایب** | technician/skill/schedule/proposal مدل نشده‌اند | گام «پیشنهاد مسئول» قابل اجرا نیست |
| تأیید نام‌دار انسانی | **ناقص و نامرتبط** | Owner می‌تواند draft پژوهشی را approve/reject کند | approval تخصیص، actor، reason و state transition وجود ندارد |
| state machine درخواست | **غایب** | فقط stateهای run و lane رشد وجود دارند | نه stateهای `new` تا `closed` و نه guard گذارها پیاده‌اند |
| صف کار و برد وضعیت | **غایب** | UI فقط dashboard پژوهش/بازار است | درخواست عادی و خطرناک روی برد نمایش داده نمی‌شوند |
| شروع/توقف/ادامهٔ کار | **غایب** | task/assignment command وجود ندارد | `assigned → in_progress → blocked/resume` قابل نمایش نیست |
| مدرک انجام | **غایب** | evidence فعلی فقط URL شاهد بازار است | completion evidence عملیاتی با actor/time/type وجود ندارد |
| بستن پرونده با guard | **غایب** | case یا close command وجود ندارد | بستن بدون completion/evidence قابل جلوگیری نیست |
| audit trail عملیاتی | **ناقص** | audit رشد و audit امنیتی وجود دارند | event vocabulary و relation به request/assignment/evidence غایب است |
| معیارهای ServiceFlow و CSV | **غایب** | dashboard فقط cap و market/company score دارد | owner، زمان تخصیص، درخواست بی‌مالک، touch، closure-with-evidence و exception محاسبه نمی‌شوند |
| fixture دو درخواست دموی ۹۰ثانیه‌ای | **غایب** | fixtureها شرکت‌های ساختگی بازارند | درخواست عادی و مورد مشکوک به خطر seed نشده‌اند |
| reset قطعی و replay دموی ServiceFlow | **غایب** | seed دیتابیس فقط growth/market را upsert می‌کند | reset شناسه/زمان/نتیجهٔ ثابت برای demo وجود ندارد |
| API فرمان‌های ServiceFlow | **غایب** | routeهای فعلی فقط Growth و Identity هستند | create/evaluate/approve/start/evidence/complete/close/reset endpoint ندارند |
| تجربهٔ ۹۰ثانیه‌ای قابل اجرا | **غایب** | route یا view محصولی وجود ندارد | سناریوی مستند هنوز فقط متن است |

## کوچک‌ترین مرحلهٔ ساخت بعدی

### `SF-DEMO-1 — Synthetic Local Request-to-Close Vertical Slice`

هدف این مرحله فقط اثبات دموی ۹۰ثانیه‌ای با دادهٔ کاملاً ساختگی است. هیچ اتصال، پیام، GPS، قیمت، پرداخت، قطعه، تقویم یا دادهٔ واقعی وارد نمی‌شود.

### دامنهٔ حداقلی

1. **ماژول مستقل ServiceFlow**
   - درخت مستقل از `modules/growth`؛ سه lane پژوهشی تغییر رفتار نکنند.
   - قرارداد نسخه‌دار برای خدمت، منطقه، ساعات، مهارت و transition.

2. **مدل دامنهٔ کوچک**
   - `ServiceRequest`
   - `AssignmentProposal`
   - `AssignmentApproval`
   - `CompletionEvidence`
   - `ServiceFlowEvent`
   - تکنسین‌ها و داده‌ها فقط synthetic و visibly `DEMO`.

3. **state machine قطعی**
   - `new → needs_info | review | blocked`
   - `review → approved → assigned`
   - `assigned → in_progress`
   - `in_progress → blocked | completed`
   - `blocked → review | in_progress` فقط با command مجاز و reason
   - `completed → closed`
   - هیچ transition ضمنی، LLM-owned یا خارج از allowlist مجاز نباشد.

4. **policy قطعی پیش از پیشنهاد**
   - required fields
   - service allowlist
   - service area
   - fixed hours
   - required skill
   - emergency/unsafe/unknown fail-closed
   - پیشنهاد فقط recommendation است و هرگز assignment ایجاد نمی‌کند.

5. **repository port + in-memory demo implementation**
   - tenant-scoped، idempotent و دارای append-only event sequence.
   - این مرحله persistence production را ادعا نکند؛ migration عملیاتی به مرحله بعد موکول شود.

6. **command layer سروری**
   - create/evaluate، approve proposal، start، block/resume، attach synthetic evidence، complete، close و deterministic reset.
   - actor/tenant فقط از مرز احراز هویت موجود بیاید؛ هیچ identity از payload پذیرفته نشود.

7. **یک صفحهٔ واحد دموی ServiceFlow**
   - intake دو درخواست synthetic
   - نتیجه validation و دلیل block
   - proposal card بدون assignment خودکار
   - کنترل approval انسانی
   - برد وضعیت
   - افزودن مدرک ساختگی از asset یا fixture داخلی، نه upload واقعی
   - audit timeline و شش معیار دمویی
   - دکمه reset قطعی

### ترتیب نمایش ۹۰ ثانیه

| بازه | رفتار قابل اثبات |
|---|---|
| ۰–۱۵ ثانیه | reset، سپس نمایش یک درخواست کامل غیراضطراری و یک گزارش مشکوک به خطر |
| ۱۵–۳۵ ثانیه | نمایش نتایج completeness/service/area/hours/skill policy |
| ۳۵–۵۵ ثانیه | درخواست عادی در `review` با proposal؛ مورد خطرناک در `blocked` و بدون proposal |
| ۵۵–۷۵ ثانیه | Owner/Operator پیشنهاد را با actor و reason تأیید می‌کند؛ درخواست به `assigned` و سپس `in_progress` می‌رود |
| ۷۵–۹۰ ثانیه | مدرک ساختگی ثبت، `completed → closed` اجرا و audit/metrics به‌روزرسانی می‌شود |

### خارج از این مرحله

- PostgreSQL operational migration و ادعای persistence
- هر provider یا connector
- ورودی واقعی مشتری
- upload/storage واقعی فایل
- اطلاع‌رسانی، ایمیل، WhatsApp یا تماس
- GPS، ETA، route، inventory، parts یا payment
- ساخت BeautyFlow یا BriefFlow
- deploy، production hardening یا ادعای آماده‌فروش بودن

## ۲۰ سناریوی قبولی SF-DEMO-1

| # | سناریو | نتیجهٔ الزامی | سطح تست |
|---:|---|---|---|
| ۱ | reset از هر وضعیت اجرا شود | دقیقاً دو درخواست fictional با داده، ترتیب و نتیجهٔ تکرارپذیر ساخته شوند؛ هیچ دادهٔ قبلی باقی نماند | E2E |
| ۲ | درخواست کاملِ نشتی غیراضطراری در خدمت/منطقه/ساعات مجاز ثبت شود | `new → review` و نتیجهٔ همه policyها ثبت شود | Domain + E2E |
| ۳ | شرح یا آدرس خدمت ناقص باشد | `new → needs_info`؛ فهرست فیلدهای ناقص و audit ثبت، proposal غایب | Domain |
| ۴ | نوع خدمت خارج از allowlist باشد | `blocked` با reason=`OUT_OF_SCOPE_SERVICE`؛ assignment و proposal غایب | Domain |
| ۵ | آدرس خارج از service area باشد | `blocked` با reason=`OUT_OF_SERVICE_AREA`؛ هیچ مسئول خودکار تعیین نشود | Domain |
| ۶ | زمان درخواستی خارج از ساعات ثابت باشد | `blocked` با reason=`OUTSIDE_SUPPORTED_HOURS`؛ تغییر زمان فقط با command انسانی | Domain |
| ۷ | متن حاوی نشانهٔ خطر فوری یا اضطرار باشد | fail-closed به `blocked/POSSIBLE_EMERGENCY`؛ نه proposal، نه completed و نه closed | Safety + E2E |
| ۸ | signal ایمنی مبهم یا ناشناخته باشد | `blocked/SAFETY_UNKNOWN`؛ مدل یا fallback حق safe فرض‌کردن ندارد | Safety |
| ۹ | فقط یک تکنسین synthetic فعال با skill/area/time مطابق وجود داشته باشد | proposal همان تکنسین و بازه را همراه rule version و explanation برگرداند | Domain |
| ۱۰ | دو تکنسین واجد شرایط امتیاز برابر داشته باشند | tie-break قطعی و تکرارپذیر باشد؛ اجرای مجدد proposal یکسان بدهد | Domain |
| ۱۱ | هیچ تکنسین واجد شرایط نباشد | `blocked/NO_ELIGIBLE_ASSIGNEE`؛ assignment غایب و exception metric افزایش یابد | Domain |
| ۱۲ | proposal تولید شود ولی هنوز تأیید انسانی نشده باشد | request در `review`، owner/assignee تهی و outbound صفر بماند | Integration |
| ۱۳ | Owner یا Operator همان tenant proposal را با reason تأیید کند | approval نام‌دار ثبت و `review → approved → assigned` انجام شود | Integration + API |
| ۱۴ | Viewer برای approve اقدام کند | پاسخ forbidden، state و event sequence بدون تغییر | Authorization |
| ۱۵ | actor متعلق به tenant دیگر request را بخواند یا تغییر دهد | پاسخ fail-closed بدون افشای وجود رکورد؛ هیچ mutation رخ ندهد | Tenant isolation |
| ۱۶ | create یا approve با idempotency key یکسان replay شود | همان نتیجه بازگردد؛ request، approval و audit event تکراری ساخته نشود | Integration |
| ۱۷ | transition نامعتبر مانند `new → closed` یا `blocked → assigned` درخواست شود | command رد و state اتمیک حفظ شود؛ دلیل رد ثبت شود | Domain + Integration |
| ۱۸ | request تأییدشده شروع شود و سپس بدون reason مسدود/ادامه داده شود | `assigned → in_progress` مجاز؛ block/resume بدون reason رد شود | Domain |
| ۱۹ | complete بدون completion evidence درخواست شود | transition رد؛ با مدرک synthetic معتبر، actor/time/type ثبت و `in_progress → completed` انجام شود | Domain + E2E |
| ۲۰ | close روی request completed اجرا شود | فقط `completed → closed`؛ audit کامل actor/time/reason، معیار closure-with-evidence و صف به‌روز، outbound/purchase/message همگی صفر | E2E |

## دروازهٔ پایان مرحله

`SF-DEMO-1` فقط وقتی تمام است که:

- هر ۲۰ سناریو سبز باشند؛
- دموی زمان‌گیری‌شده حداکثر ۹۰ ثانیه طول بکشد؛
- مورد خطرناک در هیچ frame یا state به assignee/completed/closed نرسد؛
- proposal با assignment اشتباه نمایش داده نشود؛
- actor، زمان، reason و transition برای هر mutation قابل مشاهده باشند؛
- reset دو بار متوالی snapshot یکسان بسازد؛
- دو tenant synthetic هیچ شناسه، count، request یا event مشترک قابل مشاهده نداشته باشند؛
- سه lane پژوهشی و تست‌های فعلی بدون تغییر رفتار سبز بمانند؛
- outbound، purchase، provider call و credit usage همگی صفر باشند.

## تصمیم پیشنهادی

مرحلهٔ بعد فقط `SF-DEMO-1` باشد. ابتدا contract و ۲۰ تست فوق، سپس domain/repository/command/UI به‌صورت یک vertical slice ساخته شوند. تا عبور از این gate، عبارت درست برای محصول **«دموی محلی synthetic در حال ساخت»** است؛ نه محصول آماده‌فروش، نه pilot-ready و نه production-ready.
