import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleSignInButton } from "@/app/login/google-sign-in-button";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "Sign in — ProReach",
  description: "Sign in to your ProReach marketing workspace.",
};

const errorMessages: Record<string, string> = {
  oauth_callback: "Google sign-in could not be completed. Check the redirect URLs and try again.",
  oauth_denied: "Google sign-in was cancelled or denied.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const configured = isSupabaseConfigured();

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <header className="auth-header">
          <a className="auth-brand" href="https://proreach.in" aria-label="ProReach home">
            <span className="auth-logo-wrap">
              <Image src="/logo.png" alt="" width={42} height={42} priority />
            </span>
            <span><strong>ProReach</strong><small>Marketing agent</small></span>
          </a>
          <a className="auth-home-link" href="https://proreach.in">
            proreach.in <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </header>

        <div className="auth-form-wrap">
          <div className="auth-copy">
            <span className="auth-kicker"><Sparkles size={13} aria-hidden="true" /> Approval-first marketing</span>
            <h1 id="sign-in-title">Welcome back to your growth workspace.</h1>
            <p>Plan focused campaigns, shape every message and stay in control of what reaches your audience.</p>
          </div>

          <div className="auth-form-card">
            <GoogleSignInButton configured={configured} />
            {errorCode && <p className="auth-error" role="alert">{errorMessages[errorCode] ?? "Sign-in failed. Please try again."}</p>}
            {!configured && (
              <p className="auth-config-warning" role="status">
                Supabase Auth is not configured yet. Add the public Supabase URL and publishable key, then redeploy.
              </p>
            )}
            <div className="auth-security-note">
              <ShieldCheck size={17} aria-hidden="true" />
              <p><strong>Secure Google sign-in</strong><span>Authentication is handled by Google and Supabase. ProReach never receives your Google password.</span></p>
            </div>
          </div>

          <p className="auth-legal">
            By continuing, you agree to the ProReach <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </section>

      <aside className="auth-showcase" aria-label="ProReach product preview">
        <div className="auth-ambient auth-ambient-one" />
        <div className="auth-ambient auth-ambient-two" />

        <div className="auth-showcase-copy">
          <span>FROM PRODUCT CONTEXT TO CONSISTENT REACH</span>
          <h2>One campaign.<br />Every channel.<br /><em>Your final say.</em></h2>
        </div>

        <div className="auth-product-stage" aria-hidden="true">
          <div className="auth-dashboard-shell">
            <div className="auth-dashboard-sidebar">
              <div className="auth-mini-brand"><span /><b>PR</b></div>
              <i className="is-active" /><i /><i /><i /><i />
            </div>
            <div className="auth-dashboard-main">
              <div className="auth-dashboard-topbar">
                <span>Northstar Analytics</span>
                <b><Sparkles size={11} /> Generate campaign</b>
              </div>
              <div className="auth-dashboard-content">
                <div className="auth-dashboard-heading">
                  <div><small>7-DAY CAMPAIGN</small><strong>Turn trial users into active teams</strong></div>
                  <span>Approval mode</span>
                </div>
                <div className="auth-metric-row">
                  <article><small>DRAFTS</small><strong>8</strong><span>Across 5 channels</span></article>
                  <article><small>IN REVIEW</small><strong>3</strong><span>Waiting for you</span></article>
                  <article><small>SCHEDULED</small><strong>5</strong><span>This week</span></article>
                </div>
                <div className="auth-dashboard-grid">
                  <article className="auth-post-preview">
                    <header><span>in</span><div><b>LinkedIn</b><small>Tuesday · 10:30 AM</small></div><em>Needs review</em></header>
                    <h3>Your team doesn&apos;t need another dashboard.</h3>
                    <p>It needs one version of the truth. Here&apos;s how collaborative reporting changes the weekly rhythm…</p>
                    <footer><span>Edit draft</span><b><Check size={11} /> Approve</b></footer>
                  </article>
                  <article className="auth-calendar-preview">
                    <header><CalendarDays size={13} /><b>Coming up</b><span>View calendar</span></header>
                    <div><i>WED</i><p><b>Product workflow carousel</b><small>Instagram · 12:00 PM</small></p><em /></div>
                    <div><i>THU</i><p><b>Founder insight thread</b><small>X · 5:30 PM</small></p><em /></div>
                    <div><i>FRI</i><p><b>Feature launch story</b><small>LinkedIn · 10:00 AM</small></p><em /></div>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-floating-card auth-floating-approval">
            <span><ShieldCheck size={14} /></span>
            <p><small>APPROVAL REQUIRED</small><strong>Nothing publishes without you</strong></p>
          </div>
          <div className="auth-floating-card auth-floating-ready">
            <span><Check size={13} /></span>
            <p><small>CAMPAIGN READY</small><strong>12 platform-native drafts</strong></p>
          </div>
        </div>

        <p className="auth-showcase-footnote"><span><Check size={12} /> Product-aware</span><span><Check size={12} /> Platform-native</span><span><Check size={12} /> Human-approved</span></p>
      </aside>
    </main>
  );
}
