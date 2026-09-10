# وضعیت واقعی فاز ۲C — سخت‌سازی عملیات Identity

- وضعیت: `IMPLEMENTED_LOCAL_VERIFIED`
- دامنه: سخت‌سازی محلی identity روی PostgreSQL؛ بدون provider واقعی، deploy، خرید یا ارتباط شبکه بیرونی.
- این وضعیت ادعای production readiness عملیاتی نیست؛ provisioning حساب واقعی، secret manager، trusted edge و سایر gateهای انتهای گزارش خارج از این فاز هستند.

## قابلیت‌های پیاده‌سازی‌شده

### credential، role و pool مستقل

- production بدون `IDENTITY_DATABASE_URL` و `DATABASE_URL` کامل fail-closed است.
- دو URL باید username متفاوت و endpoint/database یکسان داشته باشند؛ username مشترک، database متفاوت یا URL ناقص رد می‌شود.
- application و identity دو pool مستقل دارند. membership/RLS فقط از application pool و عملیات session/link/rate/audit/cleanup فقط از identity pool عبور می‌کنند.
- migration `0003_identity_operations.sql` فقط role گروهی `manovaflow_identity_runtime` را با `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS` می‌سازد و هیچ login یا password ایجاد نمی‌کند.
- هر rerun تمام attributeهای role را صریحاً reset، مجوز `CREATE` عمومی schema را حذف، ACL مستقیم identity/public/app را revoke و سپس allowlist دقیق جدول‌ها را دوباره grant می‌کند.
- تمام transactionهای identity ابتدا `SET LOCAL ROLE manovaflow_identity_runtime` و `row_security=on` را اعمال، `search_path` را به `pg_catalog, public` محدود، tenant/actor context را پاک و نتیجه را راستی‌آزمایی می‌کنند.
- تست pool leakage با ۱۶ transaction هم‌زمان و ۸ reuse بدون scope ثابت کرد role و `app.tenant_id` پس از transaction نشت نمی‌کنند؛ تست آلودگی عمدی نیز reset شدن `search_path` و tenant/actor context را ثابت کرد.

### idle و absolute timeout

- `auth_sessions.expires_at` deadline مطلق و تغییرناپذیر lifecycle باقی مانده است.
- `idle_expires_at` در PostgreSQL persist می‌شود و فقط پس از فعالیت معتبر به `min(absolute expiry, now + idle timeout)` می‌رسد.
- authenticate، rotate و revoke عبور از idle، absolute یا MFA deadline را اتمیک به `EXPIRED` تبدیل و credentialهای فعال را revoke می‌کنند.
- خطاهای typed مستقل `SESSION_IDLE_TIMEOUT`, `SESSION_EXPIRED` و `MFA_EXPIRED` پوشش داده شده‌اند.

### audit امنیتی append-only

- جدول `identity_security_events` رویدادهای issue، replay، rotate، revoke، CSRF، timeout، rate-limit و purge را با شناسه‌های اختیاری و subject/request hash ثبت می‌کند.
- trigger دیتابیس هر `UPDATE` یا `DELETE` را رد می‌کند؛ role هویت فقط مجوز `INSERT` دارد.
- validator جزئیات، کلیدهای مرتبط با token، cookie، secret، authorization، password و CSRF، داده تو‌در‌تو و payload بیش‌ازحد را رد می‌کند.
- audit در همان transaction تغییر محافظت‌شده اجباری است. تست قطع مجوز audit ثابت کرد صدور session و مصرف OIDC digest هر دو rollback می‌شوند.
- تست lifecycle و اسکن منبع تأیید کردند session token و CSRF خام در audit ذخیره نمی‌شوند.

### rate limit دیتابیس‌محور

