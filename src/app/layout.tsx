import type { Metadata } from "next";
import "./sana-tokens.css";
import "./design-tokens.css";
import "./typography.css";
import "./globals.css";
import "./design-system.css";
import "./dashboard-reference.css";
import "./sana-system.css";
export const metadata: Metadata = {
  title: "Sanaa Tasks",
  description: "A clear place for your projects, team, and everyday work.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* Extensions such as Grammarly add attributes to <body> before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
