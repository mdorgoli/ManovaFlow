import type { Metadata } from "next";
import { PublicHomepage } from "@/components/public-home/public-homepage";
import { homeCopy } from "@/components/public-home/home-copy";

export const metadata: Metadata = homeCopy.en.metadata;

export default function HomePage() {
  return <PublicHomepage />;
}
