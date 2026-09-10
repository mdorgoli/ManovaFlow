import { describe, expect, it } from "vitest";
import { detectMarketScoutLanguage } from "@/modules/growth/application/market-scout-language";

describe("Market Scout language detection", () => {
  it.each([
    { text: "خدمات تعمیر پکیج و لوله‌کشی تهران", marketLocales: ["fa-IR", "en"], basis: "PUBLIC_TEXT" },
    { text: "تاسيسات ساختمان تهران", marketLocales: ["fa-IR", "en"], basis: "MARKET_LOCALE_FALLBACK" },
    { text: "Tehran Studio 24", marketLocales: ["fa-IR", "en"], basis: "MARKET_LOCALE_FALLBACK" }
  ])("does not label Persian research data as Arabic: $text", ({ text, marketLocales, basis }) => {
    expect(detectMarketScoutLanguage({ text, marketLocales })).toEqual({ language: "fa", direction: "RTL", basis });
  });

  it.each([
    {
      text: "Professional services for local companies and their teams.",
      marketLocales: ["fr-FR", "en"],
      expected: { language: "en", direction: "LTR", basis: "PUBLIC_TEXT" }
    },
    {
      text: "Services professionnels pour les entreprises et les equipes locales.",
      marketLocales: ["en", "fr-FR"],
      expected: { language: "fr", direction: "LTR", basis: "PUBLIC_TEXT" }
    },
    {
      text: "خدمات مهنية للشركات المحلية وإدارة فرق العمل.",
      marketLocales: ["en"],
      expected: { language: "ar", direction: "RTL", basis: "PUBLIC_TEXT" }
    }
  ])("detects $expected.language from bounded public text", ({
    text,
    marketLocales,
    expected
  }) => {
    expect(detectMarketScoutLanguage({ text, marketLocales })).toEqual(expected);
  });

  it.each([
    {
      marketLocales: ["fr-FR", "en"],
      expected: { language: "fr", direction: "LTR", basis: "MARKET_LOCALE_FALLBACK" }
    },
    {
      marketLocales: ["ar-AE", "en"],
      expected: { language: "ar", direction: "RTL", basis: "MARKET_LOCALE_FALLBACK" }
    },
    {
      marketLocales: ["tr-TR"],
      expected: { language: "en", direction: "LTR", basis: "DEFAULT_ENGLISH" }
    }
  ])("uses a supported market fallback without inventing another language", ({
    marketLocales,
    expected
  }) => {
    expect(
      detectMarketScoutLanguage({ text: "Studio 24", marketLocales })
    ).toEqual(expected);
  });

  it("rejects empty or oversized public text before detection", () => {
    expect(() =>
      detectMarketScoutLanguage({ text: "   ", marketLocales: ["en"] })
    ).toThrow("MARKET_SCOUT_PUBLIC_TEXT_INVALID");
    expect(() =>
      detectMarketScoutLanguage({ text: "a".repeat(4_001), marketLocales: ["en"] })
    ).toThrow("MARKET_SCOUT_PUBLIC_TEXT_INVALID");
  });
});
