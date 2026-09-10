import type { Metadata } from "next";
import { ServiceFlowDemo } from "@/components/serviceflow-demo";

export const metadata: Metadata = {
  title: "ServiceFlow Demo · ManovaFlow",
  description: "Local, synthetic ServiceFlow operations demo"
};

export const dynamic = "force-dynamic";

export default function ServiceFlowPage() {
  return <ServiceFlowDemo initialSnapshot={null} />;
}
