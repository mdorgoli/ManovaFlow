import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import Image from "next/image";
import { TrayIcon, SparkleIcon, UserIcon, ClipboardTextIcon, ShieldCheckIcon, UsersThreeIcon, ArrowUpRightIcon, WaveSineIcon } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "./site-header";
import { HeroPhoto } from "./hero-photo";
import styles from "./public-home.module.css";
import { homeCopy, type HomeLocale } from "./home-copy";

function PreviewNotice({ text }: { text: string }) {
  return <p className={styles.previewNotice}><ShieldCheckIcon size={21} weight="thin" aria-hidden="true" />{text}</p>;
}

export function PublicHomepage({ locale = "en" }: { locale?: HomeLocale }) {
  const copy = homeCopy[locale];
  const stages = [
    { label: copy.stages[0], icon: TrayIcon },
    { label: copy.stages[1], icon: SparkleIcon },
    { label: copy.stages[2], icon: UserIcon },
    { label: copy.stages[3], icon: ClipboardTextIcon },
    { label: copy.stages[4], icon: ShieldCheckIcon }
  ];
  const values = [
    { ...copy.values[0], icon: UsersThreeIcon },
    { ...copy.values[1], icon: SparkleIcon },
    { ...copy.values[2], icon: ClipboardTextIcon },
    { ...copy.values[3], icon: ShieldCheckIcon }
  ];
  return (
    <div className={styles.home} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <a className={styles.skipLink} href="#main-content">{copy.skip}</a>
      <SiteHeader locale={locale} copy={copy.header} />
      <main id="main-content" data-menu-background>
        <section className={styles.hero} id="product" aria-labelledby="home-title">
          <HeroPhoto />
          <div className={styles.heroCopy}>
            <h1 id="home-title">{copy.title[0]}<br /> {copy.title[1]}<span>.</span></h1>
            <p className={styles.heroDescription}>{copy.introduction[0]}<br /> {copy.introduction[1]}<br /> {copy.introduction[2]}</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#how-it-works">{copy.header.workflow}</a>
              <a className={styles.secondaryButton} href="#serviceflow">{copy.header.serviceflow}</a>
            </div>
            <PreviewNotice text={copy.preview} />
          </div>
          <div id="how-it-works" className={styles.workflow} tabIndex={-1}>
            <ol aria-label={copy.workflowLabel}>
              {stages.map(({ label, icon: Icon }, index) => {
                return <li key={index}>
                  <Icon className={styles.stageIcon} size={42} weight="thin" aria-hidden="true" />
                  <span className={styles.stageNumber} aria-hidden="true">{index + 1}</span>
                  <span className={styles.stageLabel}>{label}{index === 4 && <small>{copy.closed}</small>}</span>
                  {index < copy.stages.length - 1 && <WaveSineIcon className={styles.stageConnector} weight="thin" aria-hidden="true" />}
                </li>;
              })}
            </ol>
          </div>
        </section>

        <section id="flows" className={styles.flows} aria-label={copy.flowsLabel}>
          {[
            ["ServiceFlow", copy.development, "serviceflow"],
            ["BeautyFlow", copy.validation, "beautyflow"],
            ["BriefFlow", copy.validation, "briefflow"]
          ].map(([name, status, id]) => (
            <div className={styles.flow} id={id} key={name}>
              <Image src="/assets/brand/manovaflow-mf.svg" alt="" width={43} height={31} unoptimized />
              <div><h2><bdi>{name}</bdi></h2><p>{status}</p></div>
            </div>
          ))}
        </section>

        <section className={styles.values} aria-labelledby="values-title">
          <h2 id="values-title">{copy.valuesTitle}</h2>
          <p className={styles.sectionIntro}>{copy.valuesIntro}</p>
          <div className={styles.valueGrid}>
            {values.map((value, index) => {
              const Icon = value.icon;
              return <article key={index}>
              <Icon size={44} weight="thin" aria-hidden="true" />
              <h3>{value.title}</h3><p>{value.detail}</p>
            </article>;
            })}
          </div>
        </section>

        <section id="about" className={styles.about} aria-labelledby="about-title">
          <div><span className={styles.eyebrow}>{copy.aboutEyebrow}</span><h2 id="about-title">{copy.aboutTitle[0]}<br /> {copy.aboutTitle[1]}</h2></div>
          <div>{copy.about.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        </section>
        <section id="resources" className={styles.resources} aria-labelledby="resources-title">
          <div><span className={styles.eyebrow}>{copy.resourcesEyebrow}</span><h2 id="resources-title">{copy.resourcesTitle}</h2>
            <p>{copy.resourcesDescription}</p></div>
          <div className={styles.resourceLinks}>
            {["/serviceflow", "/market-scout", "/dashboard"].map((href, index) => <a key={href} href={href}>{copy.resourceLinks[index]}<ArrowUpRightIcon size={22} weight="light" aria-hidden="true" /></a>)}
          </div>
        </section>
      </main>
      <footer className={styles.footer} data-menu-background>
        <span dir="ltr">MANOVAFLOW</span><PreviewNotice text={copy.preview} /><a href="#product">{copy.backToTop}</a>
      </footer>
    </div>
  );
}
