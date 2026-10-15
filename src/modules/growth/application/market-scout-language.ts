import type {
  MarketScoutDirection,
  MarketScoutResearchLanguage,
  MarketScoutLanguageBasis
} from "./market-scout-contracts";

const MAX_PUBLIC_TEXT_LENGTH = 4_000;
const ARABIC_SCRIPT = /\p{Script=Arabic}/gu;
const WORDS = /\p{L}+/gu;

const LANGUAGE_WORDS = Object.freeze({
  en: new Set([
    "and",
    "business",
    "companies",
    "company",
    "for",
    "local",
    "professional",
    "services",
    "team",
    "teams",
    "the",
    "with"
  ]),
  fr: new Set([
    "aux",
    "avec",
    "de",
    "des",
    "entreprise",
    "entreprises",
    "et",
    "les",
    "locale",
    "locales",
    "pour",
    "professionnels",
    "services"
  ])
});

export interface MarketScoutLanguageInput {
  text: string;
  marketLocales: readonly string[];
}

export interface MarketScoutLanguageResult {
  language: MarketScoutResearchLanguage;
  direction: MarketScoutDirection;
  basis: MarketScoutLanguageBasis;
}

export function detectMarketScoutLanguage(
  input: MarketScoutLanguageInput
): MarketScoutLanguageResult {
  const text = input.text.normalize("NFKC").trim();
  if (!text || text.length > MAX_PUBLIC_TEXT_LENGTH) {
    throw new Error("MARKET_SCOUT_PUBLIC_TEXT_INVALID");
  }

  const arabicCharacters = text.match(ARABIC_SCRIPT)?.length ?? 0;
  if (arabicCharacters >= 3) {
    const persianMarket = input.marketLocales.some((locale) =>
      /^fa(?:-|$)/i.test(locale)
    );
    if (persianMarket) {
      return result(
        "fa",
        /[پچژگکی]/u.test(text) ? "PUBLIC_TEXT" : "MARKET_LOCALE_FALLBACK"
      );
    }
    return result("ar", "PUBLIC_TEXT");
  }

  const words = (text.toLocaleLowerCase("und").match(WORDS) ?? []).map((word) =>
    stripMarks(word)
  );
  const englishScore = score(words, LANGUAGE_WORDS.en);
  const frenchScore = score(words, LANGUAGE_WORDS.fr);

  if (englishScore >= 2 && englishScore > frenchScore) {
    return result("en", "PUBLIC_TEXT");
  }
  if (frenchScore >= 2 && frenchScore > englishScore) {
    return result("fr", "PUBLIC_TEXT");
  }

  for (const locale of input.marketLocales) {
    const language = supportedLocaleLanguage(locale);
    if (language) return result(language, "MARKET_LOCALE_FALLBACK");
  }

  return result("en", "DEFAULT_ENGLISH");
}

function score(
  words: readonly string[],
  vocabulary: ReadonlySet<string>
): number {
  return words.reduce(
    (total, word) => total + (vocabulary.has(word) ? 1 : 0),
    0
  );
}

function stripMarks(value: string): string {
  return value.normalize("NFD").replace(/\p{Mark}/gu, "");
}

function supportedLocaleLanguage(
  locale: string
): MarketScoutResearchLanguage | null {
  const language = locale.trim().toLowerCase().split("-")[0];
  return language === "en" ||
    language === "fr" ||
    language === "ar" ||
    language === "fa"
    ? language
    : null;
}

function result(
  language: MarketScoutResearchLanguage,
  basis: MarketScoutLanguageBasis
): MarketScoutLanguageResult {
  return {
    language,
    direction: language === "ar" || language === "fa" ? "RTL" : "LTR",
    basis
  };
}
