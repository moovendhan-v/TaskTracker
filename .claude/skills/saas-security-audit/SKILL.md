---
name: saas-security-audit
description: Audit and fix a web/SaaS app against a 19-point security checklist (RLS, auth on every API route, server-side validation, rate limiting, input sanitization, parameterized queries, CORS, HTTPS, IDOR, debug mode, CAPTCHA, admin audit logs, private storage, admin page protection, vulnerable packages, upload type checks, security review, security headers, webhook signatures), plus the OWASP Top 10 (2025), OWASP API Security Top 10 and OWASP LLM Top 10. Use when the user asks to secure, harden, audit, or "make production-ready" an app, especially a vibe-coded / AI-generated SaaS (Next.js, Supabase, Firebase, Express, Django, Rails, etc.), or mentions OWASP or any item on the list.
---

# SaaS Security Audit (19 holes + OWASP)

Work through the app check by check, find real problems in the code, fix them, and report progress as `NN/19 FIXED`. Then run the OWASP pass to catch what the 19 checks don't cover.

## Workflow

1. **Map the app first.** Identify: framework(s), backend/API location, database + ORM, auth provider, storage provider, payment/webhook integrations, deploy target, and where env/config lives. List every API route / server action / edge function — you need this list for checks 2, 4, 9.
2. **Run each of the 19 checks below in order.** For each: search the code, decide `PASS` / `FIXED` / `NEEDS USER` / `N/A`, and fix what you can with minimal, idiomatic changes matching the codebase.
3. **Run the OWASP pass.** Read [references/owasp.md](references/owasp.md) and go through the Web Top 10 (always), the API Top 10 (if the app has an API), and the LLM Top 10 (only if it uses AI). Items tagged `→ #N` were already covered by the checklist; only check what they add (e.g. SSRF, password hashing, sessions/MFA, mass assignment, fail-closed error handling, logging/alerting, CI supply chain).
4. **Don't break the app.** Run the build/tests after fixes. For changes that alter behavior (CORS origins, rate limits, RLS policies, migrations), show the change and confirm before applying if it touches production data or config.
5. **Never commit secrets** and never print secret values in the report — reference them by name.
6. **Report** using the template at the bottom.

## The 19 checks

### 1. Row Level Security
- Supabase/Postgres: every table in an exposed schema has `ENABLE ROW LEVEL SECURITY` and policies scoped to `auth.uid()` / tenant id. Check migrations and `supabase/` folder. A table with RLS enabled but a `USING (true)` policy is still open.
- Firebase: Firestore/Storage rules are not `allow read, write: if true` and check `request.auth.uid`.
- Other DBs: every query is scoped by the owner/tenant id server-side.
- `service_role` / admin keys are used only on the server, never shipped to the client.

### 2. Auth on every API route
- Every route handler, server action, edge function, and RPC verifies the session/token **on the server** before doing work. Prefer central middleware plus a per-handler check.
- Flag any route that reads/writes data without an auth check, unless it's intentionally public (document why).

### 3. Never trust the frontend
- Prices, roles, user ids, plan limits, `isAdmin`, quotas, and ownership come from the server/session/DB — never from the request body or client state.
- Re-validate every input server-side (zod / pydantic / Joi / etc.), even if the client validates.

### 4. Rate limiting
- Apply limits to auth (login, signup, password reset, OTP), AI/LLM calls, email/SMS sends, and any expensive or paid endpoint. Use the platform's limiter (e.g. Upstash Ratelimit, express-rate-limit, Cloudflare, django-ratelimit), keyed by user id and IP.

