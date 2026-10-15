# تمرین Dockerization

Branch: `exercise/dockerization` (شامل تمرین قبلی Locust هم هست).

طبق انتخاب صاحب پروژه، تمرین روی ساختار فعلی ManovaFlow انجام شده؛ این مخزن برنامه مدیریت هزینه نیست و قابلیت مالی جدید به آن اضافه نشده است.

## اجرا

Docker Desktop را در حالت Linux containers اجرا کنید. از ریشه پروژه:

```powershell
Copy-Item .env.docker.example .env.docker.local
# در فایل بالا دو گذرواژه متفاوت و تصادفی با حداقل 16 کاراکتر حرف/عدد بگذارید.
docker compose -f docker-compose.yml --env-file .env.docker.local up --build -d --wait
```

سپس `http://localhost:3188` را باز کنید. به‌علت وجود `compose.yaml` قدیمی، آرگومان `-f docker-compose.yml` را حتماً وارد کنید. پورت با `DOCKER_APP_PORT` قابل تغییر است.

چهار سرویس داریم: app (Next.js production standalone)، postgres، redis و migrate. migration پس از سلامت PostgreSQL اجرا می‌شود و برنامه پس از موفقیت migration و آماده‌شدن Redis شروع می‌شود. migration یک login مستقل با نقش محدود موجود پروژه برای برنامه می‌سازد؛ رمز مدیر دیتابیس فقط به سرویس migration داده می‌شود. هیچ منطق احراز هویت یا RLS تغییر نکرده است.

DATABASE_URL و REDIS_URL در زمان اجرا به نام سرویس‌های Docker اشاره دارند. دیتابیس و Redis پورت عمومی ندارند و داده‌ها در volumeهای اختصاصی پروژه `manovaflow-class` باقی می‌مانند. فایل‌های env و فایل‌های جانبی محلی وارد image نمی‌شوند. مرحله build بررسی TypeScript را اجرا می‌کند.

## بررسی اتصال و کش

```powershell
docker compose -f docker-compose.yml --env-file .env.docker.local ps -a
Invoke-RestMethod http://localhost:3188/api/health
Invoke-WebRequest http://localhost:3188/api/public/locales
Invoke-WebRequest http://localhost:3188/api/public/locales
docker compose -f docker-compose.yml --env-file .env.docker.local exec redis redis-cli TTL manovaflow:public:locales:v1
docker compose -f docker-compose.yml --env-file .env.docker.local exec postgres psql -U postgres -d manovaflow -c "SELECT count(*) FROM tenants;"
```

health برای اتصال واقعی به PostgreSQL و Redis، `200 {status:ok}` می‌دهد و در نبود وابستگی، 503 بدون افشای خطا/رمز. مسیر عمومی زبان‌ها از اطلاعات واقعی صفحه استفاده می‌کند: ابتدا `X-Cache: MISS` و سپس `HIT` با TTL برابر 60 ثانیه؛ در قطع Redis اطلاعات از کد خوانده می‌شود (`BYPASS`). این کش شامل داده مستاجر، نشست یا اطلاعات مالی نیست.

حالت production مرز احراز هویت موجود را حفظ می‌کند؛ APIهای محافظت‌شده بدون پیکربندی هویت و نشست معتبر باز نمی‌شوند. این تمرین راه‌اندازی زیرساخت محلی است و ادعای آماده‌بودن کل محصول برای production ندارد.

## تست و توقف

```powershell
pnpm exec vitest run tests/unit/public-cache.test.ts tests/unit/docker-routes.test.ts
docker compose -f docker-compose.yml --env-file .env.docker.local down
```

فرمان down volumeها را حفظ می‌کند. برای این تمرین داده واقعی وارد نکنید.

مراجع: [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)، [Redis Node.js](https://redis.io/docs/latest/develop/clients/nodejs/).
