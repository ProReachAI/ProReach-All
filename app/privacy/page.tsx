import type { Metadata } from "next";
import Link from "next/link";
import { ProReachLogo } from "@/components/proreach-logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ProReach handles account, product, campaign, and connected-platform information.",
  alternates: { canonical: "https://proreach.in/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav">
        <Link href="/"><ProReachLogo size={38} /></Link>
        <Link href="/login">Open workspace</Link>
      </nav>
      <article>
        <span className="legal-kicker">LEGAL / PRIVACY</span>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: July 29, 2026</p>
        <p>This policy explains the information ProReach processes to provide its approval-first marketing workspace.</p>

        <h2>Information we process</h2>
        <p>When you sign in, Google and Supabase provide basic account information such as your name, email address, profile image, and authentication identifiers. We do not receive your Google password.</p>
        <p>When you use the product, we process the product context, campaign briefs, drafts, visual assets, schedules, publishing choices, and connected social-account information you provide.</p>

        <h2>How information is used</h2>
        <p>We use information to authenticate your account, operate the workspace, generate and store campaign materials, connect authorized publishing destinations, schedule or publish approved content, maintain security, and diagnose service problems.</p>

        <h2>Service providers</h2>
        <p>ProReach relies on service providers for authentication, databases, hosting, asset storage, AI-assisted generation, and social-platform connections. These providers process information according to their own terms and privacy commitments.</p>

        <h2>Connected platforms</h2>
        <p>Social-platform access is used only for the permissions you authorize, such as identifying available publishing destinations or publishing content you explicitly approve. You can revoke access through the relevant platform or remove a connection in ProReach.</p>

        <h2>Retention and security</h2>
        <p>Information is retained as needed to provide the service, meet legal obligations, resolve disputes, and protect the service. We use reasonable technical and organizational safeguards, but no internet service can guarantee absolute security.</p>

        <h2>Your choices</h2>
        <p>You may disconnect integrations, revoke provider access, sign out, and request access to or deletion of account-related information through the support channel associated with the service.</p>

        <h2>Changes</h2>
        <p>We may update this policy as ProReach evolves. Material changes will be reflected by an updated date on this page.</p>
      </article>
      <footer><Link href="/">Back to ProReach</Link><Link href="/terms">Terms of Service</Link></footer>
    </main>
  );
}
