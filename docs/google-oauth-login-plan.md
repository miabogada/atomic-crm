# Plan: Enable Google OAuth Login on Atomic CRM

## Context

The CRM uses email/password login. Users already use Google Workspace daily. Adding "Sign in with Google" eliminates a separate password and lets Google handle 2FA. The previous SAML SSO approach was too complex for self-hosted Supabase. Google OAuth is much simpler — no Kong changes, no private keys, no metadata XML.

## Approach

Google OAuth via Supabase's built-in external provider. `ra-supabase-core` already supports `signInWithOAuth({ provider: 'google' })` natively. The callback handler already works for OAuth. Main work: container config, a trigger migration, and a small UI change.

---

## Steps (in dependency order)

### 1. Google Cloud Console (~10 min, browser only)

- Create OAuth 2.0 Web Application credentials
- Authorized redirect URI: `https://api.tanoclark.com/auth/v1/callback`
- Authorized JavaScript origin: Cloudflare Pages domain
- Save Client ID + Client Secret

### 2. Database migration — fix user creation trigger

**Why**: Google OAuth sends `full_name` (e.g. "John Doe"), NOT separate `first_name`/`last_name`. Current trigger (`20260219000000`) inserts NULLs for both. **Must deploy before enabling OAuth.**

Create new migration to update `handle_new_user()` and `handle_update_user()` with:
1. Try `first_name`/`last_name` directly (email/password signup)
2. Try splitting `full_name` or `name` (Google OAuth)
3. Try `custom_claims` (SAML, for future-proofing)
4. Fall back to `'Pending'`

**Files**: New migration in `supabase/migrations/`
**Deploy**: `npx supabase migration up` locally, `npx supabase db push` to prod

### 3. Supabase container config (Proxmox VM, ~10 min)

On `root@crm` at `/opt/supabase/docker`:

Add to `.env`:
```
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<client-secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.tanoclark.com/auth/v1/callback
```

Verify vars reach the auth container, then restart: `docker compose restart auth`

**Verify**: `curl https://api.tanoclark.com/auth/v1/settings` should show Google enabled.

### 4. Frontend code changes (small)

**4a. `authProvider.ts`** — Add `provider` param handling + set `redirectTo`

- `src/components/atomic-crm/providers/supabase/authProvider.ts`
- Add `redirectTo` option when instantiating `supabaseAuthProvider` (line 7): `redirectTo: \`${window.location.origin}/auth-callback.html\``
- In `login()` (line 90): if `params.provider`, delegate to `baseAuthProvider.login(params)` which already calls `signInWithOAuth`

**4b. New `GoogleOAuthButton.tsx`** — Copy pattern from `SSOAuthButton.tsx`

- `src/components/atomic-crm/login/GoogleOAuthButton.tsx`
- Calls `login({ provider: 'google' })` instead of `login({ ssoDomain })`

**4c. `LoginPage.tsx`** — Swap SSO button for OAuth button

- `src/components/atomic-crm/login/LoginPage.tsx` (lines 131-135)
- Render `<GoogleOAuthButton>` when `enableGoogleOAuth` is true

**4d. `SignupPage.tsx`** — Same swap (lines 162-169)

**4e. `ConfigurationContext.tsx`** — Add `enableGoogleOAuth?: boolean`

**4f. `CRM.tsx`** — Read `VITE_ENABLE_GOOGLE_OAUTH` env var (line 138 area)

### 5. Local dev config

- `supabase/config.toml`: Add `[auth.external.google]` section with `enabled = true`, client_id/secret from env vars
- `.env.development`: Add `VITE_ENABLE_GOOGLE_OAUTH=true`

### 6. Deploy frontend

- Add `VITE_ENABLE_GOOGLE_OAUTH=true` in Cloudflare Pages env vars
- Trigger rebuild

---

## Files to modify

| File | Change |
|------|--------|
| `supabase/migrations/<new>_google_oauth_trigger.sql` | Fix trigger for Google OAuth metadata |
| `src/components/atomic-crm/providers/supabase/authProvider.ts` | Add `redirectTo`, route `provider` param |
| `src/components/atomic-crm/login/GoogleOAuthButton.tsx` | New file — Google login button |
| `src/components/atomic-crm/login/LoginPage.tsx` | Swap SSO → OAuth button |
| `src/components/atomic-crm/login/SignupPage.tsx` | Same swap |
| `src/components/atomic-crm/root/ConfigurationContext.tsx` | Add `enableGoogleOAuth` prop |
| `src/components/atomic-crm/root/CRM.tsx` | Wire `VITE_ENABLE_GOOGLE_OAUTH` env var |
| `supabase/config.toml` | Add `[auth.external.google]` for local dev |
| Container: `/opt/supabase/docker/.env` | Add Google OAuth env vars |

---

## Gotchas and negative aspects

1. **Trigger must deploy first.** If OAuth is enabled before the migration, first Google login creates user with NULL names. Deploy order: migration → container config → frontend.

2. **No domain restriction by default.** Supabase doesn't pass Google's `hd` parameter. Anyone with a Google account could log in if they know the URL. Mitigation options:
   - Add domain check in trigger (raise exception for wrong domain) — most secure
   - Check email domain in frontend post-login — less secure
   - Rely on obscurity of URL + Cloudflare Access — weakest

3. **`redirectTo` not currently set.** The `supabaseAuthProvider` is instantiated without `redirectTo`. Without fixing this, OAuth redirect may fail silently — user authenticates with Google but never returns to the app.

4. **Callback handler assumes implicit flow.** `auth-callback.html` only parses hash fragments. If GoTrue uses PKCE (newer default), tokens come as query params instead. `signInWithOAuth` uses implicit flow by default, so this should be fine, but worth verifying after setup.

5. **First-user edge case.** If someone hits the app via Google OAuth before any user exists, the trigger makes them admin. Fine for your use case but worth knowing.

6. **Google Cloud Console credentials are separate from Google Workspace Admin.** You need access to a Google Cloud project (not just Workspace admin) to create OAuth credentials.

7. **Two OAuth clients may be needed.** One for production (`api.tanoclark.com` redirect) and one for local dev (`localhost:54321` redirect). Or register both redirect URIs on the same client.

---

## Verification

1. After Step 3: `curl https://api.tanoclark.com/auth/v1/settings | jq '.external.google'` → `enabled: true`
2. After Step 4: Click "Sign in with Google" → Google consent screen → redirect back to app → logged in
3. Check user record: `SELECT first_name, last_name, email FROM public.users ORDER BY id DESC LIMIT 1;` → names populated
4. Test email/password still works as fallback
5. Test with non-domain Google account → verify behavior (blocked or allowed depending on mitigation choice)
