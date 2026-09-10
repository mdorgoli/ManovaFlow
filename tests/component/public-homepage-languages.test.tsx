// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PublicHomepage } from "@/components/public-home/public-homepage";

afterEach(cleanup);

describe("public homepage languages", () => {
  it("exposes all three language destinations in the header without opening the menu", () => {
    render(<PublicHomepage />);
    const languages = within(screen.getByRole("banner")).getByRole("navigation", { name: "Language" });
    expect(within(languages).getByRole("link", { name: "English" })).toHaveAttribute("href", "/");
    expect(within(languages).getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "page");
    expect(within(languages).getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr");
    expect(within(languages).getByRole("link", { name: "العربية" })).toHaveAttribute("href", "/ar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the complete French story and preserves the research-only disclosures", () => {
    const { container } = render(<PublicHomepage locale="fr" />);
    expect(screen.getByRole("heading", { level: 1, name: "Chaque demande, clairement traitée." })).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute("lang", "fr");
    expect(container.firstElementChild).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("En développement actif")).toBeVisible();
    expect(screen.getAllByText("En cours de validation")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Le parcours d’une demande dans ManovaFlow" }).children).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Pensé pour les entreprises de services" })).toBeVisible();
    expect(screen.getByText(/L’envoi de messages, la réservation de services et les paiements ne sont pas activés/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Ouvrir le tableau de recherche" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Built for service businesses")).not.toBeInTheDocument();
    expect(screen.queryByText("In active development")).not.toBeInTheDocument();
  });

  it("renders Arabic with RTL direction, translated workflow and honest development status", () => {
    const { container } = render(<PublicHomepage locale="ar" />);
    expect(screen.getByRole("heading", { level: 1, name: "كل طلب، يُدار بوضوح." })).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute("lang", "ar");
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("list", { name: "مراحل معالجة الطلب في ManovaFlow" }).children).toHaveLength(5);
    expect(screen.getByText("موافقة بشرية")).toBeVisible();
    expect(screen.getByText("قيد التطوير الفعلي")).toBeVisible();
    expect(screen.getAllByText("قيد التحقق")).toHaveLength(2);
    expect(screen.getByText(/إرسال الرسائل وحجز الخدمات والمدفوعات غير مفعّلة/)).toBeVisible();
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "الصفحة الرئيسية لمنصة ManovaFlow" })).toHaveAttribute("href", "/ar");
    expect(screen.queryByText("Human approval")).not.toBeInTheDocument();
  });

  it.each([
    { locale: "fr" as const, open: "Ouvrir le menu", dialog: "Menu de navigation", close: "Fermer le menu", section: "Les parcours" },
    { locale: "ar" as const, open: "فتح القائمة", dialog: "قائمة التنقل", close: "إغلاق القائمة", section: "المسارات" }
  ])("localizes the $locale mobile menu and retains keyboard dismissal", ({ locale, open, dialog, close, section }) => {
    render(<PublicHomepage locale={locale} />);
    const trigger = screen.getByRole("button", { name: open });
    trigger.focus();
    fireEvent.click(trigger);
    const menu = screen.getByRole("dialog", { name: dialog });
    expect(within(menu).getByRole("button", { name: close })).toHaveFocus();
    expect(within(menu).getByRole("link", { name: section })).toHaveAttribute("href", "#flows");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
