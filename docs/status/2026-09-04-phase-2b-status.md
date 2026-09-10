# وضعیت فاز ۲B — OIDC و نشست امن

## شواهد تأییدشده محلی

- وضعیت: `IMPLEMENTED_LOCAL_VERIFIED`؛ این برچسب ادعای production-readiness یا اتصال provider نیست.
- `OfflineOidcJwtVerifier` توکن compact JWS را فقط با public JWK ایستای allowlist و امضای نامتقارن `RS256`/`ES256` می‌پذیرد و issuer، audience/azp، expiry، iat/nbf، nonce، طول عمر و MFA تازه را بررسی می‌کند.
- `OidcSessionService` issuer/subject را از server-owned identity link به actor نگاشت می‌کند؛ نقش همچنان فقط از `MembershipPort` خوانده می‌شود.
- session token تصادفی ۲۵۶بیتی در cookie از نوع `__Host-`، `HttpOnly`، `Secure` و `SameSite=Strict` قرار می‌گیرد؛ token و CSRF فقط به‌شکل SHA-256 در PostgreSQL ذخیره می‌شوند.
- درخواست‌های unsafe به Origin دقیق، CSRF cookie/header برابر و hash متصل به همان credential نیاز دارند.
- exchange هر ID token یک‌بارمصرف است؛ rotation با row lock اتمیک انجام می‌شود و reuse نسل rotate‌شده کل session family را `COMPROMISED` و credential فعال را revoke می‌کند.
- endpointهای محلی `POST /api/auth/session/rotate` و `POST /api/auth/session/revoke` در build ثبت شدند و خطای config/database را بدون افشای جزئیات به `AUTH_PROVIDER_UNAVAILABLE` تبدیل می‌کنند.
- TDD: suiteهای verifier، cookie/CSRF، service، PostgreSQL lifecycle و route fail-closed ابتدا به‌علت ماژول/رفتار غایب یا پاسخ ۴۰۰ شکست خوردند و سپس سبز شدند.
- آزمون نهایی غیر‌یکپارچه: ۲۰ فایل و ۱۰۹ تست موفق.
- آزمون نهایی PostgreSQL: ۲ فایل و ۱۱ تست موفق، شامل tenant/RLS فاز ۲A و replay/rotation/revocation/concurrency/MFA فاز ۲B.
- ESLint کامل، TypeScript strict و Next.js 16.3.4 optimized build موفق بودند.
- هیچ provider واقعی، remote discovery/JWKS، خرید، deploy یا ارتباط شبکه بیرونی فعال نشد.

## شکاف‌های باقی‌مانده

- login initiation و callback واقعی با state/PKCE و nonce store وجود ندارد؛ `establish` فقط service داخلی برای adapter آینده است.
- enrollment، recovery و step-up عملی WebAuthn/TOTP و آزمون با provider واقعی انجام نشده است.
- JWKS ایستا چند key را پشتیبانی می‌کند، اما runbook و مشاهده‌پذیری rotation/revocation کلید عملیاتی نشده‌اند.
- جداول هویت از نقش tenant application سلب دسترسی شده‌اند، اما runtime هنوز credential دیتابیس اختصاصیِ کم‌دسترسی برای identity ندارد.
- cleanup دوره‌ای session/OIDC digest منقضی، idle timeout، device binding، rate limiting و audit event امنیتی هنوز اضافه نشده‌اند.
- آزمون نفوذ، real-browser cookie behavior و استقرار production انجام نشده‌اند.
- کپی workspace فاقد Git metadata است؛ شواهد commit/hash قابل ارائه نیست.
