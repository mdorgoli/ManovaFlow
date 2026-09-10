# ManovaFlow Growth Core — Phase 1 + Identity Boundaries 2A/2B/2C

یک vertical slice محلی از یک هسته چندمستاجری که سه مسیر `ServiceFlow`، `BeautyFlow` و `BriefFlow` را هم‌زمان و مستقل اجرا می‌کند. هر سه مسیر فقط در حالت **Research-Only** هستند.

## مرز ایمنی

- هیچ ایمیل، WhatsApp، LinkedIn، تماس، تبلیغ، خرید لیست، رزرو یا mutation بیرونی وجود ندارد.
- خروجی هر مسیر فقط shortlist، شواهد، امتیاز توضیح‌پذیر و پیش‌نویس داخلیِ ارسال‌نشده است.
- `ServiceFlow` در حال توسعه محصول است؛ `BeautyFlow` و `BriefFlow` فقط پیش‌نمایش اعتبارسنجی و waitlist هستند.
- Global Market Discovery از مانیفست‌های عمودی جداست. چهار پروفایل نخست فقط داده پژوهشی/ساختگی‌اند: فرانسه، استانبول/ترکیه، اربیل/اقلیم کردستان عراق و دبی/امارات.
- فرانسه فقط یک فرضیه تأییدنشده برای محل شرکت/پرداخت است. هیچ بازار دیگری توصیه ثبت شرکت نیست.
- اربیل نماینده کل عراق نیست و مسیرهای قرارداد، پرداخت، داده و حقوقی آن `UNKNOWN` باقی می‌مانند.
- Legal & Compliance Gate وکیل نیست، نظر قطعی نمی‌دهد و در Phase 1 هیچ توکن Human-Send صادر نمی‌کند.
- هویت درخواست فقط از `AuthPort` سمت سرور پذیرفته می‌شود و نقش tenant جداگانه از `MembershipPort` سمت سرور resolve می‌شود؛ هیچ claim کلاینت یا auth adapter مرجع RBAC نیست.
- همه هدرهای هویتی از جمله `x-tenant-id`، `x-actor-id`، `x-role`، `x-session-id`، `x-mfa-verified` و `x-auth-subject` به‌عنوان جعل هویت رد می‌شوند.
- در `production` نبود پیکربندی کامل OIDC/PostgreSQL، امضای نامعتبر، issuer/audience/expiry/nonce نادرست، MFA نامعتبر/منقضی، نشست revoke/compromise‌شده یا membership ناسازگار همگی fail-closed هستند. context نمایشی مبتنی بر env فقط خارج از production مجاز است.
- JWKS فقط به‌صورت public key ایستا از env خوانده می‌شود؛ discovery، remote JWKS، client secret یا تماس با provider در این فاز وجود ندارد.
- عملیات identity در production فقط با `IDENTITY_DATABASE_URL` و username مستقل انجام می‌شود؛ هر transaction نقش کم‌دسترسی `manovaflow_identity_runtime` می‌گیرد و تنظیم ناقص fail-closed است.
- اجرای مجدد migration ویژگی `NOBYPASSRLS` و سایر attributeهای کم‌دسترسی را صریحاً بازمی‌گرداند و ACL را با revoke کامل و allowlist مجدد ترمیم می‌کند.
- نشست‌ها هم deadline مطلق و هم idle دارند؛ rotate/revoke پیش از دسترسی به نشست با bucketهای PostgreSQL و HMAC محدود می‌شوند و رویدادهای امنیتی append-only هستند.
- subject مربوط به rate limit فقط از session-cookie یکتای معتبر و canonical ساخته می‌شود؛ کوکی‌های نامرتبط و ترتیب آن‌ها بی‌اثرند و حالت missing/invalid/duplicate/oversized یک fallback مشترک دارد.

## معماری

```text
Global Market Registry ──┐
                         ├─ Shared Growth Core ── PostgreSQL + RLS + append-only audit
Compliance Gate ─────────┤          ├─ ServiceFlow queue/budget/report
                         │          ├─ BeautyFlow queue/budget/report
Vertical Manifests ──────┘          └─ BriefFlow queue/budget/report

Server-verified session ── AuthPort ──┐
                                      ├─ frozen ActorContext ── API policy/RBAC
PostgreSQL membership ─ MembershipPort┘

Static public JWKS ─ Offline OIDC verifier ─ Identity link ─┐
                                                            ├─ PostgreSQL session state
Secure HttpOnly cookie + Origin/CSRF ─ Opaque AuthPort ─────┘
```

امتیاز آمادگی بازار و امتیاز تطابق شرکت در جدول‌ها و مدل‌های جدا ذخیره می‌شوند. dedupe و suppression در سطح tenant هستند، نه در سطح lane. اجرای سه مسیر از `Promise.allSettled` استفاده می‌کند تا شکست یک مسیر به دو مسیر دیگر سرایت نکند.