### 5. Sanitize user input
- No `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `|safe`, or markdown rendering of user content without a sanitizer (DOMPurify, bleach).
- Validate type, length, and format; escape output by default.

### 6. Parameterized queries
- No string-concatenated or template-literal SQL with user input (`` `SELECT ... ${x}` ``, f-strings, `.raw()`, `$queryRawUnsafe`). Use bound parameters or the ORM.
- Also check NoSQL injection (Mongo operators from raw JSON bodies) and shell commands built from input.

### 7. Lock down CORS
- No `Access-Control-Allow-Origin: *` combined with credentials, and no reflecting arbitrary `Origin`. Allowlist the real frontend origin(s) from env.

### 8. HTTPS everywhere
- Redirect HTTP→HTTPS, set HSTS, cookies `Secure; HttpOnly; SameSite=Lax|Strict`. No `http://` API URLs in config for production.

### 9. Stop IDOR bugs
- Any route taking an id (`/api/invoices/:id`, `?userId=`) must verify the resource belongs to the current user/tenant. Fetch by `id AND owner_id`, not `id` alone. Prefer UUIDs over sequential ids, but ownership checks are the actual fix.

### 10. Debug mode off in prod
- `DEBUG=False`, `NODE_ENV=production`, no stack traces or verbose errors returned to clients, no source maps exposed publicly unless intended, no debug/test endpoints or seeded admin accounts in prod. Generic error messages to clients; details to logs.

### 11. CAPTCHA on public forms
- Signup, login (after failures), contact, waitlist, password reset, and any unauthenticated form that sends email or creates records: add Turnstile / hCaptcha / reCAPTCHA and **verify the token server-side**.

### 12. Log admin actions
- Admin/privileged actions (role changes, refunds, deletes, impersonation, config changes) write an append-only audit log: who, what, target, when, IP. Regular users cannot modify the log.

### 13. Private storage buckets
- User uploads live in private buckets; access via short-lived signed URLs after an ownership check. Flag public buckets holding anything user-specific (invoices, IDs, avatars are a judgment call).

### 14. Hide admin pages properly
- Admin UI hidden in the frontend is not protection. Every admin route and admin API checks the role **server-side** (middleware + handler). Role comes from DB/JWT claims set by the server, not editable user metadata.

### 15. Update vulnerable packages
- Run the audit tool for the stack (`npm audit` / `pnpm audit` / `pip-audit` / `bundle audit` / `cargo audit`). Fix high/critical issues; note breaking upgrades instead of forcing them blindly. Check that the lockfile is committed.

### 16. Check file upload types
- Validate type by content (magic bytes), not just extension or client MIME. Enforce size limits, allowlist extensions, rename files, never serve uploads from the app origin as executable/HTML, and block SVG/HTML unless sanitized.

### 17. Claude security review
- Run the built-in `/security-review` skill (via the Skill tool, `security-review`) on the pending changes, or do an equivalent focused pass for anything the checklist missed: secrets in code/git history, SSRF, open redirects, insecure JWT handling, mass assignment, CSRF on cookie-auth forms.

### 18. Security headers
- Set: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Put them in framework config (e.g. `next.config` headers, helmet, middleware) rather than per page.

### 19. Verify webhook signatures
- Stripe, Clerk, GitHub, Lemon Squeezy, Razorpay, etc.: verify the signature against the **raw** request body with the secret from env, reject on failure, check timestamp tolerance, and make handlers idempotent (dedupe by event id).

## Report template

```
SaaS security audit — NN/19 FIXED

| # | Check | Status | Where | What changed / what's needed |
|---|-------|--------|-------|------------------------------|
| 1 | Row level security | FIXED | supabase/migrations/... | Enabled RLS + owner policies on 4 tables |
...

OWASP coverage

| ID | Risk | Status | Notes |
|----|------|--------|-------|
| A01 | Broken Access Control | FIXED | Added SSRF allowlist to /api/preview |
...  (Web A01–A10, then API1–API10 if applicable, then LLM01–LLM10 if applicable)

Needs your action:
- <things requiring secrets, dashboard settings, or product decisions>

Not verified:
- <anything you couldn't test, e.g. production headers, live bucket settings>
```

Count `PASS`, `FIXED`, and `N/A` toward the NN/19 score; `NEEDS USER` does not count until resolved. Be honest about what was checked statically versus actually tested.
