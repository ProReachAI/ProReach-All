import type { Metadata } from "next";
import { appOrigin } from "@/lib/app-origin";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: {
    default: "ProReach — Approval-first AI marketing agent",
    template: "%s | ProReach",
  },
  description: "Plan, approve, and publish product marketing from one calm workspace.",
  icons: {
    icon: "/proreach-mark.svg",
    shortcut: "/proreach-mark.svg",
    apple: "/proreach-mark.svg",
  },
  category: "technology",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