## پیش‌نیازها

- Node.js 24 یا جدیدتر
- pnpm 11.19.0
- PostgreSQL 14 یا جدیدتر (مستقیم، WSL یا Docker)

## راه‌اندازی محلی

```powershell
Copy-Item .env.example .env.local
pnpm install --frozen-lockfile
```

در `.env.local` گذرواژه نمونه را با یک مقدار تصادفی محلی عوض کنید. برای Docker:

```powershell
docker compose --env-file .env.local up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

سپس `http://localhost:3000` را باز کنید و «اجرای پژوهش ساختگی سه‌مسیره» را بزنید.

اگر PostgreSQL مستقیماً یا در WSL اجرا می‌شود، فقط `DATABASE_URL` و `TEST_DATABASE_URL` را به همان نمونه اشاره دهید و مرحله `docker compose` را حذف کنید.

برای production، همه متغیرهای `APP_ORIGIN`، `OIDC_*`، `SESSION_*` و `AUTH_RATE_LIMIT_*` در `.env.example` اجباری‌اند. `OIDC_JWKS_JSON` باید فقط JWKS عمومی ایستا باشد؛ هر مقدار ناقص، private JWK یا URL غیر HTTPS مرز هویت را بسته نگه می‌دارد. `IDENTITY_DATABASE_URL` باید login مستقل و از پیش provisionشده‌ای باشد که عضو role گروهی `manovaflow_identity_runtime` است؛ migration عمداً login یا password ایجاد نمی‌کند.

Cleanup هویت فقط یک کار محلی/زمان‌بندی‌شده و bounded است و از credential مستقل استفاده می‌کند:

```powershell
pnpm identity:cleanup
```

این فرمان نشست‌های منقضی را در batch قفل/expire می‌کند، فقط stateهای terminal قدیمی‌تر از retention را purge می‌کند و audit امنیتی را نگه می‌دارد. اجرای scheduler، backup و provisioning حساب production خارج از این مخزن است.

## بررسی‌ها

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm demo
```

`pnpm demo` بدون `DATABASE_URL` از مخزن حافظه‌ای صرفاً برای نمایش استفاده می‌کند. وجود تست‌های واحد یا build به‌تنهایی نشانه آمادگی تولید نیست؛ برای ادعای persistence باید تست PostgreSQL واقعی سبز باشد.

## API محلی

- `GET /api/dashboard` — Viewer، Operator یا Owner
- `POST /api/research/run` — Owner یا Operator و هدر معتبر `Idempotency-Key`
  - `{ "mode": "SYNTHETIC" }`
  - یا `{ "mode": "MANUAL", "inputsByLane": ... }` با schema سخت‌گیرانه شرکت‌محور
- `POST /api/drafts/{draftId}/decision` — فقط Owner؛ تصمیم داخلی و بدون فعال‌کردن ارسال
- `POST /api/suppressions` — Owner یا Operator؛ DNC در کل tenant
- `POST /api/auth/session/rotate` — rotation اتمیک cookie با Origin و CSRF معتبر
- `POST /api/auth/session/revoke` — revoke فوری سمت سرور و پاک‌کردن cookieها

## مرز Identity/Tenant فاز 2A

تمام Route Handlerهای محافظت‌شده context را با resolver سمت سرور می‌سازند. `AuthPort` فقط نشست و MFA را اثبات می‌کند؛ `MembershipPort` نقش actor را برای tenant فعال از PostgreSQL/RLS می‌خواند. در محیط توسعه، demo identity باید صریحاً فعال شود و هرگز به‌عنوان MFA تولید پذیرفته نمی‌شود.

## مرز OIDC/Session فاز 2B

`OfflineOidcJwtVerifier` امضای نامتقارن `RS256`/`ES256`، issuer، audience/azp، expiry، issuance/not-before، nonce و MFA تازه را بدون شبکه بررسی می‌کند. پس از نگاشت server-owned هویت و تأیید membership، یک token تصادفی ۲۵۶بیتی در cookie از نوع `__Host-`، `HttpOnly`، `Secure` و `SameSite=Strict` صادر می‌شود. token و CSRF فقط به‌صورت SHA-256 در PostgreSQL ذخیره می‌شوند؛ استفاده دوباره از نسل rotate‌شده کل session family را compromise و revoke می‌کند.

## خارج از ادعای Phase 1، 2A، 2B و 2C

provider واقعی و login/callback مبتنی بر state/PKCE، enrollment/recovery عملی MFA، key rotation عملیاتی، provision login مستقل production، scheduler cleanup، trusted-edge/IP throttling، backup/restore، secret manager، deployment، آزمون نفوذ و تست دسترس‌پذیری/مرورگر هنوز gate هستند. تا بسته‌شدن این موارد، این پروژه نمونه محلی کنترل‌شده است و نه یک سامانه آماده استقرار.
