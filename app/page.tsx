import type { Metadata } from "next";
import { LandingPage } from "@/app/landing-page";

export const metadata: Metadata = {
  title: { absolute: "ProReach — Approval-first AI marketing agent" },
  description: "Turn product context into coordinated social campaigns, channel-native drafts, visuals, approvals, schedules, and publish-ready posts with ProReach.",
  keywords: [
    "AI marketing agent",
    "social media campaign generator",
    "product marketing automation",
    "approval workflow",
    "multi-channel social publishing",
    "AI content marketing",
  ],
  alternates: { canonical: "https://proreach.in" },
  openGraph: {
    type: "website",
    url: "https://proreach.in",
    siteName: "ProReach",
    title: "ProReach — Make your product impossible to ignore",
    description: "Approval-first AI marketing that turns product truth into coordinated, channel-native campaigns.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ProReach — Make your product impossible to ignore" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProReach — Make your product impossible to ignore",
    description: "Approval-first AI marketing that turns product truth into coordinated, channel-native campaigns.",
    images: ["/og.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://proreach.in/#organization",
      name: "ProReach",
      url: "https://proreach.in",
      logo: "https://proreach.in/proreach-mark.svg",
    },
    {
      "@type": "WebSite",
      "@id": "https://proreach.in/#website",
      url: "https://proreach.in",
      name: "ProReach",
      publisher: { "@id": "https://proreach.in/#organization" },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "ProReach",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://proreach.in",
      description: "An approval-first AI marketing workspace for product context, multi-channel campaign creation, review, scheduling, and publishing.",
      featureList: [
        "Reusable product and brand context",
        "Multi-channel social campaign generation",
        "Human approval workflow",
        "Social publishing calendar",
        "Branded campaign visuals",
      ],
      publisher: { "@id": "https://proreach.in/#organization" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is ProReach?",
          acceptedAnswer: { "@type": "Answer", text: "ProReach is an approval-first AI marketing workspace that turns saved product context into coordinated social campaigns, channel-specific drafts, visuals, schedules, and publish-ready posts." },
        },
        {
          "@type": "Question",
          name: "How is ProReach different from a generic AI writer?",
          acceptedAnswer: { "@type": "Answer", text: "ProReach begins with a reusable source of truth covering the customer, positioning, proof, voice, and constraints, helping campaigns remain consistent across channels." },
        },
        {
          "@type": "Question",
          name: "Does ProReach publish automatically?",
          acceptedAnswer: { "@type": "Answer", text: "ProReach requires human approval. Users review drafts, select a publishing destination, and choose whether to publish immediately or schedule a post." },
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <LandingPage />
    </>
  );
}
