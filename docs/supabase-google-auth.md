# Supabase, Google Auth, and Vercel setup

ProReach uses Supabase Auth for Google sign-in and connects to the same Supabase project's PostgreSQL database through `DATABASE_URL`.

There are two different callback URLs in this flow:

1. Google redirects to Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase redirects to ProReach: `https://proreach.in/auth/callback`

Do not enter the ProReach callback URL in Google's **Authorized redirect URIs** field.

## 1. Connect the Supabase database

1. Open the Supabase project.
2. Select **Connect** and copy the **Transaction pooler** connection string. Transaction mode is appropriate for Vercel's temporary serverless connections.
3. Replace the password placeholder with the database password. Percent-encode reserved URL characters in the password, or copy the completed string from Supabase.
4. Add `?sslmode=require` if it is not already present.
5. Save the full value as `DATABASE_URL` in Vercel. Never use a `NEXT_PUBLIC_` prefix for this value.
6. In Supabase **SQL Editor**, create a new query, paste the contents of `db/schema.sql`, and run it once. The script is repeat-safe and creates the `default` workspace required by the current single-workspace application.

Typical pooler shape (always use the exact host and username shown by your project):

```text
postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

The direct database connection is best for migrations when your network supports IPv6. The transaction pooler on port `6543` is the application connection for Vercel.

## 2. Copy the Supabase Auth client values

From the Supabase project's **Connect** dialog or **Project Settings → API Keys**, copy:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is designed for browser use. Do not add a service-role or secret key to a `NEXT_PUBLIC_` variable; ProReach does not require a Supabase service-role key for this auth flow.

## 3. Configure Supabase redirect URLs

Open **Authentication → URL Configuration**:

- **Site URL:** `https://proreach.in`
- **Redirect URLs:**
  - `https://proreach.in/auth/callback`
  - `http://localhost:3000/auth/callback`

For Vercel previews, either add each stable preview callback explicitly or add the Supabase-documented team wildcard:

```text
https://*-<your-vercel-team-or-account-slug>.vercel.app/**
```

Use exact production URLs instead of a wildcard for `proreach.in`.

## 4. Create the Google OAuth client

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and select or create a Google Cloud project.
2. Complete **Branding** with the app name `ProReach`, support email, homepage `https://proreach.in`, privacy-policy URL, terms URL, and authorized domain `proreach.in` as applicable.
3. In **Audience**, select Internal only if every user belongs to the same Google Workspace organization. Otherwise select External. While the app is in testing, add the Google accounts that must be able to sign in as test users.
4. Open **Clients → Create client**.
5. Choose **Web application** and name it `ProReach Web`.
6. Add these **Authorized JavaScript origins**:
   - `https://proreach.in`
   - `http://localhost:3000` for local development
7. In Supabase, open **Authentication → Providers → Google** and copy the callback URL shown there. It has this form:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

8. Add that Supabase URL as the Google client's **Authorized redirect URI**.
9. Create the client and copy its Client ID and Client Secret.

## 5. Enable Google inside Supabase

1. Open **Authentication → Providers → Google**.
2. Enable the provider.
3. Paste the Google Client ID and Client Secret.
4. Save.

Google's Client Secret belongs in Supabase, not in Vercel. The app only needs the Supabase URL and publishable key.

If the Google consent screen remains in Testing mode, only configured test users can sign in. Publish the OAuth app when the branding and verification requirements for your audience are ready.

## 6. Configure Vercel environment variables

Open the Vercel project, then **Settings → Environment Variables**. Add these to Production; add them to Preview and Development too if those deployments should work:

```text
APP_URL=https://proreach.in
NEXT_PUBLIC_SITE_URL=https://proreach.in
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL=<Supabase transaction pooler connection string>
TOKEN_ENCRYPTION_KEY=<32-byte base64 secret>
CRON_SECRET=<long random secret>
```

Keep the existing Cloudflare, R2, and social-provider variables required by the rest of ProReach. `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, OAuth client secrets, and storage secrets must remain server-only.

After adding or changing Vercel variables, trigger a new production deployment; previous deployments do not receive updated values.

## 7. Verify the complete flow

1. Open a private/incognito window at `https://proreach.in`.
2. Confirm that the Google sign-in page appears instead of the dashboard.
3. Select an allowed Google account.
4. Confirm that the browser visits `/auth/callback` briefly and then loads `/`.
5. Confirm that the existing project onboarding appears only after sign-in.
6. Use **Sign out** in the lower-left profile area and confirm that `/login` returns.
7. In Supabase, open **Authentication → Users** and confirm that the Google user exists.
8. In Vercel, inspect the deployment logs if the callback fails. The most common causes are a mismatched Google-to-Supabase redirect URI or a missing Supabase-to-ProReach redirect allow-list entry.

## Current access model

Authentication now protects the dashboard and application APIs, but product data still belongs to the schema's single `default` workspace. Until user-to-workspace membership is implemented, every Google account permitted by the Supabase Google provider reaches that same workspace. For a private rollout, keep the Google OAuth app in testing with an explicit test-user list or use an Internal Google Workspace audience.
