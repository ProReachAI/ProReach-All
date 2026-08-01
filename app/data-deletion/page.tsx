import type { Metadata } from "next";
import Link from "next/link";
import { ProReachLogo } from "@/components/proreach-logo";

export const metadata: Metadata = {
  title: "User Data Deletion",
  description: "How to disconnect social accounts and request deletion of personal data stored by ProReach.",
  alternates: { canonical: "/data-deletion" },
};

const supportEmail = "buildtoreach@gmail.com";
const deletionSubject = "ProReach data deletion request";

export default function DataDeletionPage() {
  const deletionEmail = `mailto:${supportEmail}?subject=${encodeURIComponent(deletionSubject)}`;

  return (
    <main className="legal-page">
      <nav className="legal-nav">
        <Link href="/"><ProReachLogo size={38} /></Link>
        <Link href="/login">Open workspace</Link>
      </nav>
      <article>
        <span className="legal-kicker">LEGAL / DATA DELETION</span>
        <h1>User Data Deletion</h1>
        <p className="legal-updated">Last updated: August 1, 2026</p>
        <p>
          This page explains how to disconnect Facebook, Instagram, Threads, and other authorized platforms from
          ProReach and how to request deletion of personal information associated with your ProReach account.
        </p>

        <h2>Disconnect a social-platform account</h2>
        <ol className="legal-steps">
          <li>Sign in to ProReach and open the relevant workspace and project.</li>
          <li>Open Connections and locate the Facebook, Instagram, Threads, or other integration.</li>
          <li>Select Disconnect and confirm the action. ProReach will remove the stored authorization tokens for that connection.</li>
          <li>You may also revoke ProReach directly from the connected platform&apos;s apps, websites, or business-integrations settings.</li>
        </ol>
        <p>
          Disconnecting an integration prevents future access through that authorization. It does not automatically
          delete campaign drafts, generated assets, or other information in your ProReach account.
        </p>

        <h2>Request deletion of your ProReach data</h2>
        <p>
          Email <a className="legal-inline-link" href={deletionEmail}>{supportEmail}</a> from the email address associated
          with your ProReach account. Use the subject <strong>{deletionSubject}</strong> and include:
        </p>
        <ul className="legal-steps">
          <li>Your full name and the email address used to access ProReach.</li>
          <li>The workspace, organization, or project name, if applicable.</li>
          <li>Whether you want the entire account deleted or only data associated with a specific connected platform.</li>
          <li>For a platform-specific request, the platform name and account username or Page name.</li>
        </ul>
        <p>Never send passwords, one-time codes, access tokens, app secrets, or other authentication credentials.</p>

        <h2>Verification and completion</h2>
        <p>
          We may ask for reasonable information to confirm that you control the account. After verification, we will
          delete or irreversibly anonymize the requested personal information and remove applicable connected-platform
          credentials from systems under our control. We aim to complete verified requests within 30 days and will
          contact you if more time is required.
        </p>

        <h2>Information that may be retained</h2>
        <p>
          Limited information may be retained when required for legal obligations, fraud prevention, security, dispute
          resolution, or enforcement of our agreements. Residual copies may remain temporarily in encrypted backups
          until those backups expire under normal retention cycles.
        </p>

        <h2>Confirmation</h2>
        <p>
          We will send confirmation to the verified account email after processing the request. Questions about this
          process can be sent to <a className="legal-inline-link" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </article>
      <footer>
        <Link href="/">Back to ProReach</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </footer>
    </main>
  );
}
