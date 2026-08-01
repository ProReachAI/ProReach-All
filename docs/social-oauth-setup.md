# Project-scoped social OAuth setup

ProReach uses two different kinds of identity:

- Supabase/Google identifies the ProReach user.
- Facebook, Instagram, Threads, X, and LinkedIn OAuth grants permission to publish for one selected ProReach project.

ProReach is the platform and central brand. Names such as **Prophrase** below are examples of customer projects managed inside ProReach; they are not alternate names for ProReach and must use their own social accounts.

Provider application credentials are configured once by the ProReach administrator in Vercel. End users never receive those secrets and never paste tokens. Each OAuth result is encrypted and saved with both the signed-in user's workspace ID and the selected project ID.

## Supported ownership model

```text
Google user
└── private workspace
    ├── Project: Prophrase
    │   ├── Prophrase Facebook Pages
    │   ├── Prophrase Instagram profile
    │   └── Prophrase campaigns and posts
    └── Project: Project 2
        ├── different social OAuth grants
        ├── different Pages/profiles
        └── different campaigns and posts
```

A second Google user receives a separate workspace. Switching the active project reloads that project's campaigns, connections, destination selector, and publishing state. The same provider account may be authorized in more than one project, but the stored grants remain separate project records.

## Production callbacks

Register these exact HTTPS callbacks. They are not the Supabase/Google callback.

```text
https://www.proreach.in/api/oauth/meta/callback
https://www.proreach.in/api/oauth/instagram/callback
https://www.proreach.in/api/oauth/threads/callback
https://www.proreach.in/api/oauth/x/callback
https://www.proreach.in/api/oauth/linkedin/callback
```

## Core server variables

```dotenv
APP_URL=https://www.proreach.in
TOKEN_ENCRYPTION_KEY=<32-byte base64 value>
DATABASE_URL=<Supabase transaction pooler URL with percent-encoded password>
```

Generate the encryption key once:

```bash
openssl rand -base64 32
```

Never rotate `TOKEN_ENCRYPTION_KEY` by simply replacing it: existing provider tokens were encrypted with the old key and would become unreadable. A future rotation must decrypt with the old key and re-encrypt with the new key.

For Vercel, copy the Supabase **Transaction pooler** string on port `6543`. Percent-encode special characters in the database password; for example, `@` becomes `%40`, `$` becomes `%24`, and `=` becomes `%3D`. Supabase documents transaction mode for temporary/serverless connections: <https://supabase.com/docs/guides/database/connecting-to-postgres>.

## Facebook Pages

1. Open <https://developers.facebook.com/apps/> and create or select the Meta business app.
2. Add the Facebook Login for Business use case/product.
3. In **App settings → Basic**, copy the **App ID** and reveal/copy the **App secret**.
4. Set:

   ```dotenv
   META_APP_ID=<App ID>
   META_APP_SECRET=<App secret>
   META_GRAPH_VERSION=v25.0
   ```

5. Add `https://www.proreach.in/api/oauth/meta/callback` to **Valid OAuth Redirect URIs**.
6. The app requests `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.
7. In development mode, only app administrators, developers, and testers can authorize. Before public customers connect Pages, complete the applicable business verification, App Review, and Advanced Access requirements.

After authorization, ProReach discovers manageable Pages and asks the user which Pages should be enabled for the selected project.

## Instagram professional accounts

1. In the Meta developer app, add **Instagram API with Instagram Login** (the dashboard may label this **Business Login for Instagram**).
2. Open its API setup and copy the displayed Instagram **App ID** and **App secret**.
3. Set:

   ```dotenv
   INSTAGRAM_APP_ID=<Instagram App ID>
   INSTAGRAM_APP_SECRET=<Instagram App secret>
   ```

4. Add `https://www.proreach.in/api/oauth/instagram/callback` to the Instagram OAuth redirect list.
5. Add/accept the required Instagram tester during development.
6. The connected Instagram account must be Professional (Business or Creator), not a consumer/personal account.
7. The app requests `instagram_business_basic` and `instagram_business_content_publish`.

