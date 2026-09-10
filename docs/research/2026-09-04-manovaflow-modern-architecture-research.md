# پژوهش معماری مدرن ManovaFlow

**تاریخ ارزیابی:** ۲۰۲۶-۰۹-۰۴  
**نوع سند:** پژوهش و تصمیم معماری؛ بدون پیاده‌سازی، استقرار یا فعال‌سازی سرویس بیرونی  
**دامنه:** هسته SaaS چندمستاجری + Industry Pack/Manifest، سه Growth Agent مستقل، Human Approval، Audit، Suppression و Legal & Compliance Gate  
**وضعیت قطعی Growth:** `G0 / RESEARCH_ONLY`؛ هیچ ارسال، تماس، تبلیغ، رزرو، خرید لیست، credential یا outbound gateway فعال مجاز نیست.

---

## ۱. قرارداد شواهد و روش ارزیابی

این سند سه برچسب را به‌صورت سخت‌گیرانه به‌کار می‌برد:

- **FACT:** از کد/اسناد همین workspace یا منبع اولیه و مستقیم قابل مشاهده است.
- **INFERENCE:** تصمیم یا نتیجه مهندسی حاصل از مقایسه شواهد؛ باید پیش از اجرا به ADR یا آزمون پذیرش تبدیل شود.
- **UNKNOWN:** بدون آزمایش، تصمیم حقوقی، داده عملیاتی یا قرارداد فروشنده قابل اثبات نیست و باید fail-closed بماند.

منابع بیرونی همگی در تاریخ ۲۰۲۶-۰۹-۰۴ بازبینی شده‌اند. قیمت، محدودیت سرویس، مدل‌های AI، فهرست زبان‌ها و SLA متغیرند؛ بنابراین هر عدد متغیر با تاریخ آمده و باید در زمان خرید دوباره بررسی شود. استفاده از یک منبع در این سند به معنی تایید ادعای بازاریابی فروشنده نیست.

### حدود این ارزیابی

- فایل‌های راهبردی، محصول، پیکربندی و هسته دامنه موجود به‌صورت read-only بررسی شدند.
- هیچ سرویس خارجی، دیتابیس، credential، outbound gateway یا agent بیرونی فعال نشد.
- این سند نظر حقوقی نیست. تشخیص قلمرو، مبنای قانونی، انتقال بین‌المللی داده و مجازبودن outreach باید برای هر بازار توسط مسئول حقوقی مجاز ثبت شود.
- به‌دلیل نبود metadata قابل‌استفاده Git در ریشه مشاهده‌شده، وضعیت تغییرات با فهرست و SHA-256 فایل‌های در دامنه کنترل شد.

---

## ۲. خلاصه مدیریتی و تصمیم نهایی

### پاسخ کوتاه

**INFERENCE — معماری مناسب ManovaFlow در ۲۰۲۶ یک modular monolith سخت‌مرزبندی‌شده با Next.js + TypeScript + PostgreSQL است؛ نه microservice mesh و نه «چند agent آزاد».** هسته مشترک باید مالک tenant isolation، identity، workflow state، policy، approval، suppression، audit، budget، lifecycle و action execution باشد. Industry Pack فقط داده و قواعد versioned/certified فراهم می‌کند و اجازه ندارد این کنترل‌ها را دور بزند.

برای مرحله فعلی:

1. **PostgreSQL منبع حقیقت** و shared-pool + RLS مدل پیش‌فرض M0 تا اولین production است؛ همه کلیدهای خارجی tenant-owned باید composite و شامل `tenant_id` باشند.
2. **صف Postgres-backed** در کنار state machine صریح، transactional outbox/inbox و idempotency ledger انتخاب پایه است. `pg-boss` گزینه کم‌هزینه و هم‌راستا با stack فعلی است؛ لایه داخلی `WorkflowPort` باید امکان جایگزینی با Temporal را حفظ کند.
3. **Temporal اکنون انتخاب پیش‌فرض نیست**؛ فقط وقتی human waitهای طولانی، چند سرویس مستقل، compensation پیچیده یا بار recovery از آستانه‌های این سند عبور کرد، با ADR و migration rehearsal پذیرفته شود.
4. سه Growth Agent، **سه lane مستقل روی یک runtime مشترک** هستند: ServiceFlow، BeautyFlow و BriefFlow صف، budget، rate، state، report و kill switch مستقل دارند؛ داده پایه سازمان، suppression، audit، policy و dashboard مشترک است.
5. در G0، «agent» فقط **پیشنهاد ساختاریافته** تولید می‌کند. تنها Action Gateway قطعی و غیرمدلی می‌تواند action intent را بررسی کند. در این مرحله outbound adapter اصلاً deploy نمی‌شود، secretی برای آن وجود ندارد و budget ارسال برابر صفر است.
6. providerهای مدل پشت `ModelGateway` داخلی قرار می‌گیرند؛ schema معتبر شرط لازم است، نه اثبات حقیقت. routing بر اساس task class، زبان، residency، risk، eval و سقف هزینه است؛ fallback فقط در همان safety tier مجاز است.
7. **متن و Web Chat قبل از Voice/Telephony**. فارسی، عربی، ترکی، فرانسوی، کردی مرکزی و کردی شمالی با BCP 47 و direction مستقل مدل می‌شوند. voice تا عبور از benchmark محلی و Legal Gate، آزمایشگاهی و بدون route/credential مخابراتی می‌ماند.
8. Legal Agent و Compliance Gate **وکیل نیستند و مجوز صادر نمی‌کنند**؛ منبع رسمی، حوزه، تاریخ، UNKNOWNها، checklist و ارجاع انسانی را ثبت می‌کنند. تنها انسان دارای اختیار می‌تواند decision record صادر کند.

### حکم درباره طرح‌های فعلی

| بخش | حکم | دلیل |
|---|---|---|
| Common Core + versioned Industry Pack/Manifest | **صحیح؛ حفظ شود** | از تکثیر tenant/auth/workflow/audit جلوگیری می‌کند و محصول عمودی را قابل‌تکرار می‌سازد. |
| Modular monolith و Postgres | **صحیح؛ حفظ شود** | برای تیم و مرحله فعلی کم‌هزینه‌ترین مسیر با atomicity قوی است. |
| سه Growth lane موازی با core مشترک | **صحیح با اصلاح واژگان** | سه bounded workflow هستند، نه سه سامانه خودمختار یا سه codebase. |
| G0 Research-Only، suppression و no-credential | **صحیح و غیرقابل‌مذاکره** | بهترین کنترل برای جلوگیری از side effect ناخواسته در مرحله کشف است. |
| One-day provisioning factory کامل | **بیش‌ازحد پیچیده برای اکنون** | compiler، country pack، pricebook، dedicated cell و voice همزمان، ریسک تحویل و امنیت را زیاد می‌کند. |
| Temporal/OPA/Kubernetes/microservices از M0 | **زودهنگام** | هزینه عملیاتی و failure mode جدید می‌آورد بدون آن‌که بار فعلی آن را توجیه کند. |
| ServiceFlow تنها pack فعال؛ BeautyFlow/BriefFlow در validation backlog | **صحیح** | Growth research lanes می‌توانند موازی بمانند، اما ساخت محصول باید یک vertical در هر مرحله باشد. |

---

## ۳. وضعیت فعلی workspace: آنچه واقعاً وجود دارد

### FACT — موجود و قابل مشاهده

- stack پایه در `package.json`: Next.js 16.3.4، React 19.2.8، TypeScript 7.0.2، PostgreSQL client و Zod؛ نسخه‌ها فقط وضعیت workspace هستند، نه گواه production readiness.
- TypeScript strict، `noUncheckedIndexedAccess` و `exactOptionalPropertyTypes` فعال‌اند.
- PostgreSQL 18 محلی در Compose با bind روی loopback و volume نام‌دار تعریف شده است.
- هسته دامنه کوچک شامل:
  - سه lane ثابت `serviceflow`، `beautyflow` و `briefflow`؛
  - stateهای Growth از `RESEARCH_ONLY` تا `KILLED`؛
  - candidate schema بدون فیلد تماس شخصی، با ممنوعیت URL محلی/private/credential-bearing؛
  - امتیازدهی قطعی و explainable؛
  - RBAC ساده Owner/Operator/Viewer؛
  - Legal & Compliance Gate که در Human-Send با شواهد ناقص/UNKNOWN fail-closed می‌شود و هیچ authorization token صادر نمی‌کند؛
  - تست‌های واحد برای همین رفتارها.
- یک repository contract و پیاده‌سازی in-memory tenant-scoped برای run/company/score/compliance/draft/suppression/audit، manifestهای سه vertical، profileهای چهار بازار synthetic/research-only و تست‌های مرتبط نیز در snapshot نهایی دیده شدند.
- تنها gateway دارای نام outbound، `DisabledOutboundGateway` است که برای همه channelها `OUTBOUND_DISABLED_RESEARCH_ONLY` و `sideEffects: 0` بازمی‌گرداند؛ این transport/provider adapter واقعی نیست و credential ندارد.
- اسناد موجود به‌درستی بر core مشترک، manifest versioned، G0 بدون outbound، سه lane مستقل و shared approval/audit/suppression تاکید دارند.

### FACT — هنوز موجود یا اثبات‌شده نیست