- rotate و revoke پیش از هر عملیات session دو fixed-window bucket اتمیک مصرف می‌کنند: global برای operation و subject مبتنی بر HMAC-SHA256.
- کلید HMAC باید دقیقاً ۲۵۶ بیت base64url باشد؛ تنظیم ناقص production را fail-closed نگه می‌دارد.
- subject فقط از مقدار session-cookie یکتا، معتبر و canonical مشتق می‌شود؛ تغییر کوکی بی‌ربط، مقدار آن یا ترتیب کوکی‌ها bucket را عوض نمی‌کند.
- حالت‌های missing، invalid، duplicate و oversized همگی به یک fallback ثابت می‌روند تا bucket spraying ممکن نباشد؛ duplicate و oversized همچنان در مرز authentication رد می‌شوند.
- bucketهای global و subject دارای domain separation صریح در ورودی HMAC هستند؛ حتی Cookie کنترل‌شده با متن `global` نمی‌تواند کلید آن‌ها را collide کند.
- هیچ `X-Forwarded-For` یا forwarding header مورد اعتماد نیست. در این فاز global/credential-context limiting فعال است و IP limiting به trusted edge واگذار شده است.
- block با HTTP `429`، کد `AUTH_RATE_LIMITED` و `Retry-After` صحیح پاسخ می‌دهد؛ تست هم‌زمانی نیز ثابت کرد شمارنده از سقف عبور نمی‌کند.

### cleanup bounded

- `PostgresIdentityMaintenance.cleanup` با `FOR UPDATE SKIP LOCKED` و batch محدود، sessionهای deadline‌گذشته را expire می‌کند.
- فقط sessionهای terminal قدیمی‌تر از retention purge می‌شوند؛ session زنده و terminal تازه حفظ می‌شوند.
- OIDC replay digestهای منقضی و rate bucketهای stale نیز در batch محدود پاک می‌شوند، اما audit امنیتی حفظ و برای purge رویداد `SESSION_PURGED` ثبت می‌شود.
- تست مستقل artifact cleanup مستقیماً ثابت می‌کند digest منقضی و bucket stale حذف، digest آینده، bucket تازه و bucket دارای block فعال حفظ، و شمارنده‌های `oidcDigestsDeleted`/`rateBucketsDeleted` دقیقاً برابر delta واقعی جدول هستند.
- فرمان محلی `pnpm identity:cleanup` فقط `IDENTITY_DATABASE_URL`، `IDENTITY_CLEANUP_BATCH_SIZE` و `IDENTITY_CLEANUP_RETENTION_SECONDS` را مصرف می‌کند؛ scheduler ایجاد نشده است.

## شواهد راستی‌آزمایی تازه

- ESLint کامل: موفق، صفر خطا.
- TypeScript strict (`tsc --noEmit`): موفق، صفر خطا.
- تست‌های غیر‌یکپارچه: `24` فایل و `135` تست، همگی موفق.
- تست‌های PostgreSQL 14.24 محلی: `5` فایل و `30` تست، همگی موفق.
- build بهینه Next.js 16.3.4: موفق؛ routeهای `/api/auth/session/rotate` و `/api/auth/session/revoke` هر دو dynamic و قابل build هستند.
- migrationها چندبار روی همان دیتابیس اعمال و تست‌های cleanup نیز چندبار بدون شکست اجرا شدند.
- تست drift، role موجود را به `BYPASSRLS/CREATEDB/CREATEROLE/INHERIT/REPLICATION` و ACL اضافی منحرف کرد؛ rerun migration تمام attributeها و privilegeها را به وضعیت کم‌دسترسی برگرداند.
- بررسی ACL زنده:
  - `manovaflow_identity_runtime`: login/superuser/create-db/create-role/inherit/replication/bypass-RLS همگی false.
  - identity role روی `companies`: بدون SELECT.
  - identity role روی `auth_sessions`: دارای SELECT لازم.
  - identity role روی `identity_security_events`: INSERT=true و UPDATE=false.
  - `manovaflow_app` روی `auth_sessions`: SELECT=false.
- اسکن identity/auth هیچ `fetch`، discovery/remote JWKS، client secret/private key، ساخت login/password در migration یا اعتماد به forwarding header پیدا نکرد.

## پوشش TDD افزوده‌شده

