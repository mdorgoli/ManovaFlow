"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AHVAZ_CAR_SCOUT_BBOX,
  AHVAZ_CAR_SCOUT_BUDGET,
  AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY,
  AHVAZ_CAR_SCOUT_SCOPE,
  ahvazCarScoutExecutionSchema,
  ahvazCarScoutFeedSchema,
  type AhvazCarScoutSnapshot,
  type CarScoutObservation
} from "@/modules/growth/application/ahvaz-car-scout-contracts";
import styles from "./ahvaz-car-scout.module.css";

const endpoint = "/api/market-scout/ahvaz-cars";
const statusText: Record<AhvazCarScoutSnapshot["status"], string> = {
  RUNNING: "جست‌وجو در جریان است",
  COMPLETED: "داده منبع دریافت و بررسی شد",
  EMPTY: "منبع هیچ رکوردی در این جست‌وجو برنگرداند",
  NO_ACCEPTED_ROWS: "رکورد دریافت شد؛ هیچ ردیفی از بررسی ورودی عبور نکرد",
  FAILED: "جست‌وجو به نتیجه معتبر نرسید"
};
const failureText = {
  SOURCE_TIMEOUT: "منبع تا پایان مهلت ۳۰ ثانیه پاسخ کامل نداد.",
  SOURCE_HTTP_ERROR: "سرویس عمومی Overpass پاسخ HTTP ناموفق داد.",
  SOURCE_RUNTIME_ERROR:
    "Overpass اجرای کوئری را با خطا یا نتیجه ناقص گزارش کرد.",
  SOURCE_RESPONSE_TOO_LARGE: "پاسخ از سقف مجاز اندازه عبور کرد و پذیرفته نشد.",
  SOURCE_RESPONSE_INVALID: "ساختار پاسخ یا شواهد آن معتبر نبود و پذیرفته نشد.",
  SOURCE_UNREACHABLE: "اتصال به منبع عمومی کامل نشد."
};