- schema/migration واقعی، RLS policy، application DB role، connection pooling tenant-safe؛
- repository پایدار PostgreSQL، durable queue، transactional outbox/inbox، retry/DLQ، recovery؛ پیاده‌سازی فعلی repository فقط in-memory است؛
- API/Route Handler، session/auth production، UI/dashboard؛
- manifest compiler، signature/certification، pack install/upgrade/rollback؛
- provider adapter مدل، eval harness، cost ledger، prompt registry؛
- append-only audit با integrity checkpoint؛
- secrets manager، KMS، region/data-cell routing؛
- backup/PITR و restore drill؛
- outbound transport/provider adapter، credential یا ارسال واقعی؛ gateway فعلی عمداً fail-closed و بدون side effect است؛
- voice/telephony path و benchmark زبان؛
- production deploy، load test، penetration test یا tenant escape test.

### UNKNOWN — نیازمند راستی‌آزمایی مستقل

- کیفیت هر مدل AI/ASR/TTS برای داده واقعی فارسی، عربی، ترکی، فرانسوی، `ckb` و `kmr`؛
- الزامات دقیق اقامت و انتقال داده برای مشتری و بازار مشخص؛
- ظرفیت، نرخ خطا، SLO و هزینه واقعی تا وقتی workload profile اندازه‌گیری نشده؛
- قانونی‌بودن هر نوع outreach یا پردازش داده برای بازار/کانال مشخص؛
- RTO/RPO قراردادی مشتری تا قبل از discovery تجاری و risk assessment.

**نتیجه:** کد موجود یک foundation دامنه خوب و fail-closed است، اما production system نیست. مسیر درست، تکمیل کنترل‌های مشترک است؛ نه افزودن autonomous agent یا کانال outbound.

---

## ۴. اصول تغییرناپذیر معماری

