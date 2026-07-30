import { ArrowLeft, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FaLinkedinIn } from "react-icons/fa6";
import { SiInstagram, SiMeta, SiThreads, SiX } from "react-icons/si";
import { ProReachLogo } from "@/components/proreach-logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const providers = [
  {
    id: "meta",
    name: "Facebook Pages",
    icon: SiMeta,
    portal: "https://developers.facebook.com/apps/",
    env: ["META_APP_ID", "META_APP_SECRET", "META_GRAPH_VERSION=v25.0"],
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    steps: [
      "Create a Business app and add Facebook Login for Business.",
      "Add the callback below to Valid OAuth Redirect URIs.",
      "During development, add your Facebook account as an app role or tester.",
      "For public users, request Advanced Access and complete the required App Review/business verification.",
      "Facebook connects independently; an Instagram account is not required.",
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: SiInstagram,
    portal: "https://developers.facebook.com/apps/",
    env: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "META_GRAPH_VERSION=v25.0"],
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    steps: [
      "Add the Instagram API product and configure Business Login for Instagram.",
      "Add the callback below to the Instagram business login OAuth redirect URLs.",
      "Instagram requires an HTTPS redirect. For local testing, set APP_URL to an HTTPS tunnel and open the app through that same origin.",
      "Add your Instagram professional account as a tester and accept the invitation during development.",
      "The Instagram account does not need to be linked to a Facebook Page.",
      "Request Advanced Access before allowing accounts outside your app roles and testers.",
    ],
  },
  {
    id: "x",
    name: "X",
    icon: SiX,
    portal: "https://console.x.com/",
    env: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    steps: [
      "Create an X developer project and app.",
      "Enable OAuth 2.0 and select Web App / confidential client.",
      "Set the callback below exactly and set the website URL to your APP_URL.",
      "Fund API credits before attempting publishing; authentication itself can still be tested first.",
    ],
  },
  {
    id: "threads",
    name: "Threads",
    icon: SiThreads,
    portal: "https://developers.facebook.com/apps/",
    env: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET"],
    scopes: ["threads_basic", "threads_content_publish"],
    steps: [
      "Add the Threads API product to a Meta app.",
      "Add the callback below to Threads API redirect URLs.",
      "Add your profile as a Threads tester and accept the tester invitation.",
      "Move the app through review before connecting people outside app roles.",
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: FaLinkedinIn,
    portal: "https://www.linkedin.com/developers/apps",
    env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    scopes: ["openid", "profile", "w_member_social", "rw_organization_admin", "w_organization_social"],
    steps: [
      "Create an app associated with your LinkedIn Page.",
      "Request Community Management API access and wait for LinkedIn approval.",
      "Add the callback below to Authorized redirect URLs.",
      "Connect with a Page administrator and choose the exact company Page destination before publishing.",
      "The default connection requests company Page access; personal posting remains available only as an explicitly selected destination.",
    ],
  },
] as const;

export default async function IntegrationSetupPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <main className="setup-page">
      <div className="setup-wrap">
        <header className="setup-nav"><Link href="/"><ProReachLogo light size={39} /></Link><span>Secure integration setup</span></header>
        <Link className="setup-back" href="/dashboard?view=connections"><ArrowLeft size={15} /> Back to connections</Link>
        <span className="eyebrow">INTEGRATION SETUP</span>
        <h1>Five independent providers.<br /><em>Exact callbacks.</em></h1>
        <p className="setup-lead">Create each developer app, copy its credentials into <code>.env.local</code>, register the exact callback, and restart the server. Secrets never enter the browser.</p>
        <div className="setup-security"><ShieldCheck size={18} /><div><strong>Protected configuration</strong><p>This page requires your authenticated ProReach session. Keep provider secrets server-side, use the encrypted token store, and register each callback exactly.</p></div></div>
        <div className="setup-grid">
          {providers.map((provider) => {
            const Icon = provider.icon;
            return (
            <section className="setup-card" id={provider.id} key={provider.id}>
              <header><div className="setup-provider-title"><i><Icon size={20} /></i><span><small>PROVIDER</small><h2>{provider.name}</h2></span></div><a href={provider.portal} target="_blank" rel="noreferrer">Developer portal <ExternalLink size={13} /></a></header>
              <div className="setup-field"><label>OAuth callback</label><code>{appUrl}/api/oauth/{provider.id}/callback</code></div>
              <div className="setup-field"><label>Environment</label>{provider.env.map((value) => <code key={value}>{value}</code>)}</div>
              <div className="setup-field"><label>Requested scopes</label><div className="scope-list">{provider.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div></div>
              <ol>{provider.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <Link className="setup-connect" href="/dashboard?view=connections"><KeyRound size={14} /> Test from a selected project</Link>
            </section>
          )})}
        </div>
      </div>
    </main>
  );
}
