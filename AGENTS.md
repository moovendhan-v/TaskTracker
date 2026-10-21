# Agent rules

These rules apply to every AI coding agent working in this repo (Claude Code, Cursor, Codex, Copilot, etc.). Follow them when writing new code, not just during audits.

## Security rules (always on)

Every change must keep these true. If a change would break one, stop and say so.

1. **Row level security** — Every table has RLS (or equivalent rules) enabled, with policies that limit access to the owner or tenant. No `USING (true)` policies. Admin/service keys stay on the server.
2. **Auth on every API route** — Every route, server action and function checks the session on the server before doing any work. Public routes need a comment that says why they are public.
3. **Never trust the frontend** — Roles, prices, user ids, plan limits and ownership come from the server session or DB, never from the request body. Validate every input on the server with a schema.
4. **Rate limiting** — Auth endpoints, AI calls, email/SMS sends and expensive endpoints are rate limited by user and IP.
5. **Sanitize user input** — No raw HTML from users (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`) unless it goes through a sanitizer. Validate type, length and format.
6. **Parameterized queries** — Never build SQL, NoSQL queries or shell commands by joining strings with user input. Use bound parameters or the ORM.
7. **Lock down CORS** — Allow only the known frontend origins, read from env. Never use `*` with credentials, and never echo back the request's `Origin`.
8. **HTTPS everywhere** — HTTPS only, HSTS on, cookies `Secure; HttpOnly; SameSite`.
9. **Stop IDOR bugs** — Any lookup by id also checks that the current user or tenant owns it (`id AND owner_id`).
10. **Debug mode off in prod** — No stack traces, debug endpoints or verbose errors in production. Clients get generic messages and the details go to logs.
11. **CAPTCHA on public forms** — Signup, login, password reset, contact and waitlist forms use a CAPTCHA, and the token is verified on the server.
12. **Log admin actions** — Privileged actions write an append-only audit log entry: who, what, target, when and IP.
13. **Private storage buckets** — User files go in private buckets and are served through short-lived signed URLs after an ownership check.
14. **Hide admin pages properly** — Admin pages and admin APIs check the role on the server. Hiding them in the UI is not protection.
15. **Update vulnerable packages** — Don't add packages with known high or critical vulnerabilities. Commit the lockfile.
16. **Check file upload types** — Check the file's actual content (magic bytes), not just its extension. Enforce size limits, rename files, and block HTML/SVG unless sanitized.
17. **Claude security review** — Run `/security-review` (or an equivalent review) before merging changes that touch auth, data access, payments or uploads.
18. **Security headers** — Set CSP, HSTS, `X-Content-Type-Options: nosniff`, frame-ancestors/`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` in central config.
19. **Verify webhook signatures** — Verify every incoming webhook's signature against the raw request body, check the timestamp, and make sure handling the same event twice is safe.

## OWASP rules (always on)

These cover the OWASP Top 10 (2025), API Security Top 10 (2023) and LLM Top 10 (2025) beyond the 19 rules above. Each tag shows the matching OWASP item.

- **SSRF** (A01, API7) — Server-side fetches of user-supplied URLs allowlist hosts and schemes, block private, loopback and metadata IPs (`169.254.169.254`) after DNS resolution, and don't follow redirects blindly.
- **Open redirects and CSRF** (A01) — Redirect targets are relative paths or allowlisted hosts. Forms that use cookie auth have CSRF protection.
- **Least privilege config** (A02) — No default credentials, public DB ports or public buckets, and XML external entities are disabled. Infrastructure config lives in code.
- **Supply chain** (A03, LLM03) — CI installs from the lockfile, GitHub Actions are pinned to a commit SHA, CDN scripts use SRI, and new dependencies are checked for typosquatting.
- **Cryptography** (A04) — Passwords use argon2id/bcrypt/scrypt (or a managed auth provider). Tokens come from a secure random source. JWTs pin the algorithm and check `exp`/`aud`/`iss`. No home-made crypto. Sensitive data is encrypted at rest.
- **No dangerous sinks** (A05) — No `eval`, `new Function`, `shell=True`, `exec` with interpolated strings, or `pickle`/unsafe `yaml.load` on untrusted data.
- **Business logic** (A06, API6) — Money, credits and quotas change inside transactions or row locks. Multi-step flows can't be skipped. Per-account limits are enforced on the server.
- **Sessions and MFA** (A07) — Rotate the session on login and revoke it on logout or password change. No user enumeration. Reset and magic-link tokens are single use, short-lived and stored hashed. OAuth uses `state` and PKCE. Admins have MFA.
- **Mass assignment and data exposure** (A08, API3) — Allowlist the fields users can update. Responses go through explicit serializers or DTOs, so internal fields never leak.
- **Logging and alerting** (A09) — Log auth events, access denials, admin actions and payments, with no secrets in the logs. Alert on spikes.
- **Fail closed** (A10) — If a security check throws, deny the request. No empty `catch` around auth. Retries use idempotency keys. Limit body size, upload size and regex complexity.
- **Resource limits and inventory** (API4, API9) — Pagination has a max page size and requests have timeouts. Remove old, unused or debug endpoints.
- **Third-party APIs** (API10) — Treat their responses as untrusted input: validate them and set timeouts.
- **AI features** (LLM01–LLM10) — Treat model output as untrusted (never send it straight to HTML, SQL, shell or file paths). No secrets in prompts. Agent tools are least-privilege, and destructive actions need confirmation. Vector search is filtered by tenant. Each user has token and cost limits.

## Secrets

- Never commit secrets. Use env vars and keep `.env.example` up to date with names only.
- Never print secret values in logs, chat or PR descriptions.

## Full audit

To audit the whole app against these rules and fix what's missing, use the `saas-security-audit` skill (19 checks + OWASP pass) in `.claude/skills/saas-security-audit/SKILL.md` (in Claude Code: `/saas-security-audit`). It reports progress as `NN/19 FIXED`.

## Website research with REA

REA (reverse-engineering MCP server) is available. Before using any of its browser, network or bundle tools on a third-party website, follow [docs/research/REA_RESEARCH_PROTOCOL.md](docs/research/REA_RESEARCH_PROTOCOL.md): check the site's terms, log the decision in `docs/research/log.md`, and get the user's approval in chat. Never bypass access controls, call private APIs, or copy proprietary code, assets or design. Build original implementations.
