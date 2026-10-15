# تمرین lint و reformat

Branch: `exercise/lint-reformat`

ESLint با تنظیم‌های Next.js و TypeScript مشکلات کد را گزارش می‌کند. Prettier قالب کد را یکدست می‌کند. `eslint-config-prettier` از تعارض قواعد قالب‌بندی دو ابزار جلوگیری می‌کند.

از ریشه مخزن، با Node.js 24 یا جدیدتر:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm check:style
```

اصلاح قالب و اصلاح خودکار موارد قابل حل توسط lint:

```powershell
pnpm format
pnpm lint:fix
```

فرمان `check:style` هر دو بررسی را اجرا می‌کند و در صورت خطا exit code غیرصفر می‌دهد. فرمان `format:verify` بررسی داخلی Prettier برای حفظ ساختار کد را اجرا می‌کند.

فرمان‌ها فقط فایل‌های کد و تنظیمات ثبت‌شده در Git (JS/TS/JSX/TSX، JSON، CSS و YAML) را انتخاب می‌کنند. فایل جدید را ابتدا با `git add مسیر-فایل` اضافه کنید. فایل‌های محلی ثبت‌نشده، env، خروجی build، آرشیوها و lockfile قالب‌بندی نمی‌شوند. Python سناریوهای Locust و SQL خارج از پوشش این دو ابزار هستند.

تنظیم مشترک: تورفتگی دو فاصله، نقل‌قول دوتایی، semicolon، حداکثر عرض ترجیحی 80 و پایان خط LF. `.editorconfig` همین تنظیم‌ها را به ویرایشگر می‌دهد.

`.gitattributes` پایان خط فایل‌های متنی را در checkoutهای Windows و Linux یکسان نگه می‌دارد.

منطق برنامه، احراز هویت، جداسازی مستاجرها و محاسبات با این تمرین تغییر نمی‌کند؛ تغییر فایل‌های موجود فقط قالب‌بندی است.

مراجع: [Prettier configuration](https://prettier.io/docs/configuration)، [Prettier CLI](https://prettier.io/docs/cli).
