import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProReach — Marketing Agent for Indie Builders",
  description: "Plan, approve, and publish product marketing from one calm workspace.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