This is the direct Instagram Login flow and does not require the account to be linked to a Facebook Page. Meta's official Instagram API workspace documents these scopes and the professional-account requirement: <https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login>.

## Threads

1. Add the **Threads API** use case/product to a Meta developer app.
2. In the Threads API settings, copy its client/app ID and client/app secret.
3. Set:

   ```dotenv
   THREADS_CLIENT_ID=<Threads App ID>
   THREADS_CLIENT_SECRET=<Threads App secret>
   ```

4. Register `https://www.proreach.in/api/oauth/threads/callback` in the Threads redirect URL list.
5. Add the Threads profile as a tester and accept the invitation while the app is in development.
6. The app requests `threads_basic` and `threads_content_publish`. Complete Meta review before allowing people outside app roles/testers.

Meta maintains the official Threads API collection here: <https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api>.

## X

1. Open <https://console.x.com/> and create/select the developer project and app.
2. In user authentication settings, enable **OAuth 2.0**.
3. Choose **Web App** (a confidential client) and enable read/write capability.
4. Set website URL to `https://www.proreach.in`.
5. Set the exact callback to `https://www.proreach.in/api/oauth/x/callback`.
6. In **Keys and tokens**, copy the OAuth 2.0 **Client ID** and generate/copy its **Client Secret**.
7. Set:

   ```dotenv
   X_CLIENT_ID=<OAuth 2.0 Client ID>
   X_CLIENT_SECRET=<OAuth 2.0 Client Secret>
   ```

ProReach uses Authorization Code + PKCE and requests `tweet.read`, `tweet.write`, `users.read`, and `offline.access`. X requires exact callback matching and identifies Web Apps as confidential clients: <https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code>.

## LinkedIn

1. Open <https://www.linkedin.com/developers/apps> and create an app associated with the ProReach LinkedIn Page/legal organization.
2. Open the app's **Auth** tab. Copy **Client ID** and **Primary Client Secret**.
3. Add `https://www.proreach.in/api/oauth/linkedin/callback` under **Authorized redirect URLs for your app**.
4. Set:

   ```dotenv
   LINKEDIN_CLIENT_ID=<Client ID>
   LINKEDIN_CLIENT_SECRET=<Primary Client Secret>
   LINKEDIN_API_VERSION=202606
   LINKEDIN_ORGANIZATION_ACCESS=false
   ```

5. Add/request the **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** products for personal profile identity/posting.
6. Keep `LINKEDIN_ORGANIZATION_ACCESS=false` until LinkedIn has approved **Community Management API** access. This makes ProReach request only `openid`, `profile`, and `w_member_social`, which support personal-profile publishing without restricted organization scopes.
7. After LinkedIn approves Community Management API access, set `LINKEDIN_ORGANIZATION_ACCESS=true` and redeploy. Page publishing then requests `rw_organization_admin` and `w_organization_social` and discovers Pages administered by the connected member.

LinkedIn documents credentials and HTTPS redirect URLs in its 3-legged OAuth guide: <https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow>. Community Management access is applied for under the app's Products tab: <https://learn.microsoft.com/en-us/linkedin/marketing/quick-start>.

## Vercel import and deployment

In Vercel open **Project → Settings → Environment Variables** and use the paste/import `.env` option. Apply secrets to Production and, only if needed, Preview/Development. Do not add spaces around `=` and do not wrap values in explanatory angle brackets.

After importing, redeploy Production because an existing deployment does not receive newly added environment values. Vercel's environment-variable documentation is at <https://vercel.com/docs/environment-variables>.

## User workflow after the one-time setup

1. Sign in to ProReach with Google.
2. Create or select a project.
3. Open **Connections**.
4. Click **Connect with …** and authorize on the provider's domain.
5. When multiple Pages/profiles are returned, choose which ones belong to that project.
6. Switch projects; the Connections page and publishing destination list change automatically.

No provider access token, refresh token, App Secret, or encryption key should ever be entered by an end user.