- credential ناقص/مشترک و database متفاوت.
- privilege denial دوطرفه، ترمیم drift شامل `BYPASSRLS` و ACL اضافی، transaction/pool leakage و پاک‌سازی context/search-path آلوده.
- idle expiry، refresh محدود به absolute، absolute expiry پس از فعالیت و revoke پس از idle.
- audit detail validation، تغییرناپذیری، نبود credential خام و rollback اجباری.
- subject/global rate limit، canonical session-cookie، fallback مشترک حالت‌های نامعتبر، HMAC domain separation، fixed-window retry، هم‌زمانی و تقدم limiter در route.
- cleanup bounded، حفظ live/recent، expire/purge صحیح، ماندگاری audit و حسابداری مستقیم حذف/حفظ digest و rate bucket.

## gateهای production باقی‌مانده

- ساخت واقعی loginهای کم‌دسترسی application/identity و grant عضویت آن‌ها باید خارج از migration و توسط اپراتور انجام و در محیط مقصد دوباره با ACL تست شود.
- secret manager و rotation عملیاتی برای database credentials و `AUTH_RATE_LIMIT_HMAC_KEY` لازم است.
- provider واقعی، authorization-code callback با state/PKCE، MFA enrollment/recovery و key/JWKS rotation هنوز فعال نشده‌اند.
- trusted reverse proxy/WAF و IP/device throttling، scheduler cleanup، backup/restore، monitoring/alerting و runbook incident هنوز لازم‌اند.
- deployment، آزمون نفوذ، مرورگر واقعی و accessibility acceptance در این فاز انجام نشده‌اند.

نتیجه: کد و migrationهای Phase 2C در محدوده محلی تعیین‌شده پیاده‌سازی و با شواهد تازه تأیید شدند؛ هیچ قابلیت بیرونی یا production integration فعال نشده است.

## فرمان گیت کامل

- cwd: `D:\ManovaFlow`
- وضعیت اجرای Process Job: `BLOCKED`
- علت: `TEST_DATABASE_URL` در محیط Leader تعریف نشده و `.env.example` فقط قرارداد نمونه است؛ بنابراین مقدار credential اتصال به همان PostgreSQL آزمایشی محلی از هیچ منبع امنِ در دسترس قابل تزریق نیست.
- رفع انسداد: مالک باید مقدار اتصال موجود را از یک کانال secret موردتأیید، مستقیماً با نام `TEST_DATABASE_URL` به environment همان Process Job تزریق کند؛ مقدار نباید داخل command، prompt، گزارش، فایل `.env`، metadata کار، history پوسته یا stdout/stderr قرار گیرد. Runner باید فقط نام متغیر را در command نگه دارد، مقدار را صرفاً به child process تحویل دهد و پس از پایان process آن را دور بیندازد.
- شرط توقف: اگر Runner تزریق secret environment بدون ثبت مقدار در command یا log را پشتیبانی نمی‌کند، این گیت نباید اجرا شود. هیچ database یا credential جدیدی برای رفع این انسداد ساخته نمی‌شود.
- پس از تزریق معتبر مالک، workload زیر با cwd بالا به‌صورت یک process محدود، foreground و fail-fast اجرا می‌شود؛ خود فرمان فقط وجود متغیر را بررسی می‌کند و مقدار آن را چاپ نمی‌کند.

```powershell
& {
  if ([string]::IsNullOrWhiteSpace($env:TEST_DATABASE_URL)) {
    [Console]::Error.WriteLine('TEST_DATABASE_URL is required.')
    exit 2
  }

  & '.\node_modules\.bin\eslint.cmd' '.'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & '.\node_modules\.bin\tsc.cmd' '--noEmit'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & '.\node_modules\.bin\vitest.cmd' 'run' '--exclude' 'tests/integration/**'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & '.\node_modules\.bin\vitest.cmd' 'run' '--config' 'vitest.integration.config.ts'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & '.\node_modules\.bin\next.cmd' 'build'
  exit $LASTEXITCODE
}
```
