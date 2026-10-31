"use client";

import { useEffect, useRef, useState } from "react";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { Brand } from "./brand";
import styles from "./public-home.module.css";
import { homeLanguageOptions, type HomeHeaderCopy, type HomeLocale } from "./home-copy";

const destinations = ["#product", "#flows", "#how-it-works", "#about", "#resources"] as const;

export function SiteHeader({ locale, copy }: { locale: HomeLocale; copy: HomeHeaderCopy }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnTarget = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [...document.querySelectorAll<HTMLElement>("[data-menu-background]")];
    const wasInert = background.map((element) => element.hasAttribute("inert"));
    background.forEach((element) => element.setAttribute("inert", ""));
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const media = window.matchMedia?.("(min-width: 1100px)");
    const closeOnDesktop = () => { if (media?.matches) setOpen(false); };
    media?.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = overflow;
      background.forEach((element, index) => { if (!wasInert[index]) element.removeAttribute("inert"); });
      media?.removeEventListener("change", closeOnDesktop);
      returnTarget?.focus();
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner} data-menu-background>
        <Brand href={locale === "en" ? "/" : `/${locale}`} label={copy.home} />
        <nav className={styles.desktopNav} aria-label={copy.mainNavigation}>
          {destinations.map((href, index) => <a key={href} href={href}>{copy.navigation[index]}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.primaryButton} href="#how-it-works">{copy.workflow}</a>
          <a className={styles.secondaryButton} href="#serviceflow">{copy.serviceflow}</a>
        </div>
        <nav className={styles.languageSwitch} aria-label={copy.language}>
          {homeLanguageOptions.map((option) => <a key={option.locale} href={option.href} hrefLang={option.locale}
            lang={option.locale} dir={option.locale === "ar" ? "rtl" : "ltr"} aria-label={option.label}
            aria-current={locale === option.locale ? "page" : undefined}>{option.short}</a>)}
        </nav>
        <button ref={trigger} type="button" className={styles.menuTrigger} aria-label={copy.openMenu}
          title={copy.openMenu} aria-expanded={open} aria-controls="home-navigation-menu" onClick={() => setOpen(true)}>
          <ListIcon size={28} weight="thin" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className={styles.menuBackdrop} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div id="home-navigation-menu" ref={dialog} className={styles.menuDialog} role="dialog" aria-modal="true"
            aria-label={copy.menu} tabIndex={-1} onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
              if (event.key !== "Tab") return;
              const controls = dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
              const first = controls?.[0];
              const last = controls?.[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }}>
            <div className={styles.menuHeading}>
              <span>{copy.explore}</span>
              <button type="button" aria-label={copy.closeMenu} title={copy.closeMenu} onClick={() => setOpen(false)}>
                <XIcon size={26} weight="light" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label={copy.mobileNavigation}>
              {destinations.map((href, index) => <a key={href} href={href} onClick={() => setOpen(false)}>{copy.navigation[index]}</a>)}
            </nav>
            <a className={styles.primaryButton} href="#how-it-works" onClick={() => setOpen(false)}>{copy.workflow}</a>
            <a className={styles.secondaryButton} href="#serviceflow" onClick={() => setOpen(false)}>{copy.serviceflow}</a>
          </div>
        </div>
      )}
    </header>
  );
}
