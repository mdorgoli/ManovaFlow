import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "ManovaFlow",
  description: "Human-controlled workflows for service businesses. Research preview."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
