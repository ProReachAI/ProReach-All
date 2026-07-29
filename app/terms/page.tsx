import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the ProReach marketing workspace.",
  alternates: { canonical: "https://proreach.in/terms" },
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav">
        <Link href="/"><span><Image src="/logo.png" alt="" width={36} height={36} /></span><strong>ProReach</strong></Link>
        <Link href="/login">Open workspace</Link>
      </nav>
      <article>
        <span className="legal-kicker">LEGAL / TERMS</span>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: July 29, 2026</p>
        <p>These terms govern access to and use of ProReach. By using the service, you agree to these terms.</p>

        <h2>Using ProReach</h2>
        <p>You may use ProReach only in compliance with applicable laws, platform rules, and these terms. You are responsible for your account, the information you provide, and activity performed through your authorized integrations.</p>

        <h2>Your content and approvals</h2>
        <p>You retain responsibility for product context, campaign materials, uploaded assets, instructions, and final published content. AI-assisted output may be inaccurate or unsuitable. You must review claims, rights, destinations, timing, and compliance before approving publication.</p>

        <h2>Connected services</h2>
        <p>Google, social networks, infrastructure providers, and other third-party services have separate terms. Their availability, permissions, and behavior are outside ProReach&apos;s direct control.</p>

        <h2>Acceptable use</h2>
        <p>You may not use ProReach to violate intellectual-property rights, impersonate others, distribute unlawful or deceptive content, compromise systems, evade platform restrictions, or send content you are not authorized to publish.</p>

        <h2>Service availability</h2>
        <p>Features may change, be suspended, or become unavailable. ProReach does not guarantee campaign performance, reach, engagement, search visibility, leads, or revenue.</p>

        <h2>Termination</h2>
        <p>Access may be limited or terminated when necessary to protect the service, users, third parties, or comply with legal obligations. You may stop using the service and revoke connected-platform access at any time.</p>

        <h2>Changes</h2>
        <p>These terms may be updated as the service evolves. Continued use after an update means you accept the revised terms.</p>
      </article>
      <footer><Link href="/">Back to ProReach</Link><Link href="/privacy">Privacy Policy</Link></footer>
    </main>
  );
}
