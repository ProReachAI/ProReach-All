# ProReach clean-slate social account rollout

## Objective

Create an owned, secure presence for ProReach across the platforms that matter to an approval-first AI marketing platform, including platforms the founder has not used before. Meta setup is deferred until its account-creation problem is resolved. Creating every account does **not** mean publishing everywhere immediately.

Use two states:

- **Reserve:** secure the name, complete the profile, enable recovery and 2FA, and leave the account ready.
- **Activate:** publish native content, participate manually, and review channel-level acquisition metrics.

## Identity and security foundation

Complete this once before creating platform accounts:

1. Use one ProReach-controlled owner email for account ownership. Prefer a dedicated address such as `social@proreach.in`, if configured, with a separate recovery address.
2. Use a company-controlled phone number that will remain available for OTP and recovery.
3. Store every unique password, passkey, recovery code, owner, and recovery method in a password manager. Never store these in this repository.
4. Enable 2FA immediately after each account is verified. Prefer a passkey or authenticator app over SMS when available.
5. Add a second trusted administrator through the platform's role/permission system when supported. Do not share passwords.
6. Prepare one profile kit: the ProReach square logo, horizontal banner, workspace screenshot, founder photo, 80/160/300-character bios, `https://proreach.in`, one-line tagline, company category, founding year, location, and support email.

## Brand boundary

- **ProReach** is the product, platform, and central public brand.
- **Prophrase** is a customer/project managed inside ProReach.
- ProReach central accounts publish about ProReach: approval-first AI marketing, product context, campaign creation, review, scheduling, and publishing.
- Customer projects connect and use their own social accounts inside ProReach. Never connect a customer's social identity as the central ProReach identity.
- Mention a customer on ProReach channels only as an approved case study or testimonial.

## Naming standard

- Display name: **ProReach**
- Preferred handle to attempt: **@ProReachHQ**
- Fallback 1: **@GetProReach**
- Fallback 2: **@UseProReach**
- Use the same available handle across platforms; do not add random numbers.
- Record every final profile URL in the account ledger.

`@ProReach` is already owned by an unrelated X user, so it must not be used as the cross-platform standard.

## Rollout order

### Phase 1 — ownership and priority channels

Create no more than two or three accounts per day. Verify, secure, and finish each profile before starting the next batch.

| Order | Platform | Correct account type | Initial state | Purpose and prerequisite |
|---:|---|---|---|---|
| 1 | X | Brand account | Activate | First non-Meta account. Create the normal account first; apply for developer access only after it is stable. ProReach already supports X OAuth publishing. |
| 2 | LinkedIn | Real founder profile, then Company Page | Activate | Never create a personal profile named after the company. A new personal profile must be at least one day old and have more than one connection before it can create a Page. ProReach supports LinkedIn OAuth. |
| 3 | YouTube | Brand Account/channel managed by the owner Google account | Activate | Publish ProReach demos, campaign teardowns, and approval-workflow walkthroughs. A Brand Account allows multiple managers and a public identity different from the owner. |
| 4 | TikTok | Business Account | Activate | Use short founder-marketing lessons and ProReach workflow demonstrations. A Business Account supports business tools and a website link but uses the commercial music library. |
| 5 | Pinterest | New Business Account | Reserve, then test | Repurpose campaign checklists, content systems, carousels, and marketing workflow diagrams. A fresh email not already attached to Pinterest is required. |
| 6 | Reddit | Founder-operated account | Reserve, then participate | The username cannot be changed. Build a real participation history; do not use it for repetitive promotion or automated comments. |
| 7 | Bluesky | Brand account | Reserve | Claim the name and share compact founder-marketing and product-building insights if an audience emerges. Email verification is required. |

### Phase 2 — launch, editorial, and community surfaces

| Platform | Correct identity | Initial state | Role |
|---|---|---|---|
| Product Hunt | Real founder personal account | Create now; activate before launch | Company accounts cannot post, vote, or comment. Keep the personal account active and older than one week before launching ProReach. |
| Medium | ProReach brand profile first; paid publication only if justified | Reserve | Publish search-friendly product-marketing and campaign-operation guides. A publication needs an active Medium membership; a free profile can publish without one. |
| Quora | Real founder profile, then a ProReach Space | Reserve | Answer high-intent questions about social marketing, campaign creation, and approval workflows manually. |
| Discord | Owner account, then ProReach Community server | Delay until demand | Open only when there are enough active users to justify moderation and support coverage. |
| Telegram | Owner account, then public ProReach channel | Reserve | Announcements, release notes, launch updates, and customer education. |
| WhatsApp Business | Company-controlled business number | Reserve | High-intent support or onboarding; do not use for unsolicited bulk outreach. |
| Snapchat | Public/Business profile | Reserve | Test only if short-form TikTok content performs and can be adapted natively. |
| Mastodon | Brand account on a stable server | Reserve | Name protection and lightweight syndication; confirm server rules before posting. |

### Phase 3 — deferred Meta family

Return to these only after the Meta account issue is understood:

1. Instagram Professional account (Business or Creator).
2. Facebook Page owned through the proper Meta business structure.
3. Threads profile and Threads developer/API setup.
4. Meta app review and publishing permissions for ProReach.

Do not create duplicate personal Facebook identities to work around the account-creation problem.

## Activation tiers for the first 30 days

- **Tier A — publish actively:** LinkedIn, X, YouTube, TikTok.
- **Tier B — reserve and run one controlled test:** Pinterest, Reddit, Medium, Bluesky.
- **Tier C — reserve only:** Product Hunt, Quora, Telegram, WhatsApp Business, Snapchat, Mastodon.
- **Community later:** Discord, after there is a repeatable reason for users to return.
- **Deferred:** Facebook, Instagram, and Threads.

The Tier A content system should reuse one idea while changing the native format: founder/use-case story for LinkedIn, concise insight and conversation for X, vertical demo for TikTok and YouTube Shorts, and an optional longer YouTube walkthrough.

## Per-account completion checklist

- [ ] Final handle and profile URL recorded
- [ ] Ownership email verified
- [ ] Recovery phone/email verified
- [ ] Unique password stored in password manager
- [ ] Passkey or 2FA enabled and recovery codes stored
- [ ] Correct brand/account type selected
- [ ] Logo, banner, bio, website, category, and location completed
- [ ] Website link uses the platform-specific UTM source
- [ ] Second admin added when roles are supported
- [ ] Privacy, mentions, DMs, and notification settings reviewed
- [ ] First three native posts prepared before activation
- [ ] ProReach connection completed only when that platform is supported

## Account ledger fields

Maintain the ledger in a secure workspace, not in source control:

`platform`, `display name`, `handle`, `profile URL`, `account type`, `owner`, `admin email`, `recovery method`, `2FA status`, `second admin`, `created date`, `verification status`, `ProReach connection status`, `publishing tier`, `notes`.

Do not put passwords, OTPs, access tokens, client secrets, or recovery codes in the ledger.

## Immediate next action: X

1. Open X signup and choose company email or the company-controlled Google account.
2. Use the founder's truthful date of birth where the platform asks for an account-holder age; it is not the company's founding date.
3. Verify the email or phone OTP.
4. Choose `ProReachHQ` if offered; otherwise use the fallback order above.
5. Add the profile kit and website.
6. Enable 2FA and store recovery codes.
7. Publish one introduction, one useful founder-marketing lesson, and one ProReach workflow demonstration before connecting the account to ProReach.
8. Create the X developer project/app only after the normal X account is healthy.
