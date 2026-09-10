import type { Metadata } from "next";
import { GrowthDashboard } from "@/components/growth-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ManovaFlow · Research dashboard",
  description: "Internal research-only growth control. No outbound actions.",
  robots: { index: false, follow: false }
};

export default function DashboardPage() {
  return <GrowthDashboard initialModel={null} />;
}
