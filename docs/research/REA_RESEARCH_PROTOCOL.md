# Website research protocol (REA)

How agents in this repo may use REA to learn from **publicly observable** website behavior while building an original project-management app. No target has been investigated yet.

## Gate: do this before any browser session

1. **Name the target and the question.** Write down the one site (origin) and the specific UX/feature question, e.g. "how does the board view reorder cards?". No open-ended crawling.
2. **Read the target's current Terms of Service, Acceptable Use Policy and `robots.txt`.** Record the date, the URL, and the clauses on reverse engineering, scraping, automated access, benchmarking and building competing products.
3. **Decide and record.** If the terms prohibit the technique, stop or limit yourself to manual, ordinary use of the site (looking at it like any user). When unsure, ask the user, who may need legal advice. Log the decision in `docs/research/log.md`.
4. **Get the user's go-ahead in chat** for each technique below before running it.

## Hard rules

- Never bypass authentication, paywalls, CAPTCHAs, bot protection, rate limits or other access controls.
- Only use accounts the user owns, on plans they are entitled to. Never use someone else's credentials or data.
- Don't call private or undocumented APIs directly, replay requests, or extract tokens. Observing what your own browser already does is the limit.
- Don't copy proprietary source code, assets, copy text, icons, brand names or visual design. Record **behavior and ideas** in your own words, then design and write original code.
- Don't fetch source maps from third-party sites (`fetch_source_maps`), and don't export or store their script sources (`export_web_scripts`, `--include-script-sources`), unless the terms clearly allow it.
- Keep evidence local and out of git: the `research-data/` folder is git-ignored.

## Techniques and what data each one accesses

| Technique | REA tool | Data it reads | Default stance |
|-----------|----------|---------------|----------------|
| Look at the site manually | none | What any user sees | OK after the gate |
| List browser tabs | `list_browser_targets` | URL and title of every tab in the **dedicated** profile | OK, always pass `--allowed-origins` |
| Page structure snapshot | `inspect_web_page` (defaults) | DOM node types and names, attribute names (no text or values), accessibility roles, script and resource URLs, response metadata (no cookies or auth headers), network request URLs, methods and status codes seen during the window | Ask first |
| Opt-in text and shapes | `--include-accessibility-text`, `--include-console-text`, `--include-json-body-shapes`, `--include-storage-keys` | Visible labels, console output, JSON field names and types (no values), storage key names | Ask first, one flag at a time |
| Session timeline | `observe_web_session` | Navigation and lifecycle events while **you** click around | Ask first |
| Screenshots | `capture_web_screenshot`, `compare_web_screenshots` | Pixels of the visible viewport | Ask first; keep local |
| Bundle analysis | `analyze_web_bundle`, `export_web_scripts` | The site's shipped JavaScript (proprietary code) | **Off by default.** Only with explicit permission in the terms |
| Saved network capture | `inspect_web_network_capture` | A HAR/SAZ file you recorded: request and response contents | **Off by default.** Can contain your own tokens and personal data |
| Scripted browsing | `capture_browser_scenario` (Playwright) | Drives clicks and typing automatically | **Off by default.** Counts as automated access under most terms |

Use the browser in the Claude desktop app's browser pane, or the dedicated profile below, but **never your everyday Chrome profile**: CDP gives deep access to everything in that profile.

## Starting a dedicated, isolated browser

```bash
./scripts/rea-browser.sh https://example.com
```

This launches Chrome with a separate throwaway profile (`~/.rea-browser-profile`), DevTools on `127.0.0.1:9222` only. Sign in there only with an account you're allowed to use for this purpose. Quit that Chrome window when you're done.

Then, from Claude Code (REA MCP), call `list_browser_targets` with `cdp_endpoint: "http://127.0.0.1:9222"` and the allowed origin, followed by the approved tool.
