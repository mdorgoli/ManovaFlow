# تمرین مدیریت خطا با FastAPI

این پوشه سرویس آموزشی مدیریت هزینه در مخزن ManovaFlow است. برنامه اصلی Next.js است؛ این نمونه مستقل برای تمرین FastAPI اضافه شده است.

## اجرا (PowerShell، از ریشه مخزن)

```powershell
cd expense-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

مستندات تعاملی: http://127.0.0.1:8000/docs

## مسیرها

- `POST /expenses`: ثبت هزینه با بدنه `{"title":"کتاب","amount":500}`؛ پاسخ ۲۰۱.
- `GET /expenses`: فهرست هزینه‌ها؛ پاسخ ۲۰۰.
- `GET /expenses/{expense_id}`: مشاهده هزینه؛ پاسخ ۲۰۰ یا ۴۰۴.
- `DELETE /expenses/{expense_id}`: حذف هزینه؛ پاسخ ۲۰۴ بدون بدنه یا ۴۰۴.

کلاس `ExpenseNotFoundError` از تابع مشترک جست‌وجوی هزینه پرتاب می‌شود. handler ثبت‌شده در FastAPI آن را به پاسخ زیر تبدیل می‌کند (HTTP 404):

```json
{"status":"error","status_code":404,"code":"expense_not_found","message":"هزینه با شناسه 999 پیدا نشد.","expense_id":999}
```

تست‌ها با pytest و TestClient شامل مشاهده و حذف شناسه ناموجود، چرخه موفق ثبت/مشاهده/فهرست/حذف، حفظ داده بعد از حذف ناموفق، اعتبارسنجی ورودی و استقلال داده تست‌ها هستند. ورودی نامعتبر همچنان پاسخ استاندارد ۴۲۲ دارد.

داده‌ها در حافظه هستند و با راه‌اندازی مجدد پاک می‌شوند؛ نمونه تک‌پردازه و محلی است. این سرویس آموزشی احراز هویت، پرداخت یا اتصال به داده واقعی ندارد و به سرویس‌های Docker تمرین قبلی متصل نشده است.

منابع: [exception handler](https://fastapi.tiangolo.com/tutorial/handling-errors/) و [تست FastAPI](https://fastapi.tiangolo.com/tutorial/testing/).
