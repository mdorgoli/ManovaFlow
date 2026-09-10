import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { homeCopy } from "@/components/public-home/home-copy";
import { PublicHomepage } from "@/components/public-home/public-homepage";

type Props = { params: Promise<{ locale: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "ar" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "ar") notFound();
  return homeCopy[locale].metadata;
}

export default async function LocalizedHomePage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "ar") notFound();
  return <PublicHomepage locale={locale} />;
}
