# تمرین تست بار با Locust

Branch: `exercise/locust-loadtest`

سناریوها فقط GET صفحات عمومی واقعی پروژه هستند: `/` با وزن ۶، `/fr` و `/ar` با وزن ۲ و `/de` با وزن ۱. وضعیت HTTP، نوع HTML، زبان و جهت سند و وجود تیتر بررسی می‌شوند. پاسخ ۴۰۴ برای زبان پشتیبانی‌نشده موفقیت محسوب می‌شود. redirect غیرمنتظره خطاست.

فرض تمرین: بار صفحات عمومی، بدون APIهای احراز هویت، داده مستاجرها، پرداخت یا عملیات تغییردهنده. HttpUser جاوااسکریپت اجرا نمی‌کند و منابع صفحه را خودکار دانلود نمی‌کند؛ این اندازه‌گیری HTTP سرور است.

## نصب و تست سناریوها

از ریشه مخزن، با Python 3.11 یا جدیدتر:

```powershell
python -m venv .venv-loadtest
.\.venv-loadtest\Scripts\python.exe -m pip install -r loadtest/requirements.txt
.\.venv-loadtest\Scripts\python.exe -m unittest discover -s loadtest -p "test_*.py" -v
```

در Linux/macOS معادل Python محیط مجازی، `.venv-loadtest/bin/python` است.

## اجرای بار محلی

برای اندازه‌گیری قابل اتکا از build تولید استفاده کنید؛ هیچ credential واقعی برای صفحات عمومی لازم نیست:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm exec next start --hostname 127.0.0.1 --port 3187
```

اگر صرفاً اجرای آزمایشی توسعه لازم است، به جای دو فرمان آخر `pnpm dev --hostname 127.0.0.1 --port 3187` اجرا کنید. نتایج dev معیار ظرفیت production نیستند.

پیش از تست، هر چهار مسیر را یک بار باز کنید تا هزینه کامپایل/بارگذاری اولیه وارد اندازه‌گیری گرم نشود. در ترمینال دوم:

```powershell
New-Item -ItemType Directory -Force artifacts/loadtest
.\.venv-loadtest\Scripts\python.exe -m locust --config loadtest/locust.conf
```

پروفایل پیش‌فرض: ۱۰ کاربر، افزایش ۲ کاربر در ثانیه، ۶۰ ثانیه، مکث ۱ تا ۳ ثانیه و timeout ده‌ثانیه‌ای هر درخواست. خروجی CSV و HTML زیر `artifacts/loadtest/` ذخیره می‌شود و وارد Git نمی‌شود.

معیار قبولی آموزشی: حداقل یک درخواست برای هر چهار سناریو، نسبت خطا حداکثر ۱٪ و p95 هر مسیر حداکثر ۲۰۰۰ میلی‌ثانیه. عبور از معیارها exit code را ۱ می‌کند؛ این حدود فرض تمرین‌اند و SLA محصول نیستند. اجرای کوتاه ممکن است به‌علت انتخاب تصادفی، پوشش کامل نداشته باشد و باید fail شود.

پروفایل سنگین‌تر، فقط روی نمونه محلی یا محیط تستی که مجوز آن را دارید:

```powershell
.\.venv-loadtest\Scripts\python.exe -m locust --config loadtest/locust.conf --users 50 --spawn-rate 5 --run-time 3m
```

رابط وب، با توقف دستی:

```powershell
.\.venv-loadtest\Scripts\python.exe -m locust -f loadtest/locustfile.py --host http://127.0.0.1:3187 --web-host 127.0.0.1
```

سپس `http://127.0.0.1:8089` را باز کنید. برای نتایج قابل مقایسه سخت‌افزار، حالت dev/production، تعداد کاربران، مدت، نرخ درخواست، p95 و خطاها را ثبت کنید.

مراجع: [نوشتن سناریو](https://docs.locust.io/en/stable/writing-a-locustfile.html)، [اجرای headless و exit code](https://docs.locust.io/en/stable/running-without-web-ui.html).
