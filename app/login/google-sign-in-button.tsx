"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  configured: boolean;
};

export function GoogleSignInButton({ configured }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A failed OAuth page can be restored from the browser's back-forward
    // cache. Reset the loading state when this page is shown again.
    const resetLoadingState = () => setBusy(false);

    window.addEventListener("pageshow", resetLoadingState);
    return () => window.removeEventListener("pageshow", resetLoadingState);
  }, []);

  async function signIn() {
    if (!configured) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin).toString();
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
          skipBrowserRedirect: true,
        },
      });
      if (authError) throw authError;
      if (!data.url) throw new Error("Google sign-in did not return an authorization URL.");
      window.location.assign(data.url);
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
    }
  }

  return (
    <>
      <button
        className="google-sign-in"
        type="button"
        onClick={signIn}
        disabled={!configured || busy}
        aria-busy={busy}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.78h-9.18v3.34h5.39a4.77 4.77 0 0 1-2 3.08l-.02.11 2.9 2.25.2.02c1.85-1.71 2.91-4.22 2.91-7.02Z" />
          <path fill="#34A853" d="M12.22 21.78c2.64 0 4.85-.87 6.47-2.53l-3.08-2.38c-.82.55-1.94.94-3.39.94a5.88 5.88 0 0 1-5.56-4.07l-.11.01-3.02 2.34-.04.1a9.77 9.77 0 0 0 8.73 5.59Z" />
          <path fill="#FBBC05" d="M6.66 13.74a6.03 6.03 0 0 1-.32-1.92c0-.67.12-1.31.31-1.92v-.12L3.6 7.41l-.1.05a9.8 9.8 0 0 0 0 8.73l3.16-2.45Z" />
          <path fill="#EA4335" d="M12.22 5.84c1.84 0 3.08.8 3.79 1.45l2.74-2.68c-1.68-1.56-3.89-2.52-6.53-2.52a9.77 9.77 0 0 0-8.73 5.37L6.65 9.9a5.9 5.9 0 0 1 5.57-4.06Z" />
        </svg>
        <span>{busy ? "Opening Google…" : "Continue with Google"}</span>
        {busy && <LoaderCircle className="auth-button-spinner" size={17} aria-hidden="true" />}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );
}
