# OWASP checks

Three OWASP lists, each mapped to concrete things to look for in the code. Where an item overlaps the 19-point checklist, the `→ #N` tag points to it. Don't repeat that work; just confirm it and add whatever the OWASP item covers beyond it.

Run the **Web Top 10** on every app, the **API Top 10** when the app exposes an API (almost always), and the **LLM Top 10** only if the app calls an LLM or uses embeddings or agents.

---

## OWASP Top 10 (2025): web applications

### A01 Broken Access Control → #1, #2, #9, #13, #14
- Deny by default: new routes and resources need an explicit allow.
- Ownership and tenant checks on every read, update and delete, including list endpoints, exports, search and GraphQL resolvers.
- **SSRF** (now part of A01): any server-side fetch of a user-supplied URL (webhooks the user configures, URL previews, image import, PDF rendering) must allowlist schemes and hosts, block private, loopback and link-local ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254.169.254`, `::1`, `fc00::/7`), re-check the IP after DNS resolution, and not follow redirects blindly.
- Open redirects: `?next=` / `?redirect=` only accept relative paths or allowlisted hosts.
- CSRF: forms that rely on cookie auth need SameSite cookies plus a CSRF token or Origin check.
- Directory listing off. No access to `.git`, `.env` or backup files from the web root.

### A02 Security Misconfiguration → #7, #8, #10, #18
- No default credentials, sample apps or unused features enabled in production.
- Cloud and storage permissions are least-privilege. No public buckets or DB ports open to the internet.
- XML parsers have external entities disabled (XXE).
- Config is the same across environments and kept in code (IaC or framework config), not changed by hand in dashboards.

### A03 Software Supply Chain Failures → #15
- Lockfile committed, and CI installs from it (`npm ci`, `pip install --require-hashes`, etc.).
- Run dependency audits in CI. Use Dependabot or Renovate.
- Check new dependencies for typosquatting, abandoned packages and suspicious install scripts.
- Third-party scripts loaded from a CDN use SRI hashes (`integrity=`).
- CI/CD secrets are scoped, GitHub Actions are pinned to a commit SHA, and workflows on `pull_request_target` don't check out untrusted code.

### A04 Cryptographic Failures
- Passwords hashed with argon2id, bcrypt or scrypt (never MD5, SHA-1 or plain SHA-256). Or use a managed auth provider instead.
- Sensitive data (PII, tokens, API keys users give you) encrypted at rest where the platform allows. Keys live in a KMS or secrets manager, not in code.
- TLS 1.2+ only. No custom crypto. Use secure random values (`crypto.randomBytes`, `secrets`) for tokens, never `Math.random`.
- JWTs: verify the signature, pin the algorithm (reject `none` and HS/RS confusion), check `exp`, `aud` and `iss`, and keep lifetimes short.
- Don't keep sensitive data you don't need. Mask it in logs and UI.

### A05 Injection → #5, #6
- SQL, NoSQL, OS command, LDAP, template (SSTI), header/CRLF, and XSS (reflected, stored, DOM).
- Watch for `eval`, `new Function`, `child_process.exec` with interpolated strings, `subprocess(..., shell=True)`, `pickle` or `yaml.load` on untrusted data, and template rendering of user strings.
- Use context-aware output encoding and a strict CSP as defense in depth.

### A06 Insecure Design → #3, #4, #11
- Business-logic abuse: negative quantities, coupon stacking, race conditions on balances and credits (use DB transactions or row locks), skipping steps in a multi-step flow, free-trial abuse.
- Limits per account and tenant (seats, projects, storage) are enforced on the server.
- Write down the threat model for money flows, invites and sharing, and account recovery.

### A07 Authentication Failures → #2, #4, #11
- Password policy based on length plus a breached-password check. No user enumeration through login, signup or reset messages or timing.
- MFA available, and required for admins.
- Sessions: rotate the session id on login, invalidate it on logout and password change, use idle and absolute timeouts, and keep tokens out of `localStorage` where possible.
- Password-reset and magic-link tokens: single use, short expiry, stored hashed.
- OAuth: validate `state`, use PKCE, check redirect URIs exactly.

### A08 Software or Data Integrity Failures → #19
- No insecure deserialization of untrusted data.
- Webhooks and callbacks are signed and verified. Updates and plugins are signed.
- Client-side state that matters (cart, price, role) is never trusted. Signed cookies or tokens only.
- Mass assignment: whitelist the fields that can be updated (no `User.update(req.body)` that lets a user set `role` or `plan`).

### A09 Security Logging & Alerting Failures → #12
- Log logins (success and failure), access-control denials, admin actions, payment events and input-validation failures, with user, IP and timestamp.
- No secrets, tokens, passwords or full card data in logs.
- Logs are centralized and kept, and alerts fire on spikes (failed logins, 403s, 5xx errors, unusual spending on AI or SMS).

### A10 Mishandling of Exceptional Conditions → #10
- Fail closed: if an auth, permission or payment check throws, the request is denied, not allowed.
- No empty `catch {}` around security checks. No error responses that leak stack traces, SQL or internal paths.
- Partial failures roll back (transactions). Timeouts and retries can't double-charge or double-apply (idempotency keys).
- Resource cleanup and limits on parsers (JSON body size, zip bombs, regex DoS).

---

## OWASP API Security Top 10 (2023)

| ID | Risk | What to check |
|----|------|---------------|
| API1 | Broken Object Level Authorization | Same as IDOR → #9. Check every endpoint that takes an object id. |
| API2 | Broken Authentication | → #2 and A07. API keys are hashed at rest, can be rotated, and are scoped. |
| API3 | Broken Object Property Level Authorization | Responses don't leak internal fields (`password_hash`, `stripe_customer_id`, other users' emails) because they use explicit serializers or DTOs. Inputs block mass assignment. |
| API4 | Unrestricted Resource Consumption | → #4. Plus pagination caps, max page size, request body size limits, upload size limits, and timeouts. |
| API5 | Broken Function Level Authorization | → #14. Admin and internal endpoints check the role on the server. Changing `GET` to `DELETE` or `/user/` to `/admin/` doesn't bypass checks. |
| API6 | Unrestricted Access to Sensitive Business Flows | Signup, checkout, invite, referral and voting flows protected against automation (CAPTCHA → #11, per-account limits, device or velocity checks). |
| API7 | Server Side Request Forgery | See SSRF under A01. |
| API8 | Security Misconfiguration | → A02, #7, #18. |
| API9 | Improper Inventory Management | List every route. Remove old, unused or debug versions (`/api/v1-old`, `/test`). Staging is not public with production data. |
| API10 | Unsafe Consumption of APIs | Validate and time-limit responses from third-party APIs. Treat them as untrusted input. Use TLS only, and don't follow redirects blindly. |

---

## OWASP Top 10 for LLM Applications (2025): only if the app uses AI

| ID | Risk | What to check |
|----|------|---------------|
| LLM01 | Prompt Injection | User input and fetched content (web pages, docs, emails) can't override the system instructions in a way that matters. Privileged actions never depend only on what the model says. Keep untrusted content separate and clearly labeled. |
| LLM02 | Sensitive Information Disclosure | Don't put secrets, other tenants' data or PII the user can't already see into prompts. Filter outputs where needed. |
| LLM03 | Supply Chain | Pin model and SDK versions. Only download models and datasets from trusted sources. |
| LLM04 | Data and Model Poisoning | Check content that goes into fine-tuning or RAG. Users can't write into a shared knowledge base other tenants read from. |
| LLM05 | Improper Output Handling | Treat model output as untrusted: sanitize it before rendering as HTML or markdown, and never pass it straight to SQL, shell, `eval`, file paths or URLs. |
| LLM06 | Excessive Agency | Tools the agent can call are least-privilege and scoped to the current user. Destructive or paid actions need confirmation. |
| LLM07 | System Prompt Leakage | No secrets or auth logic inside system prompts. Assume they will leak. |
| LLM08 | Vector and Embedding Weaknesses | Vector search is filtered by tenant and user permissions at query time. |
| LLM09 | Misinformation | Show sources and uncertainty for factual output. A human reviews before anything high-stakes is acted on. |
| LLM10 | Unbounded Consumption | Per-user token, request and cost limits, `max_tokens` caps, timeouts, and spending alerts → #4. |