1. **Tenant context یک داده کاربرپذیر نیست.** از session تاییدشده ساخته می‌شود و در هر transaction دیتابیس به‌صورت transaction-local تنظیم می‌گردد.
2. **Authorization مساوی isolation نیست.** کنترل دسترسی برنامه و RLS دیتابیس دو لایه مستقل‌اند؛ AWS نیز isolation را مفهومی جدا از authentication/authorization می‌داند: [SaaS isolation mindset](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/isolation-mindset.html).
3. **LLM تصمیم‌گیر نهایی یا executor نیست.** خروجی مدل proposal است؛ policy، budget، approval، suppression و action execution کد قطعی‌اند.
4. **Exactly-once side effect فرض نمی‌شود.** delivery می‌تواند at-least-once باشد؛ idempotency، provider reconciliation و human-visible state اجباری است.
5. **Pack داده/قواعد است، نه privilege boundary.** کد اجرایی third-party در pack مجاز نیست؛ adapter موردنیاز فقط با شناسه allowlisted اعلام می‌شود.
6. **G0 دو قفل مستقل دارد:** capability absent + configuration deny. صفر بودن budget به‌تنهایی کافی نیست.
7. **Audit با log یکی نیست.** log برای عملیات و قابل‌حذف است؛ audit حداقلی، ساختاریافته، append-only و دارای integrity evidence است.
8. **Schema-valid برابر factual نیست.** هر claim نیازمند provenance، observation date و classification است.
9. **زبان، script و direction سه مفهوم جدا هستند.** `lang` جهت را تعیین نمی‌کند؛ W3C الزام به `dir` مستقل را توضیح می‌دهد: [Structural markup and RTL text](https://www.w3.org/International/questions/qa-html-dir).
10. **Legal Gate محافظ تصمیم است، نه تولیدکننده نظر حقوقی.** هر UNKNOWN برای action خارجی blocker است.

---

## ۵. معماری نهایی پیشنهادی

### ۵.۱ نمای متنی سیستم

```text
                             ┌──────────────────────────────┐
                             │  Web UI / Web Chat / Admin   │
                             │  locale + dir + authenticated│
                             └──────────────┬───────────────┘
                                            │ HTTPS
┌───────────────────────────────────────────▼────────────────────────────────────┐
│                         ManovaFlow Modular Monolith                             │
│                                                                                │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────────────────┐  │
│  │ Identity &   │  │ Tenant Context │  │ Policy Decision + Human Approval │  │
│  │ Membership   │──│ / Entitlement  │──│ Legal Gate / Suppression / Budget│  │
│  └──────────────┘  └────────────────┘  └──────────────┬────────────────────┘  │
│                                                       │                       │
│  ┌──────────────────────┐    ┌────────────────────────▼────────────────────┐ │
│  │ Manifest Registry &  │───▶│ Case + Workflow Runtime                    │ │
│  │ Pack Compiler        │    │ state/retry/timer/idempotency/compensation │ │
│  └──────────────────────┘    └──────────────┬─────────────────────────────┘ │
│                                             │                               │
│  ┌──────────────────────────────────────────▼─────────────────────────────┐ │
│  │ Growth Core: one runtime, three isolated lane scopes                   │ │
│  │ ServiceFlow │ BeautyFlow │ BriefFlow                                   │ │
│  │ separate queue/budget/rate/state/report/kill; shared org/suppression   │ │
│  └──────────────────────────────┬─────────────────────────────────────────┘ │
│                                 │ proposal                                  │
│  ┌──────────────┐    ┌──────────▼──────────┐    ┌────────────────────────┐ │
│  │ ModelGateway │───▶│ Tool Proposal Layer │───▶│ Action Gateway         │ │
│  │ + Eval/Cost  │    │ schema + provenance │    │ deterministic recheck  │ │
│  └──────────────┘    └─────────────────────┘    └───────────┬────────────┘ │
│                                                            │ G0: NO ROUTE │
│  ┌─────────────────────┐    ┌───────────────────────────────▼────────────┐ │
│  │ Audit + Observability│◀──│ Connector Adapters / Provider Reconcile    │ │
│  │ lifecycle + lineage  │   │ deployed only after later signed gate      │ │
│  └─────────────────────┘    └────────────────────────────────────────────┘ │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           │ single transaction boundary
                      ┌────────────────────▼────────────────────┐
                      │ PostgreSQL                              │
                      │ RLS + workflow + queue + outbox + audit │
                      │ PITR/WAL + encrypted backups            │
                      └─────────────────────────────────────────┘

Later only: Voice Channel Adapter → ASR → same core → TTS
Never: Voice/LLM → direct connector, DB privilege, credential, or outbound
```

### ۵.۲ ساختار منطقی ماژول‌ها

```text
apps/web
  app/                         # UI, Route Handlers; thin delivery layer
packages/core
  identity/                    # users, memberships, sessions, MFA/SSO ports
  tenancy/                     # tenant context, data-cell routing, entitlements
  manifests/                   # schemas, compiler, signatures, compatibility
  cases/                       # case/task/assignment domain
  workflows/                   # durable state, timers, retry, compensation
  policy/                      # PDP interface, legal gate, suppression, budgets
  approvals/                   # bound one-use approval capability
  growth/                      # shared engine + three lane configurations
  models/                      # provider-neutral gateway, routing, cost/eval
  tools/                       # proposal schemas and tool registry
  actions/                     # deterministic gateway, adapters, reconciliation
  knowledge/                   # tenant-aware retrieval and provenance
  audit/                       # audit event and integrity checkpoint
  lifecycle/                   # retention, export, delete, legal hold
  observability/               # trace/metric/log contracts
  i18n/                        # BCP47, direction, translation lineage
packages/packs
  serviceflow/                 # only ACTIVE_DEVELOPMENT
  beautyflow/                  # VALIDATION_BACKLOG
  briefflow/                   # VALIDATION_BACKLOG
workers/runtime                # same codebase; queue consumers by capability
db/migrations                  # immutable versioned SQL + checksums
db/policies                    # RLS tests/policy definitions
tests/{unit,integration,security,eval,restore}
```

این tree یک **هدف طراحی** است، نه دستور ایجاد فوری monorepo بزرگ. در M0 می‌توان همان repository را با boundaries بالا و deployment واحد نگه داشت.

---

## ۶. مدل هسته مشترک و Industry Pack/Manifest

فرمول موجود حفظ می‌شود:

```text
Shared Core
+ Certified Industry Pack
+ Country Policy Pack (only when legally reviewed)
+ Confirmed Tenant Overlay
= Immutable Solution Manifest Version
```

### مالکیت core در برابر pack

| موضوع | Shared Core | Industry Pack |
|---|---|---|
| tenant، identity، membership، session | مالک انحصاری | فقط role requirement را اعلام می‌کند |
| workflow runtime، retry، timer، idempotency | مالک انحصاری | state/transition declarative می‌دهد |
| approval، suppression، legal gate، budget | مالک انحصاری | rule request می‌دهد؛ امکان تضعیف ندارد |
| audit، retention، export/delete | مالک انحصاری | retention class مجاز را انتخاب می‌کند |
| UI | shell و safe renderer | schema/form/view declarative |
| connector | allowlisted adapter code | فقط capability/adapter requirement بدون secret |
| eval | harness و release gate | dataset/threshold/fixtures عمودی |
| migration | engine و compatibility | data transformation declarative و bounded |

### Manifest envelope اجباری

هر manifest نصب‌شده باید حداقل این metadata را داشته باشد:

- `manifest_id`, `pack_id`, `pack_version`, `schema_version`, `compiler_version`؛
- `tenant_overlay_version`, `country_policy_version`, `content_digest`؛
- `created_at`, `created_by`, `approved_at`, `approved_by`؛
- `compatibility_range`, `required_capabilities`, `prohibited_capabilities`؛
- `signature`, `signing_key_id`, `supersedes_manifest_id`؛
- `status: DRAFT | VALIDATED | APPROVED | ACTIVE | SUPERSEDED | REVOKED`.

**INFERENCE:** manifest بعد از approval immutable است. تغییر، نسخه جدید می‌سازد؛ workflow جاری به نسخه آغاز خود pin می‌شود. activation transaction شامل compatibility check، safety suite، approval و audit است. rollback به معنی فعال‌کردن نسخه سازگار قبلی است؛ برای migration مخرب «down خودکار» قابل اعتماد نیست.

### کنترل pack supply chain

- pack تنها JSON/YAML canonical مطابق schema ثبت‌شده است؛ templateها در sandbox renderer اجرا می‌شوند.
- script، dynamic import، network URL اجرایی، SQL خام و credential field در pack ممنوع است.
- digest و امضای pack/manifest پیش از install و هر execution کنترل می‌شود.
- test corpus شامل privilege escalation، hidden field، path traversal، oversized payload، prompt injection و downgrade است.

---

## ۷. مدل چندمستاجری و PostgreSQL

### مقایسه tenancy

| مدل | مزیت | هزینه/ریسک | حکم ManovaFlow |
|---|---|---|---|
| shared DB/shared schema + `tenant_id` + RLS | ارزان، migration واحد، analytics ساده | policy اشتباه blast radius بالاتر دارد | **پیش‌فرض M0 تا SMB production** |
| shared DB/separate schema | جداسازی اسمی | schema explosion و migration عملیاتی سخت | **رد** |
| database-per-tenant | isolation/restore اختصاصی بهتر | connection/migration/backup هزینه‌بر | فقط enterprise/regulatory tier |
| deployment stamp/data cell | محدودکردن blast radius و residency | routing و عملیات بیشتر | مسیر scale پس از product-market evidence |

راهنمای Azure نیز shared multitenant store و database-per-tenant را الگوهای معتبر می‌داند و درباره دشواری propagation هویت به RLS و الگوهای table-per-tenant هشدار می‌دهد: [Multitenant storage and data](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data). مدل bridge در AWS هم امکان ترکیب pool و silo را توضیح می‌دهد: [SaaS bridge model](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/bridge-model.html).

### قرارداد RLS

PostgreSQL می‌گوید با فعال‌شدن RLS و نبود policy، رفتار default-deny است؛ اما superuser، `BYPASSRLS` و معمولاً owner جدول آن را دور می‌زنند و `FORCE ROW LEVEL SECURITY` برای owner لازم است: [Row security policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html). بنابراین:

1. migration role مالک DDL است و runtime هرگز از آن استفاده نمی‌کند.
2. app role فاقد `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE` و مالکیت جدول است.
3. همه جدول‌های tenant-owned دارای `tenant_id NOT NULL`، RLS enabled و forced هستند.
4. policy ساده و row-local است؛ policyهای subquery-heavy به‌علت race/lock complexity پذیرفته نمی‌شوند.
5. transaction با `BEGIN` شروع می‌شود، tenant و actor از session تاییدشده با setting transaction-local ثبت می‌شوند، سپس query اجرا می‌گردد؛ connection بدون reset به pool برنمی‌گردد. توابع setting در PostgreSQL: [Configuration settings functions](https://www.postgresql.org/docs/18/functions-admin.html).
6. کلیدهای یکتا و خارجی به‌شکل `(tenant_id, id)` هستند تا cross-tenant reference حتی با bug برنامه ممکن نباشد.
7. admin/support نیز tenant-bound و just-in-time است؛ break-glass زمان‌دار، reason-required و audit شده است.
8. queryهای background، queue و audit نیز tenant context دارند؛ «worker داخلی» استثنا نیست.

### نمونه policy مفهومی، نه کد اجرایی

```sql
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
```

این snippet به‌تنهایی امن نیست؛ role ownership، `FORCE RLS`، transaction boundary و تست cross-tenant بخشی از کنترل‌اند. PostgreSQL همچنین بیان می‌کند referential-integrity checks می‌توانند RLS را bypass کنند؛ schema و خطاها نباید به covert channel تبدیل شوند.

### tenant-aware retrieval

هر document/chunk/embedding دارای `tenant_id`, `classification`, `source_id`, `source_hash`, `observed_at`, `retention_class` است. retrieval ابتدا tenant و سپس user authorization را اعمال می‌کند؛ similarity search بعد از isolation است، نه قبل از آن. مرجع: [Secure multitenant RAG](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/secure-multitenant-rag).

---

## ۸. مهاجرت دیتابیس بدون downtime

### تصمیم

**INFERENCE:** migrationها SQL versioned و immutable با checksum، migration ledger و advisory lock هستند. deploy از الگوی **expand → backfill → switch → contract** پیروی می‌کند. ابزار خاص می‌تواند بعداً انتخاب شود؛ قرارداد مهاجرت نباید به ORM وابسته باشد.

### پروتکل release

1. **Preflight:** نسخه DB، free space، replication lag، lock wait، row count و تخمین backfill.
2. **Expand:** افزودن nullable column/table/index سازگار با نسخه قبلی؛ index بزرگ به‌صورت concurrent در مرحله مستقل.
3. **Dual compatibility:** کد جدید هم schema قدیم و هم جدید را می‌خواند؛ dual-write فقط با idempotency و telemetry.
4. **Backfill:** chunked، resumable، rate-limited، با progress ledger و kill switch.
5. **Validate:** constraint ابتدا `NOT VALID` در صورت مناسب‌بودن، سپس validation کنترل‌شده؛ consistency query و shadow read.
6. **Switch:** feature flag/manifest activation بعد از readiness تمام instanceها.
7. **Contract:** حذف/rename فقط در release بعدی و پس از اثبات صفرخواندن؛ backup جایگزین forward repair نیست.

بسیاری از `ALTER TABLE`ها در PostgreSQL lock سطح `ACCESS EXCLUSIVE` می‌گیرند؛ بنابراین lock budget و rehearsal ضروری است: [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html). الگوی expand-and-contract و تفکیک schema/data migration در [راهنمای data migration Prisma](https://www.prisma.io/docs/guides/database/data-migration) نمونه عملی مناسبی است؛ این ارجاع الزام به انتخاب Prisma نیست.

### acceptance برای هر migration

- checksum mismatch، migration خارج از ترتیب و دو migrator همزمان fail-closed؛
- `lock_timeout` کوتاه و بدون retry بی‌نهایت؛
- rollback plan از نوع forward-fix یا safe deactivate نوشته شده؛
- روی snapshot هم‌اندازه production rehearsal شده؛
- هیچ migration startup-time توسط همه replicaها اجرا نمی‌شود؛ یک release job مجزا مالک آن است.

---

## ۹. Durable workflow و orchestration

### مقایسه گزینه‌های ۲۰۲۵/۲۰۲۶

| گزینه | durability و retry | human wait/compensation | زیرساخت/هزینه | lock-in | امتیاز برای اکنون |
|---|---|---|---|---|---:|
| **Temporal** | replay-based durable execution؛ resume بعد از crash؛ timer/retry قوی | بهترین گزینه برای workflow چندروزه و Saga | Cloud یا cluster تخصصی؛ مدل هزینه action/storage و retry | متوسط تا بالا در workflow semantics | ۳.۸/۵ |
| **Trigger.dev** | managed long-running tasks، queue/concurrency/idempotency | wait token و approval مناسب | Cloud ساده؛ self-host فاقد برخی قابلیت‌های Cloud و راهنمای Docker برای production نیست | متوسط/بالا | ۳.۳/۵ |
| **Inngest** | step result persist و retry از step شکست‌خورده | step/sleep/event برای flow مناسب | managed ساده؛ self-host production به Redis/Postgres خارجی نیاز دارد | متوسط/بالا | ۳.۴/۵ |
| **BullMQ** | queue قوی روی Redis؛ worst-case at-least-once | state machine و compensation با خود تیم | Redis و عملیات مجزا؛ اکوسیستم بالغ | پایین/متوسط | ۳.۵/۵ |
| **pg-boss + app state machine** | `SKIP LOCKED`، retry/backoff/DLQ و transaction هم‌DB | human wait و compensation باید صریح ساخته شود | کمترین هزینه و یک datastore؛ maintainer concentration risk | پایین | **۴.۳/۵** |

#### شواهد مستقیم

- Temporal durable execution را برای ادامه اجرای workflow پس از crash/network failure عرضه می‌کند: [Temporal documentation](https://docs.temporal.io/). retry و activity completion هنوز نیازمند idempotency/reconciliation side effect است؛ حتی activity timed-out ممکن است در دنیای بیرون کامل شده باشد: [Temporal Saga discussion](https://community.temporal.io/t/support-for-saga-compensating-transactions-in-typescript/6392).
- Trigger.dev برای queue/concurrency و idempotency مستندات مستقیم دارد: [queue concurrency](https://trigger.dev/docs/queue-concurrency)، [idempotency](https://trigger.dev/docs/idempotency). سند self-host Docker صراحتاً guide را production-ready نمی‌داند و checkpointing را ندارد: [self-host Docker](https://trigger.dev/docs/self-hosting/docker).
- Inngest نتیجه stepهای تمام‌شده را persist و retry را از step شکست‌خورده ادامه می‌دهد: [Error handling and retries](https://www.inngest.com/docs/guides/error-handling). self-host ساده برای scale production به سرویس‌های خارجی نیاز پیدا می‌کند: [Self-hosting](https://www.inngest.com/docs/self-hosting).
- BullMQ Redis-based است و worst case را at-least-once بیان می‌کند: [BullMQ introduction](https://docs.bullmq.io/). بنابراین «دوبار هرگز اجرا نمی‌شود» نباید فرض شود.
- pg-boss روی PostgreSQL و `SKIP LOCKED` ساخته شده، retry/backoff/dead-letter و ایجاد job در transaction برنامه را پشتیبانی می‌کند: [pg-boss repository](https://github.com/timgit/pg-boss). FACT: همان منبع می‌گوید پروژه عمدتاً توسط یک maintainer نگهداری می‌شود؛ این supply-chain risk باید با pinning، SBOM، takeover plan و abstraction کاهش یابد.

### تصمیم مرحله‌ای

**M0–M2:** `pg-boss` یا wrapper هم‌ارز PostgreSQL-backed پشت `WorkflowPort`، به‌همراه جدول workflow state خود ManovaFlow. business state داخل payload صف دفن نمی‌شود.

**Trigger مهاجرت به Temporal:** اگر حداقل دو شرط برای دو release متوالی برقرار شد:

- بیش از ۲۰٪ workflowهای فعال بیش از ۲۴ ساعت منتظر event/approval می‌مانند؛
- حداقل سه سرویس مستقل و دو side effect بیرونی در یک compensation chain وجود دارد؛
- recovery/manual replay بیش از ۸ نفر-ساعت در ماه هزینه دارد؛
- بیش از ۱۰۰ هزار workflow فعال همزمان یا timerهای انبوه داریم؛
- requirement قراردادی برای multi-region workflow availability وجود دارد.

Temporal Cloud pricing متغیر و action/storage-based است؛ صفحه رسمی هزینه بر billable actions و active/retained storage تاکید دارد: [Temporal Cloud cost](https://go.temporal.io/platform-hub/cost). Trigger.dev در تاریخ بازبینی پلن‌های $0/$10/$50 به‌علاوه compute و Inngest پلن رایگان و Pro از $99 اعلام می‌کردند: [Trigger.dev pricing](https://trigger.dev/pricing)، [Inngest pricing](https://www.inngest.com/pricing). این ارقام **FACT در تاریخ ۲۰۲۶-۰۹-۰۴** و برای بودجه‌ریزی آینده‌اند، نه quote خرید.

### الگوی workflow معتبر

```text
Command accepted
→ transaction: domain state + outbox + idempotency record
→ worker claims job
→ deterministic precondition/policy/suppression/budget recheck
→ if external effect: require valid bound approval
→ create action attempt
→ provider call with provider idempotency key
→ reconcile response/webhook/status
→ transaction: outcome + audit + next state
→ retry only classified transient failures; else DLQ + human task
```

Compensation یک business action مستقل و audit شده است، نه rollback دیتابیس. رزرو لغو‌شده، ایمیل ارسال‌شده یا تماس انجام‌شده با transaction برگشت‌پذیر نیست.

---

## ۱۰. سه Growth Agent: استقلال بدون تکثیر سیستم

### تعریف درست

`ServiceFlowGrowth`, `BeautyFlowGrowth`, `BriefFlowGrowth` سه **Lane Configuration + Workflow Scope** هستند. آنها process یا credential مستقل نیستند. runtime مشترک، هر job را با tuple زیر جداسازی می‌کند:

```text
(tenant_id, lane_key, market_key, run_id, queue_name, budget_policy_version)
```

### مشترک و مستقل

| مشترک | مستقل برای هر lane |
|---|---|
| organization canonical record و alias/dedupe | queue و concurrency cap |
| public source registry و provenance | page/registry/model/token/currency budget |
| suppression و do-not-process | scoring manifest و threshold |
| legal/policy engine و approval service | pack state/readiness |
| audit و cost ledger schema | schedule، retry policy و kill switch |
| dashboard shell و observability | report، outcome metric و owner |

### قواعد G0

- فقط public organization-level pages و registry/association/procurement رسمی allowlist می‌شوند.
- personal email/phone/name، enrichment شخصی، login bypass، CAPTCHA bypass، scraping خلاف terms و خرید list ممنوع است.
- candidate باید `source_url`, `source_kind`, `observed_at`, `source_hash`, `signal`, `classification` داشته باشد.
- suppression قبل از fetch، قبل از draft و قبل از هر action دوباره کنترل می‌شود.
- presentation draft داخلی و واضح با label `DRAFT / NOT SENT` مجاز است.
- `OUTBOUND_SEND`, `CALL`, `AD_BUY`, `BOOK`, `PURCHASE_LIST` در capability registry اجرایی deployment نیستند؛ وجود enum کانال یا `DisabledOutboundGateway` فقط برای اثبات deny قابل‌قبول است. connector secret schema نیز در محیط G0 وجود ندارد.
- violation در tenant boundary، audit gap، suppression gap یا مشاهده outbound capability باعث global Growth kill می‌شود.

### بودجه و rate limit

budget باید reservation-based باشد:

1. پیش از fetch/model call مقدار pessimistic reserve می‌شود.
2. completion، هزینه واقعی را reconcile و باقی‌مانده را آزاد می‌کند.
3. budget شامل page، registry query، token input/output، tool call، wall time، concurrency و currency است.
4. rate limit سه سطح دارد: global provider، tenant، lane/market.
5. manual override فقط با expiry، reason، actor و audit؛ برای G0 نمی‌تواند outbound budget را از صفر عبور دهد.

---

## ۱۱. Agent، Tool و Action execution

### مرزبندی

| لایه | مجاز | غیرمجاز |
|---|---|---|
| Model/Agent | استخراج، طبقه‌بندی، پیشنهاد tool call، draft | دسترسی secret، SQL، network آزاد، approval یا execution |
| Tool Proposal | schema validation، provenance، risk tags | side effect مستقیم |
| Policy Decision Point | allow/deny/review + reason بر ورودی canonical | اعتماد به متن مدل یا tool annotation |
| Approval Service | capability کوتاه‌عمر و تک‌مصرف | token کلی یا قابل انتقال |
| Action Gateway | recheck قطعی و dispatch adapter | اجرای action بدون persisted intent |
| Adapter Worker | least-privilege provider call و reconcile | انتخاب سیاست یا تغییر tenant |

OpenAI Agents SDK نیز tool call را در چارچوبی با schema validation، guardrail و human-in-the-loop ارائه می‌دهد: [Tools](https://openai.github.io/openai-agents-js/guides/tools/)، [Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/). **INFERENCE:** این SDK می‌تواند adapter سطح agent باشد، اما workflow truth، approval و action boundary ManovaFlow نباید به SDK فروشنده واگذار شود.

### Action Intent

هر درخواست action باید شامل موارد زیر باشد:

```text
action_intent_id, tenant_id, actor_id, lane_key, workflow_id,
tool_id, tool_schema_version, target_resource_type/id/version,
canonical_parameters_hash, manifest_digest, policy_version,
suppression_snapshot_id, budget_reservation_id, risk_class,
requested_at, expires_at, idempotency_key
```

### Approval capability

- token opaque با حداقل ۲۵۶ بیت entropy؛ فقط hash آن ذخیره می‌شود.
- bound به tenant، actor/approver، action type، resource version، canonical parameter digest، manifest/policy version، سقف هزینه، expiry و `max_uses=1` است.
- approval مصرف و ایجاد action attempt در یک transaction انجام می‌شود.
- هر تغییر parameter/resource/policy/manifest approval را باطل می‌کند.
- approver نمی‌تواند همان proposer برای risk class بالا باشد؛ separation of duties policy-driven است.
- denial و expiry هم audit event هستند.
- JWT بلندعمر یا `approved=true` روی رکورد action جایگزین این capability نیست.

### MCP و ابزارهای بیرونی

اگر MCP بعدها استفاده شود، token passthrough ممنوع، audience binding و short-lived scoped token اجباری است. مشخصات رسمی MCP درباره جلوگیری از token passthrough و confused-deputy هشدار می‌دهد: [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization). tool description/annotation از server بیرونی trusted policy نیست؛ discovery فقط metadata است و allowlist + schema pin + signature/fingerprint لازم دارد.

### چرا OPA اکنون لازم نیست

OPA تصمیم سیاست را از enforcement جدا می‌کند: [OPA documentation](https://www.openpolicyagent.org/docs). اما deployment جدا، bundle distribution و Rego lifecycle برای M0 سربار است. تصمیم فعلی: `PolicyDecisionPoint` pure و versioned داخل modular monolith، با deny-by-default و test corpus. مهاجرت به OPA فقط وقتی چند service/enforcement point مستقل یا policy administration تیم جدا داریم. OPA به‌صورت پیش‌فرض API authentication ندارد و باید خودش harden شود: [OPA security](https://www.openpolicyagent.org/docs/security).

---

## ۱۲. Prompt injection، excessive agency و داده نامطمئن

OWASP Top 10 for LLM Applications 2025، Prompt Injection و Excessive Agency را از ریسک‌های اصلی معرفی می‌کند: [OWASP GenAI LLM Top 10](https://genai.owasp.org/download/43299/?tmstv=1731900559). کنترل ManovaFlow دفاع چندلایه است:

1. محتوای وب، فایل، tool output و tenant input همگی `UNTRUSTED_DATA` هستند و هرگز system/developer instruction نمی‌شوند.
2. fetcher فقط HTTPS، DNS/IP re-resolution، redirect cap، allowlist نوع محتوا، size/time cap، malware scan و SSRF protection دارد. بررسی hostname رشته‌ای فعلی لازم است اما در برابر DNS rebinding کافی نیست.
3. parsing از reasoning و action جداست؛ fetched content به مدل دارای secret یا action tool داده نمی‌شود.
4. هر output با strict JSON schema و سپس validation دوباره Zod/semantic validation می‌شود.
5. claimها با quote کوتاه/selector، source hash و observed date به evidence متصل می‌شوند؛ instruction موجود در منبع claim نیست.
6. Model هیچ credential، raw connector response حساس یا cross-tenant context نمی‌بیند.
7. egress worker allowlist و capability-based است؛ generic HTTP/browser tool در action runtime مجاز نیست.
8. policy/suppression/budget پس از مدل و بلافاصله پیش از execution recheck می‌شوند.
9. eval corpus شامل indirect injection چندزبانه، homoglyph، bidi override، hidden HTML، PDF instruction و tool-output injection است.
10. incident mode می‌تواند model/tool/fetcher/provider/lane را مستقل kill کند.

NIST AI RMF GenAI Profile چارچوبی برای مدیریت ریسک‌های GenAI در design/development/use/evaluation ارائه می‌کند: [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence). این مرجع compliance certificate نیست؛ مبنای risk register و eval coverage است.

---

## ۱۳. Model routing، portability، cache، eval و cost governance

### تصمیم gateway

`ModelGateway` contract داخلی باید provider-neutral باشد:

```text
ModelRequest {
  task_class, risk_class, locale, data_classification, residency,
  prompt_version, schema_version, allowed_tools, max_tokens,
  deadline, budget_reservation_id, tenant_policy_version
}

ModelResult {
  structured_output, provider, exact_model_id, provider_request_id,
  usage, latency, finish_reason, safety_result, output_hash,
  provenance_refs, cache_status
}
```

### گزینه‌ها

| گزینه | مزیت | ریسک | تصمیم |
|---|---|---|---|
| SDK مستقیم هر provider | دسترسی سریع به قابلیت بومی | branching و coupling زیاد | داخل adapterها مجاز |
| Vercel AI SDK | API یکپارچه برای providerهای متعدد | abstraction leak و وابستگی package | client abstraction اختیاری، نه domain contract |
| AI Gateway بیرونی | routing/caching/keys آماده | vendor/data path جدید | فعلاً رد؛ بعد از residency/security review |
| framework agent کامل | tool loop سریع | business state و safety ممکن است در framework دفن شود | فقط proposal layer، نه workflow owner |

Vercel AI SDK خود را toolkit یکپارچه TypeScript برای providerهای متعدد معرفی می‌کند: [AI SDK introduction](https://ai-sdk.dev/docs/introduction). **INFERENCE:** استفاده از آن پشت interface داخلی مناسب است؛ import آن در domain ممنوع.

### structured output و tool call

- provider-native strict structured output در صورت وجود فعال می‌شود.
- خروجی دوباره با schema داخلی و semantic constraints اعتبارسنجی می‌شود.
- Anthropic `strict: true` را برای انطباق tool input با schema مستند کرده است: [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use).
- Gemini structured output subset از JSON Schema را پشتیبانی می‌کند و structured output را از function calling جدا می‌داند: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).
- provider feature parity **UNKNOWN** است؛ adapter contract باید lowest safe common denominator داشته باشد.

### routing policy

route بر اساس benchmark ثبت‌شده برای tuple زیر انتخاب می‌شود:

```text
(task_class, locale, vertical, risk_class, data_classification, region)
```

- مدل ارزان فقط اگر threshold کیفیت همان tuple را پاس کرده باشد.
- fallback تنها به provider/model در همان residency و safety tier و فقط برای task idempotent/no-side-effect.
- timeout مدل action state را موفق نمی‌کند؛ نتیجه دیررس یا duplicate با request id reconcile می‌شود.
- prompt، schema، model و eval dataset version همگی در audit ثبت می‌شوند؛ chain-of-thought ذخیره نمی‌شود.

### cost governance

- `usage_ledger` برای tenant/lane/run/task: input/output/cached tokens، tool/fetch count، latency و هزینه currency-normalized.
- budget reserve پیش از call، reconcile بعد از call و circuit breaker در ۸۰/۹۵/۱۰۰ درصد.
- سقف مستقل per-run، per-day، per-tenant و global provider.
- retry مدل هزینه دارد و باید از همان budget مصرف کند.
- pricing snapshot versioned است؛ گزارش مالی با price فعلی گذشته را بازنویسی نمی‌کند.

### caching

- cache key شامل provider، exact model، prompt/schema version، canonical input hash، locale و safety policy است.
- tenant/private data همیشه tenant-scoped، encrypted و TTL-bound است.
- cross-tenant cache فقط برای منبع عمومی immutable، با license/provenance، بدون tenant overlay و بدون personal data مجاز است.
- approval، policy decision حساس به زمان، suppression، action result و legal conclusion cache نمی‌شوند.

### eval

- golden set برای هر vertical × locale؛ نمونه واقعی فقط با رضایت/کاهش داده و fixture مصنوعی ترجیح دارد.
- معیارها: schema validity، grounded claim precision/recall، citation correctness، unsafe action rate، suppression escape، hallucination، latency و cost.
- adversarial: prompt injection، mixed-script/bidi، عدد/نام/تاریخ، corrupted source، provider timeout و duplicate delivery.
- release gate: regression صفر در tenant/suppression/action safety؛ کیفیت task بر threshold از پیش ثبت‌شده.
- shadow evaluation خروجی تولید می‌کند اما side effect ندارد.

OpenTelemetry برای JavaScript، trace و metric را stable و log را development اعلام می‌کند: [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/). Semantic conventions مربوط به GenAI هنوز در حال تحول‌اند: [GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/). بنابراین schema پایدار داخلی نگه داشته و در exporter map می‌شود.

---

## ۱۴. چندزبانه و RTL: فارسی، عربی، ترکی، فرانسوی و کردی

### locale contract

| زبان | locale پایه پیشنهادی | script/direction | نکته |
|---|---|---|---|
| فارسی | `fa-IR` | `Arab` / RTL | اعداد، تاریخ و نام‌های محلی جداگانه آزمون شوند |
| عربی | بازارمحور مانند `ar-AE` | `Arab` / RTL | `ar` عمومی برای QA صوتی کافی نیست |
| ترکی | `tr-TR` | `Latn` / LTR | casing ترکی و نام‌ها test اختصاصی می‌خواهند |
| فرانسوی | `fr-FR` | `Latn` / LTR | punctuation/number/date locale-aware |
| کردی مرکزی/سورانی | `ckb-Arab` + region در صورت معلوم | `Arab` / RTL | با Kurdish generic ادغام نشود |
| کردی شمالی/کرمانجی | `kmr-Latn` + region در صورت معلوم | `Latn` / LTR | pipeline و eval مستقل از `ckb` |

IANA، `ku` را macrolanguage، `ckb` را Central Kurdish و `kmr` را Northern Kurdish ثبت کرده است: [IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry). ساختار tagها بر BCP 47/RFC 5646 است: [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646).

### قواعد ذخیره و نمایش

- متن اصلی immutable نگه داشته می‌شود؛ normalized/search text فیلد جدا دارد.
- ترجمه هرگز original را overwrite نمی‌کند و `source_locale`, `target_locale`, provider/model/version, confidence و human review دارد.
- `lang` و `dir` در document/segment جدا هستند؛ برای محتوای runtime از `dir="auto"` و برای قطعات mixed direction از `bdi`/isolation استفاده می‌شود.
- CSS logical properties (`inline-start/end`) پیش‌فرض است؛ W3C استفاده از `dir` در markup و logical properties را توصیه می‌کند: [W3C RTL guidance](https://www.w3.org/International/questions/qa-html-dir).
- شناسه، domain، مبلغ، شماره، تاریخ، citation و نام خاص خودکار ترجمه نمی‌شوند.
- Unicode bidi control characters هنگام ingest آشکار/flag می‌شوند؛ حذف کورکورانه مجاز نیست چون ممکن است معنای واقعی زبان را خراب کند. الگوریتم مرجع: [Unicode Bidirectional Algorithm](https://www.unicode.org/reports/tr9/).

---

## ۱۵. Voice و Telephony: بعداً و فقط پشت همان مرزها

### تصمیم

**INFERENCE:** هیچ voice agent جدا از core ساخته نمی‌شود. channel adapter فقط eventهای canonical ایجاد می‌کند:

```text
WebRTC/SIP/PSTN Adapter
→ audio session + consent event
→ ASR chunks + confidence + timestamps
→ same Conversation/Policy/Approval/Action Core
→ response text
→ TTS
→ interruption/barge-in and delivery receipts
```

Voice هیچ route مستقیم به connector/action ندارد. recording پیش‌فرض خاموش است؛ consent، retention و redaction بازارمحورند. DTMF/number/name confirmation برای action حساس اجباری است.

### انتخاب provider با benchmark، نه فهرست زبان

فهرست فعلی Microsoft Speech زبان‌ها و featureها را به‌صورت جداگانه اعلام می‌کند: [Azure Speech language support](https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/language-support). Deepgram نیز فهرست مدل/زبان را منتشر می‌کند: [Deepgram models and languages](https://developers.deepgram.com/docs/models-languages-overview). **FACT:** وجود یک زبان در translation، STT یا TTS به معنی پشتیبانی در دو modality دیگر یا کیفیت مناسب نیست. **UNKNOWN:** کیفیت production برای کردی مرکزی/شمالی و لهجه‌های بازار تا benchmark محلی اثبات نشده است.

### Voice readiness gate

- corpus رضایت‌دار/مصنوعی برای هر locale و channel؛
- WER/CER، entity accuracy برای نام/عدد/مبلغ/تاریخ، intent accuracy، P95 latency، interruption و noise؛
- disclosure و consent wording تاییدشده بازار؛
- data residency/DPA/subprocessor review؛
- human takeover، emergency phrase و kill switch؛
- no-recording mode و retention deletion tested؛
- credential و route فقط بعد از approval محیط production ایجاد می‌شود.

تا آن زمان voice **LAB_ONLY** و telephony **ABSENT** است.

---

## ۱۶. Audit append-only، observability و incident recovery

### audit event حداقلی

```text
event_id, tenant_id, occurred_at, ingested_at,
actor_type/id, impersonation_context, trace_id,
action, resource_type/id/version, decision, reason_codes,
policy/manifest/prompt/schema/model/tool versions,
input_hash, output_hash, source_refs,
approval_id, idempotency_key, provider_request_id,
outcome, previous_event_hash, event_hash
```

- audit insert توسط role جدا و append-only انجام می‌شود؛ update/delete برای app role ممنوع.
- payload حداقلی است؛ secret، raw token، password، full prompt حساس و chain-of-thought هرگز audit نمی‌شوند.
- hash chain tamper-evident است، اما در برابر DB admin **immutable نیست**.
- در production، checkpoint دوره‌ای با signature به account/storage جدا با retention lock/WORM صادر می‌شود.
- clock source، canonical serialization و key rotation versioned هستند.

### observability

- **Metrics:** request/workflow/action success، queue lag، retry/DLQ، approval age، suppression blocks، RLS denies، cost/budget، model quality drift.
- **Traces:** UI command → DB transaction → queue → model/tool/action؛ baggage شامل PII یا tenant raw input نیست.
- **Logs:** ساختاریافته، redacted، sampling-aware و lifecycle جدا؛ audit به log sink معمولی وابسته نیست.
- correlation IDs با provider request IDs ثبت می‌شوند، ولی provider payload حساس replicate نمی‌شود.

### SLOهای پیشنهادی اولیه — INFERENCE

| شاخص | هدف اولیه | توضیح |
|---|---:|---|
| availability control plane | 99.9% ماهانه | بعد از اولین production baseline بازتنظیم شود |
| P95 API read/write | < 500ms / < 800ms | مدل/connector async خارج از این SLO |
| queue start lag P95 | < 30s | برای G0 research |
| audit completeness | 100% action/decision | gap = incident و kill برای lane مربوط |
| suppression enforcement | 100% در سه checkpoint | هر escape = severity بالا |
| tenant isolation escape | 0 | release blocker و incident بحرانی |
| RPO | ≤ 15 دقیقه | نیازمند WAL/PITR و بودجه تاییدشده |
| RTO | ≤ 4 ساعت | تا restore drill فقط هدف، نه تضمین |

### backup و restore

PostgreSQL، base backup + WAL archiving را برای PITR مستند می‌کند: [Continuous archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html). `pg_dump` به‌تنهایی برنامه DR کافی برای production نیست.

- encrypted automated base backup + continuous WAL به account/region جدا؛
- backup access role جدا، MFA و restore-only credential؛
- restore ماهانه خودکار به محیط isolated و consistency/security tests؛
- restore drill فصلی با اندازه production و ثبت RPO/RTO واقعی؛
- tenant-level export/delete با lifecycle ledger؛ point-in-time restore عمومی جای tenant restore semantics را نمی‌گیرد؛
- runbook برای lost region، corrupt migration، leaked credential، prompt injection و outbound misfire.

راهنمای incident response فعلی NIST در ۲۰۲۵ با SP 800-61r3 منتشر و r2 را جایگزین کرده است: [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final).

---

## ۱۷. Secrets، encryption، residency و lifecycle

### secrets

- prod با workload identity/service identity و short-lived credential؛ static master API key در env مشترک ممنوع.
- secret manager خارجی source of truth؛ DB فقط `secret_ref`, version, scope, owner و rotation metadata را نگه می‌دارد.
- connector credential tenant-specific با envelope encryption و KMS key hierarchy؛ decrypt فقط در adapter worker مجاز.
- dev/stage/prod account و key جدا؛ `.env` محلی فقط fixture synthetic و بدون outbound secret.
- secret rotation، revocation و access audit tested؛ secret هیچ‌گاه در prompt، trace، log یا DLQ payload نیست.

### encryption و residency

- TLS برای transit، encryption volume/backup برای rest، field-level/envelope encryption برای token و داده بسیار حساس.
- tenant دارای `home_region`, `allowed_processing_regions`, `allowed_model_providers`, `data_classification_policy` است.
- control plane فقط metadata کم‌حساسیت نگه می‌دارد؛ data plane region-pinned است.
- cross-region analytics از داده aggregate/de-identified و policy-approved؛ raw tenant data به data lake عمومی نمی‌رود.
- DPA، subprocessors، training/retention setting فروشنده و transfer mechanism پیش از provider activation ثبت می‌شود.

GDPR بر data minimization، storage limitation و security تاکید دارد: [متن رسمی GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)، [European Commission data protection principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en). **UNKNOWN:** applicability و lawful basis برای هر tenant/use case تا ارزیابی حقوقی مشخص نیست. «میزبانی در اروپا» به‌تنهایی معادل compliance نیست.

### lifecycle

هر data class دارای owner، purpose، retention، legal-hold behavior، export format و deletion mechanism است. deletion یک workflow قابل‌اثبات است که primary، cache، search index، embeddings، object store و derived data را پوشش می‌دهد؛ backup expiration طبق schedule و legal decision ثبت می‌شود.

---

## ۱۸. Legal & Compliance Agent: مرزهای دقیق

### مجاز

- بازیابی منبع رسمی، ثبت URL/title/publisher/jurisdiction/effective date/checked-at؛
- تفکیک FACT/INFERENCE/UNKNOWN و ساخت checklist؛
- پیدا کردن conflict یا freshness gap؛
- draft داخلی برای مرور مسئول حقوقی؛
- مسدودکردن progression در نبود شواهد یا decision record.

### ممنوع

- اعلام «کاملاً قانونی/مطابق»؛
- تعیین قطعی lawful basis یا تفسیر قرارداد/قانون به جای وکیل؛
- امضا، ثبت، ارسال، قبول terms، تماس یا پرداخت؛
- تبدیل absence of evidence به approval؛
- استفاده از blog/مدل به‌عنوان مرجع نهایی وقتی منبع رسمی لازم است؛
- صدور authorization token.

### decision record انسانی

```text
jurisdiction, channel, purpose, data_categories, subject_type,
official_sources + checked_at, unknowns, prohibited_actions,
required_disclosures/consents, retention, transfer_basis,
reviewer_identity/authority, decision, scope, expires_at,
policy_version, supersedes_decision_id
```

EU AI Act برای برخی سامانه‌های high-risk الزامات human oversight دارد: [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj). **UNKNOWN:** طبقه‌بندی ManovaFlow به use case واقعی بستگی دارد؛ سند فعلی نباید آن را high-risk یا exempt اعلام کند. Human override و audit به‌عنوان design control مستقل حفظ می‌شوند.

---

## ۱۹. Threat model

### دارایی‌ها و trust boundaryها

دارایی‌های اصلی: tenant data، membership/session، connector/model secrets، manifest/policy/approval، suppression، audit evidence، budget و workflow state. مرزها: browser↔web، app↔DB، worker↔queue، model/provider، fetcher↔public web، adapter↔external system، operator/support↔tenant.

| تهدید | مسیر | کنترل پیشگیرانه | کشف/بازیابی | ریسک باقیمانده |
|---|---|---|---|---|
| cross-tenant read/write | missing filter، bad job context، cache key | composite tenant FK، FORCE RLS، non-owner role، tenant cache partition | isolation tests، RLS deny metric، incident kill | خطای DDL/role؛ نیازمند review مستمر |
| confused deputy | actor می‌خواهد gateway با privilege خود gateway عمل کند | bound approval، audience/scope، resource version، policy recheck | anomalous approval/action graph | compromise approver/session |
| prompt injection | public page/tool output | untrusted-data boundary، no secrets/tools، egress allowlist، schema+semantic validation | adversarial eval، canary، trace | novel injection؛ action remains deterministic |
| SSRF/DNS rebinding | source URL/redirect | resolver با block private/link-local، re-resolve هر hop، proxy egress | network deny logs | compromised allowed domain |
| duplicate side effect | retry/timeout/webhook duplication | idempotency ledger، provider key، intent state machine | reconciliation job، manual exception queue | provider بدون idempotency قوی |
| approval replay/TOCTOU | reuse token یا تغییر params بعد approval | one-use hash، canonical digest، expiry، consume transactionally | replay alert، revoke | external resource changes between check/call |
| suppression bypass | stale cache یا مسیر action دیگر | shared service، three checkpoints، DB constraint/state | escape metric = incident | eventual external provider state |
| manifest tampering/downgrade | altered pack یا old version | signature/digest، compatibility، monotonic activation | integrity scan، revoke/rollback | signing-key compromise |
| audit tampering | app update/delete یا admin | separate role، append-only، hash chain، external signed checkpoint | verification job | DB+checkpoint key compromise |
| secret leakage | prompt/log/DLQ/config | secret refs، envelope encryption، redaction، no payload secret | DLP pattern alert، revoke/rotate | vendor-side exposure |
| model/provider outage/drift | error یا quality regression | routing tier، caps، eval gate، no unsafe fallback | shadow eval، circuit breaker | reduced availability |
| queue poison/starvation | retry storm یا lane monopolization | classified retry، DLQ، per-lane fairness/budget | queue lag/retry alerts | shared DB saturation |
| migration lock/outage | blocking DDL/backfill | lock budget، expand-contract، rehearsal | lock/lag alert، abort | table size misestimate |
| insider/support abuse | broad admin access | JIT tenant-bound role، SoD، reason/expiry | session recording/audit review | privileged collusion |
| bidi spoofing | mixed script/control chars | locale/direction metadata، visible warning، identifier isolation | suspicious Unicode alert | legitimate bidi false positive |
| legal overclaim | agent says compliant | constrained output taxonomy، UNKNOWN blocker، disclaimer | review sampling، source freshness | human reviewer error |

---

## ۲۰. تصمیم‌های ADR

### ADR-001 — Modular monolith پیش از microservices

- **Status:** Accepted
- **Context:** تیم/بار فعلی کوچک، consistency و shared safety حیاتی است.
- **Decision:** یک deployment منطقی با module boundary و worker processهای همان codebase.
- **Consequences:** transaction ساده و هزینه کم؛ نیازمند lint/import boundary و ownership. استخراج service فقط با profile و scaling evidence.

### ADR-002 — PostgreSQL shared-pool + FORCE RLS

- **Status:** Accepted for M0–SMB production
- **Decision:** `tenant_id` در همه داده‌های tenant-owned، composite FK، app role غیرمالک و policy default-deny.
- **Consequences:** مقرون‌به‌صرفه؛ tenant escape testing و connection-context discipline اجباری. enterprise می‌تواند به data cell/database اختصاصی برود.

### ADR-003 — PostgreSQL-backed queue اکنون، Temporal با trigger

- **Status:** Accepted
- **Decision:** pg-boss پشت `WorkflowPort` + business state/outbox/inbox در DB.
- **Consequences:** یک datastore و atomic enqueue؛ قابلیت Temporal-level history/replay آماده نیست. abstraction و migration trigger مانع بن‌بست می‌شود.

### ADR-004 — Agent پیشنهاد می‌دهد، Action Gateway اجرا می‌کند

- **Status:** Accepted / invariant
- **Decision:** هیچ LLM یا agent SDK مستقیماً side effect ندارد.
- **Consequences:** کد بیشتر برای canonical intent و recheck؛ blast radius و excessive agency شدیداً کم می‌شود.

### ADR-005 — Approval، capability تک‌مصرف و bound است

- **Status:** Accepted / invariant
- **Decision:** opaque token hash با tenant/action/resource/params/policy/expiry binding.
- **Consequences:** هر تغییر نیازمند re-approval؛ UX اندکی سنگین‌تر اما قابل‌ممیزی و ضد-replay.

### ADR-006 — Pack declarative و signed؛ بدون executable code

- **Status:** Accepted
- **Consequences:** safety و portability بالاتر؛ extensionهای خاص از مسیر adapter رسمی و code review می‌گذرند.

### ADR-007 — Provider-neutral ModelGateway

- **Status:** Accepted
- **Decision:** domain به provider SDK وابسته نیست؛ exact model/prompt/schema/eval version ثبت می‌شود.
- **Consequences:** adapter maintenance لازم؛ routing/fallback/cost governance قابل‌کنترل می‌شود.

### ADR-008 — Text-first؛ Voice پس از benchmark/legal gate

- **Status:** Accepted
- **Consequences:** time-to-safe-value بهتر؛ ادعای پوشش صوتی زودهنگام حذف می‌شود.

### ADR-009 — Internal policy engine اکنون؛ OPA در صورت تعدد enforcement point

- **Status:** Accepted
- **Consequences:** عملیات ساده‌تر؛ contract تصمیم و test corpus از روز اول باید migration-ready باشد.

### ADR-010 — Audit tamper-evident + external checkpoint

- **Status:** Accepted for production target
- **Consequences:** hash chain داخل DB به‌تنهایی immutability نیست؛ sink جدا و key management لازم است.

### ADR-011 — G0 outbound capability absent

- **Status:** Accepted / current release blocker
- **Decision:** نه فقط disabled flag؛ adapter، route، secret و permission در deployment وجود ندارد.
- **Consequences:** accidental send عملاً مسدود؛ progression به G1 ADR و legal review جدا می‌خواهد.

---

## ۲۱. چه چیزهایی پیش از کدنویسی بعدی باید ثابت شوند

این تصمیم‌ها باید قبل از گسترش implementation قفل شوند:

1. canonical tenant context و نقش‌های DB؛
2. جدول‌ها/کلیدهای composite و RLS policy pattern؛
3. workflow/action/idempotency state machine؛
4. approval capability envelope و canonical hashing؛
5. manifest envelope/signature/compatibility semantics؛
6. data classification، retention و deletion matrix؛
7. model task taxonomy، eval thresholds و budget units؛
8. locale taxonomy (`fa-IR`, market Arabic, `tr-TR`, `fr-FR`, `ckb-Arab`, `kmr-Latn`)؛
9. G0 capability allowlist و deployment proof of absent outbound route/secret؛
10. SLO/RPO/RTO به‌عنوان target داخلی تا تایید تجاری.

### مواردی که اکنون نباید ثابت شوند

- provider مدل/voice دائمی؛ با benchmark انتخاب شود.
- cloud خاص، Kubernetes، service mesh یا multi-region؛ بدون scale/residency evidence.
- database-per-tenant برای همه؛ فقط tier-driven.
- Temporal از روز اول؛ فقط پس از trigger.
- legal outcome برای چهار بازار؛ فقط counsel-driven.

---

## ۲۲. نقشه راه M0 تا Production

### M0 — Research-only kernel hardening

**هدف:** اثبات invariants بدون هیچ اتصال بیرونی.

- domain contracts برای tenant/lane/evidence/suppression/budget/manifest/workflow/action؛
- schema و migrations اولیه با RLS، composite FK و role tests؛
- synthetic-only source fixtures؛
- سه lane با queue/budget/state/report جدا؛
- action registry allowlist که outbound capability در آن absent است؛
- audit event schema و cost ledger؛
- unit/property/security tests.

**Exit gate:** هیچ مسیر network/outbound/secret؛ tenant escape و suppression escape صفر؛ تنها داده `.example`.

### M1 — Local durable G0

- Postgres queue + outbox/inbox/idempotency/DLQ؛
- fetcher امن برای fixture محلی و سپس public-org allowlist در محیط جدا؛
- evidence/provenance/claim registry؛
- internal dashboard RBAC و kill switches؛
- restore automation و migration rehearsal؛
- OpenTelemetry local با redaction.

**Exit gate:** crash/retry/duplicate tests بدون دوبار side effect؛ restore drill موفق؛ dashboard فقط internal.

### M2 — Controlled public research

- company/official registry discovery فقط org-level؛
- ModelGateway با حداقل دو adapter قابل‌تعویض یا یک adapter + fake contract test؛
- per-language/vertical eval، injection suite، cost caps؛
- privacy/lifecycle operations؛
- security review و SBOM/dependency policy.

**Exit gate:** G0 واقعی، ولی هنوز `sends=0`، no outbound credential و drafts فقط `NOT SENT`.

### M3 — Production G0 SaaS

- production identity (MFA، session hardening، SSO readiness)، secret manager/KMS؛
- encrypted backup/PITR، external audit checkpoint، incident runbooks؛
- data residency and provider policy per tenant؛
- load/soak/chaos، pen test و independent tenant isolation review؛
- SLO alerts/on-call و monthly restore evidence.

**Exit gate:** فروش به‌عنوان research/decision-support فقط؛ هیچ ادعای autonomous outreach یا voice.

### M4 — G1 Human-Send pilot، فقط با ADR جدید

- Legal & Compliance decision برای یک market + channel + purpose محدود؛
- Action Gateway و یک adapter sandbox/allowlisted؛
- one-use bound approval، human preview، provider reconciliation؛
- canary tenant، daily cap تک‌رقمی، emergency global kill؛
- consent/suppression/provider feedback lifecycle.

**Exit gate:** counsel-approved scope، incident rehearsal، zero bypass. تا آن زمان این مرحله **BLOCKED BY DESIGN** است.

### M5 — Bounded automation / Voice lab

- تنها پس از داده M4 و ADR risk؛
- rule-bound low-risk actions، SoD و progressive caps؛
- voice benchmark per locale و channel در lab؛
- Temporal evaluation در صورت عبور از triggerهای ADR-003.

### M6 — Scale/data cells

- deployment stamps، regional cells، enterprise database isolation؛
- cross-cell control plane حداقلی؛
- multi-region only if contractual RTO/SLO justifies cost؛
- pack certification pipeline و ecosystem فقط پس از governance maturity.

---

## ۲۳. معیارهای پذیرش معماری

### Tenant isolation

- [ ] هر tenant-owned table دارای `tenant_id NOT NULL`, composite PK/unique/FK و FORCE RLS است.
- [ ] runtime role مالک/BYPASSRLS/superuser نیست.
- [ ] test matrix برای UI/API/repository/job/cache/search/audit با دو tenant، cross-read/write را رد می‌کند.
- [ ] connection pool test نشان می‌دهد tenant context بین requestها نشت نمی‌کند.

### Workflow و reliability

- [ ] state transitionها compare-and-set/versioned هستند.
- [ ] domain change + outbox enqueue atomic است.
- [ ] duplicate، timeout، crash-before/after-provider و webhook reorder آزمایش شده‌اند.
- [ ] retry فقط transient error؛ poison job به DLQ و human queue می‌رود.
- [ ] compensation و reconciliation برای هر side effect مستند است.

### Growth G0

- [ ] تنها سه lane تعریف‌شده فعال‌اند و budget/rate/queue/report/kill مستقل دارند.
- [ ] outbound transport/provider adapter، route و credential در artifact/environment وجود ندارد؛ فقط gateway صریحاً disabled و بدون side effect می‌تواند حاضر باشد.
- [ ] send/call/ad/book/list-purchase budget صفر و غیرقابل override است.
- [ ] candidate schema داده شخصی را reject می‌کند؛ source org-level و provenance اجباری است.
- [ ] suppression در ingest، draft و pre-action fail-closed است.

### Agent/tool/action safety

- [ ] هیچ مدل به secret، DB write یا generic egress دسترسی ندارد.
- [ ] tool proposal strict-schema و semantic-validated است.
- [ ] approval token تک‌مصرف، hashed، expiry-bound و parameter/resource/policy-bound است.
- [ ] policy و suppression بلافاصله قبل از dispatch دوباره ارزیابی می‌شوند.
- [ ] prompt injection corpus در شش زبان و mixed-script release gate است.

### Manifest/pack

- [ ] pack executable code/SQL/secret ندارد.
- [ ] digest/signature/schema/compatibility و immutable activation ثبت شده است.
- [ ] workflowها به manifest version pin هستند.
- [ ] ServiceFlow تنها ACTIVE_DEVELOPMENT و دو pack دیگر VALIDATION_BACKLOG نمایش داده می‌شوند.

### Data، audit و lifecycle

- [ ] audit completeness برای decision/action ۱۰۰٪ و external signed checkpoint فعال است.
- [ ] log/prompt/audit/DLQ secret و chain-of-thought ندارند.
- [ ] export/delete همه storeهای مشتق را پوشش می‌دهد.
- [ ] PITR restore و quarterly full drill با RPO/RTO measured پاس شده است.

### Model/locale/voice

- [ ] exact model/prompt/schema/eval version و usage/cost ثبت می‌شود.
- [ ] routing فقط برای tupleهای دارای benchmark؛ UNKNOWN fallback fail-closed.
- [ ] `ckb` و `kmr` جدا، `lang` و `dir` جدا و bidi tests پاس هستند.
- [ ] voice/telephony تا benchmark + legal + consent gate فاقد production credential/route است.

### Production

- [ ] threat model و ADRها review و owner دارند.
- [ ] SAST/dependency/SBOM/secret scan، pen test و tenant isolation review پاس شده‌اند.
- [ ] incident runbook، on-call، alerts، kill switches و key rotation rehearsal شده‌اند.
- [ ] هیچ claim «production-ready» صرفاً بر اساس source/test محلی صادر نشده است.

---

## ۲۴. فهرست ریسک و اولویت

| اولویت | ریسک | احتمال/اثر فعلی | پاسخ |
|---|---|---|---|
| P0 | outbound ناخواسته در G0 | کم/بحرانی | capability absent + no credential + zero budget + artifact scan |
| P0 | cross-tenant leak | متوسط/بحرانی تا قبل از RLS | composite FK + FORCE RLS + non-owner role + adversarial tests |
| P0 | approval replay/parameter drift | متوسط/بحرانی در G1 | bound one-use capability + transactional consume |
| P0 | prompt injection به action | متوسط/بحرانی | no direct tools/secrets + deterministic gateway + eval |
| P1 | suppression bypass | متوسط/بالا | shared source of truth + three rechecks + kill |
| P1 | نبود durable persistence/recovery | بالا/بالا | M0 schema، queue، outbox/inbox، restore |
| P1 | legal overclaim | متوسط/بالا | UNKNOWN blocker + official source + human authority |
| P1 | migration outage | متوسط/بالا | expand-contract + lock budget + rehearsal |
| P1 | secret leakage در trace/model | متوسط/بالا | secret refs، redaction، data classification، provider policy |
| P1 | audit قابل‌دستکاری | متوسط/بالا | append-only role + hash chain + external signed checkpoint |
| P2 | framework/provider lock-in | متوسط/متوسط | internal ports + contract tests + version capture |
| P2 | هزینه AI کنترل‌نشده | بالا/متوسط | reservation ledger + caps + circuit breakers |
| P2 | کیفیت ضعیف کردی/لهجه | بالا/متوسط | locale split + local eval + text-first |
| P2 | pg-boss maintainer concentration | متوسط/متوسط | pin/SBOM/fork readiness/WorkflowPort/Temporal trigger |
| P2 | بیش‌معماری و کندی تحویل | بالا/متوسط | modular monolith، یک vertical، defer OPA/Temporal/K8s/voice |

---

## ۲۵. گپ‌های پژوهشی باقیمانده

| UNKNOWN | برای بسته‌شدن چه لازم است | owner پیشنهادی | blocker کدام مرحله |
|---|---|---|---|
| الزامات outreach هر بازار | memo وکیل محلی برای channel/purpose/data | Legal owner | M4 |
| DPA/residency مدل‌ها | قرارداد، subprocessor list، retention/training controls | Security/Privacy | M3 |
| کیفیت مدل در شش locale | corpus و eval reproducible | AI/QA | M2 |
| کیفیت ASR/TTS کردی | benchmark با speaker/dialect/channel | Voice/QA | M5 |
| بار و هزینه واقعی | workload profile و load/cost test | Platform/FinOps | M3/M6 |
| نیاز Temporal | workflow duration/complexity/recovery telemetry | Architecture/SRE | M5 |
| RPO/RTO قراردادی | customer tier و business impact analysis | Product/SRE | M3 |
| dedicated data cell | قرارداد enterprise/residency/scale evidence | Architecture/Sales | M6 |

---

## ۲۶. منابع اصلی بازبینی‌شده

همه پیوندهای زیر در ۲۰۲۶-۰۹-۰۴ بازبینی شده‌اند:

- Next.js App Router و boundaryهای server/client: [App Router](https://nextjs.org/docs/app)، [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)، [Authentication guide](https://nextjs.org/docs/app/guides/authentication).
- PostgreSQL: [Row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)، [CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)، [Explicit/advisory locking](https://www.postgresql.org/docs/current/explicit-locking.html)، [PITR](https://www.postgresql.org/docs/current/continuous-archiving.html).
- Workflow: [Temporal](https://docs.temporal.io/)، [Trigger.dev](https://trigger.dev/docs/)، [Inngest](https://www.inngest.com/docs/)، [BullMQ](https://docs.bullmq.io/)، [pg-boss](https://github.com/timgit/pg-boss).
- Policy/tool safety: [OPA](https://www.openpolicyagent.org/docs)، [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)، [OWASP GenAI](https://genai.owasp.org/)، [NIST AI RMF GenAI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence).
- Model portability: [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)، [Anthropic strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)، [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
- زبان و RTL: [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646)، [IANA registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)، [Unicode UAX #9](https://www.unicode.org/reports/tr9/)، [W3C RTL guidance](https://www.w3.org/International/questions/qa-html-dir).
- Privacy/operations: [GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj)، [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)، [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/).

---

## ۲۷. نتیجه قطعی

ManovaFlow نباید به «مجموعه agentهایی که هرکدام بخشی از سیستم را در اختیار دارند» تبدیل شود. محصول قابل‌اعتماد، یک هسته قطعی و قابل‌ممیزی است که agentها درون آن proposal می‌سازند. vertical differentiation در Pack/Manifest می‌ماند؛ قدرت، secret، tenant boundary، approval، suppression، budget، audit و action در Core می‌ماند.

**تصمیم اجرایی بعدی:** M0 را صرفاً با tenancy/RLS، workflow state + Postgres queue، outbox/inbox/idempotency، manifest envelope، bound approval model، audit/cost ledger و G0 no-outbound proof بسازید. ServiceFlow تنها pack فعال توسعه باشد؛ BeautyFlow و BriefFlow صرفاً research lane و validation backlog بمانند. Voice، Temporal، OPA، data cells و هر outbound integration تا عبور از gateهای ثبت‌شده به تعویق بیفتند.

این مسیر کم‌هزینه‌ترین گزینه نیست چون کنترل‌ها حذف شده‌اند؛ کم‌هزینه‌ترین گزینه‌ای است که کنترل‌های حیاتی را در مرز درست نگه می‌دارد و بدون بازنویسی معماری، راه رشد تا production را باز می‌گذارد.

---

## ۲۸. کنترل خروجی پژوهش

- **سلامت لینک:** ۵۱ پیوند یکتای HTTPS با درخواست شبکه فقط‌خواندنی کنترل شد؛ ۴۹ پاسخ `200` و دو سند رسمی EUR-Lex پاسخ `202` دادند؛ لینک شکسته یا پاسخ `5xx` مشاهده نشد.
- **کنترل ساختار:** بخش‌های خلاصه مدیریتی، جدول‌های مقایسه، معماری نهایی، دیاگرام متنی، ADRها، threat model، فازهای M0 تا production، معیارهای پذیرش، ریسک‌ها و برچسب‌های FACT/INFERENCE/UNKNOWN حاضرند.
- **دامنه تغییر این پژوهش:** تنها فایل ساخته/ویرایش‌شده توسط این کار همین سند است. هنگام اجرای پژوهش، تغییرات هم‌زمان دیگری در `src/`، `tests/` و `package.json` توسط یک فرایند دیگر مشاهده شد؛ این کار آن‌ها را ایجاد، اصلاح، بازگردانی یا حذف نکرد و snapshot واقعیت فعلی بالا با read-only inspection به‌روز شد.