export function AhvazCarScout() {
  const [snapshot, setSnapshot] = useState<AhvazCarScoutSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<"read" | "run" | null>(null);
  const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null);

  const request = useCallback(async (run: boolean) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(run ? "run" : "read");
    setError(false);
    const timeout = window.setTimeout(
      () => controller.abort("CLIENT_TIMEOUT"),
      40_000
    );
    try {
      const response = await fetch(endpoint, {
        method: run ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        ...(run
          ? {
              headers: {
                "content-type": "application/json",
                "idempotency-key": AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY
              },
              body: JSON.stringify({ scope: AHVAZ_CAR_SCOUT_SCOPE })
            }
          : {})
      });
      if (!response.ok) throw new Error("AHVAZ_SCOUT_UNAVAILABLE");
      const data: unknown = await response.json();
      const parsed = run
        ? ahvazCarScoutExecutionSchema.parse(data)
        : ahvazCarScoutFeedSchema.parse(data);
      if (controller.signal.aborted) return;
      setSnapshot(parsed.snapshot);
      setLoaded(true);
    } catch {
      if (
        controller.signal.aborted &&
        controller.signal.reason !== "CLIENT_TIMEOUT"
      )
        return;
      // Authentication/tenant may have changed: old data must disappear on failure.
      setSnapshot(null);
      setError(true);
      setLoaded(true);
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setPending(null);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load recorded state only; never execute on mount.
    void request(false);
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [request]);

  const rows = snapshot?.discovery?.rows ?? [];
  const missing = rows.filter((row) => row.website.state === "NOT_RECORDED");
  const recorded = rows.filter((row) => row.website.state === "RECORDED");
  const unsafe = rows.filter((row) => row.website.state === "REJECTED_UNSAFE");

  return (
    <section
      className={styles.panel}
      dir="rtl"
      lang="fa"
      aria-labelledby="ahvaz-car-scout-title"
      id="ahvaz-car-scout"
    >
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            ایجنت Market Scout · آزمون مستقل خودرو
          </p>
          <h2 id="ahvaz-car-scout-title">جست‌وجوی نمایشگاه‌های خودرو اهواز</h2>
          <p>
            دریافت تازه از داده عمومی OpenStreetMap با برچسب <bdi>shop=car</bdi>
            ؛ بررسی رکوردهای داخل محدوده اهواز و حاشیه آن.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.primary}
            disabled={!loaded || error || pending !== null || snapshot !== null}
            onClick={() => void request(true)}
          >
            {pending === "run"
              ? "در حال جست‌وجوی واقعی…"
              : snapshot
                ? "اجرای این آزمون ثبت شده"
                : "اجرای جست‌وجوی واقعی اهواز"}
          </button>
          <button
            disabled={pending !== null}
            onClick={() => void request(false)}
          >
            تازه‌سازی گزارش
          </button>
        </div>
      </div>

      <p className={styles.notice}>
        این خروجی فقط مشاهده در منبع عمومی است؛ وجود یا نبود واقعی سایت، فعال
        بودن نمایشگاه و نیاز به خدمات هنوز بررسی نشده است. امتیاز فروش یا مشتری
        تأییدشده تولید نمی‌شود.
      </p>
      <details className={styles.scope}>
        <summary>محدوده و سقف این آزمون</summary>
        <p>
          کادر پژوهشی با ترتیب جنوب، غرب، شمال، شرق:{" "}
          <bdi>{AHVAZ_CAR_SCOUT_BBOX.join(", ")}</bdi>. این کادر مرز رسمی شهر
          نیست و پوشش تمام نمایشگاه‌ها یا شهرک‌های خودرویی را تضمین نمی‌کند.
        </p>
        <p>
          فقط رکوردهای <bdi>shop=car</bdi> بررسی می‌شوند. تگ سایت لازم نیست؛
          ردیف بدون نام معتبر یا خارج از کادر کنار گذاشته می‌شود. برای
          ساختمان‌ها مرکز کادر هندسی ملاک است.
        </p>
        <p>
          حداکثر {AHVAZ_CAR_SCOUT_BUDGET.maxRequests} درخواست عمومی،{" "}
          {AHVAZ_CAR_SCOUT_BUDGET.maxRows} ردیف، ۳۰ ثانیه و ۵۱۲٬۰۰۰ بایت. هزینه
          پولی: صفر. سایت‌ها بازبینی یا خزش نمی‌شوند.
        </p>
        <p>
          یک تلاش برای هر فضای کاری در عمر همین فرایند محلی؛ تازه‌سازی فقط گزارش
          را می‌خواند. گزارش و قفل تکرار در حافظه‌اند و با راه‌اندازی مجدد سرور
          پاک می‌شوند.
        </p>
        <a
          href="https://www.openstreetmap.org/export?bbox=48.4,31.15,48.95,31.6"
          target="_blank"
          rel="noopener noreferrer"
        >
          محدوده روی OpenStreetMap
        </a>
      </details>

      {error && (
        <p role="alert" className={styles.error}>
          خواندن یا اجرای گزارش ممکن نشد. داده قبلی پاک شد؛ برای بازیابی وضعیت
          ثبت‌شده «تازه‌سازی گزارش» را بزنید. تکرار خودکار درخواست منبع انجام
          نمی‌شود.
        </p>
      )}
      <div role="status" aria-live="polite" className={styles.status}>
        {pending === "run"
          ? "درخواست به ایجنت برنامه ارسال شد؛ منتظر پاسخ منبع عمومی هستیم."
          : snapshot
            ? statusText[snapshot.status]
            : !loaded
              ? "در حال خواندن وضعیت ثبت‌شده…"
              : !error
                ? "هنوز اجرا نشده؛ هیچ نتیجه‌ای از پیش بارگذاری نشده است."
                : "گزارش در دسترس نیست."}
      </div>
      {snapshot && (
        <>
          {snapshot.failureCode && (
            <p className={styles.error}>
              {failureText[snapshot.failureCode]} این وضعیت به معنای نبود
              نمایشگاه نیست.
            </p>
          )}
          {snapshot.status === "EMPTY" && (
            <p className={styles.notice}>
              پاسخ خالی فقط وضعیت این منبع و این فیلتر است؛ تعداد واقعی
              نمایشگاه‌ها یا وضعیت سایت آن‌ها از این آزمون معلوم نمی‌شود.
            </p>
          )}
          <dl className={styles.metrics}>
            <div>
              <dt>درخواست منبع</dt>
              <dd>{snapshot.requestCount} / ۱</dd>
            </div>
            <div>
              <dt>پاسخ HTTP منبع</dt>
              <dd>{snapshot.sourceHttpStatus ?? "پاسخی ثبت نشده"}</dd>
            </div>
            <div>
              <dt>رکورد دریافتی</dt>
              <dd>{snapshot.discovery?.elementsReturned ?? "—"}</dd>
            </div>
            <div>
              <dt>ردیف پذیرفته‌شده</dt>
              <dd>{snapshot.discovery?.rows.length ?? "—"}</dd>
            </div>
            <div>
              <dt>ردیف کنارگذاشته‌شده</dt>
              <dd>
                {snapshot.discovery
                  ? Object.values(snapshot.discovery.rejections).reduce(
                      (a, b) => a + b,
                      0
                    )
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className={styles.meta}>
            شناسه اجرا: <bdi>{snapshot.runId}</bdi> · شروع:{" "}
            <time dateTime={snapshot.startedAt}>
              {formatTime(snapshot.startedAt)}
            </time>
            {snapshot.finishedAt && (
              <>
                {" "}
                · پایان:{" "}
                <time dateTime={snapshot.finishedAt}>
                  {formatTime(snapshot.finishedAt)}
                </time>
              </>
            )}
          </p>
          {snapshot.discovery?.sourceSnapshotAt && (
            <p className={styles.meta}>
              زمان نسخه داده OpenStreetMap:{" "}
              <time dateTime={snapshot.discovery.sourceSnapshotAt}>
                {formatTime(snapshot.discovery.sourceSnapshotAt)}
              </time>
            </p>
          )}
          {snapshot.discovery?.limitReached && (
            <p className={styles.notice}>
              سقف ردیف منبع پر شد؛ نتیجه محدود است و فهرست کامل محسوب نمی‌شود.
            </p>
          )}
          {snapshot.discovery && (
            <>
              <ObservationGroup
                title="لینک سایت در منبع ثبت نشده / نیازمند بررسی"
                rows={missing}
              />
              <ObservationGroup
                title="لینک سایت در منبع ثبت شده"
                rows={recorded}
              />
              {unsafe.length > 0 && (
                <ObservationGroup
                  title="لینک ثبت‌شده قابل نمایش ایمن نبود / نیازمند بررسی"
                  rows={unsafe}
                />
              )}
              <details className={styles.scope}>
                <summary>شمارنده‌های بررسی ورودی</summary>
                <dl className={styles.metrics}>
                  {Object.entries(snapshot.discovery.rejections).map(
                    ([key, value]) => (
                      <div key={key}>
                        <dt>
                          <bdi>{key}</bdi>
                        </dt>
                        <dd>{value}</dd>
                      </div>
                    )
                  )}
                </dl>
              </details>
            </>
          )}
        </>
      )}
      <p className={styles.attribution}>
        منبع: OpenStreetMap / Overpass · © مشارکت‌کنندگان OpenStreetMap ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          مجوز ODbL 1.0
        </a>
      </p>
    </section>
  );
}

function ObservationGroup({
  title,
  rows
}: {
  title: string;
  rows: CarScoutObservation[];
}) {
  return (
    <section className={styles.group} aria-label={title}>
      <h3>
        {title} <span className={styles.count}>{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className={styles.meta}>
          در این اجرا ردیفی در این دسته ثبت نشده است.
        </p>
      ) : (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.observationId} className={styles.row}>
              <h4>
                <bdi>{row.name}</bdi>
              </h4>
              <p>
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  رکورد عمومی OpenStreetMap
                </a>{" "}
                ·{" "}
                <bdi>
                  {row.osmType}/{row.osmId}
                </bdi>
              </p>
              {row.website.state === "RECORDED" && (
                <p>
                  لینک اعلام‌شده، بررسی‌نشده:{" "}
                  <a
                    href={row.website.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <bdi>{row.website.url}</bdi>
                  </a>
                </p>
              )}
              <p className={styles.meta}>
                مختصات:{" "}
                <bdi>
                  {row.latitude}, {row.longitude}
                </bdi>{" "}
                · مشاهده:{" "}
                <time dateTime={row.observedAt}>
                  {formatTime(row.observedAt)}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Tehran"
  }).format(new Date(value));
}
