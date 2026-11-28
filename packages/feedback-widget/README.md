# TaskFlow feedback widget

A feedback button for your own website. Visitors report a bug or an idea, and it lands as a bug task
in one TaskFlow project. Each report includes:

- the page's recent console errors, failed requests and clicks, with passwords and tokens removed;
- an optional screenshot;
- a link the visitor can use to follow the report.

It's open source (MIT) and served by your own TaskFlow server.

## Turn it on

In TaskFlow, open the project's **Settings → Feedback from outside**:

1. Tick **Feedback button on my sites**.
2. List the sites allowed to show it, one per line (`https://www.example.com`). Only those sites can
   send reports.
3. Optionally tick **Feedback page** for a hosted form at `https://<your-taskflow>/f/<key>`.
4. Save, then copy the snippet into your site's pages, just before `</body>`:

```html
<script src="https://taskflow.example.com/embed/v1/feedback.js" data-key="tfk_…" async></script>
```

Options, as `data-` attributes on the script tag:

| Attribute | Default | Meaning |
|---|---|---|
| `data-label` | `Feedback` | The button's text |
| `data-position` | `right` | `right` or `left` |
| `data-color` | orange | The button colour (a CSS colour) |
| `data-capture` | on | `off` to not record console and network |

To open it from your own button, call `window.TaskFlowFeedback.open()` (and `.close()`).

## How it's protected

- **Public key.** The key is meant to be public, since it sits in your page. Reports are only
  accepted from the sites you listed (checked against the browser's `Origin`). If the key is
  abused, rotate it with **New key**.
- **Bot protection.** Each report needs a CAPTCHA when your TaskFlow server has one set:
  `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`, both Cloudflare Turnstile, which is free. A
  hidden honeypot field catches simple bots.
- **Rate limits.** Requests are rate limited per IP, and each project accepts at most 60 public
  reports an hour.
- **Recording.** Passwords, tokens, cookies, auth headers and card numbers are removed before the
  report leaves the page, and again on the server. Request bodies are kept only for failed requests.
  Nothing is sent until someone files a report.
- **Reporting identity.** Reports are filed under the admin who turned the widget on, with the
  visitor's name and email. If that admin loses access, the widget stops accepting reports.
- **Tracking links.** Visitors get a status-only link that shows no details, files or diagnostics.
  It expires after 180 days.

## Build

`pnpm --filter @taskflow/feedback-widget build` writes `dist/feedback.js`, one self-contained script
of about 10 KB gzipped. The TaskFlow web app serves it at `/embed/v1/feedback.js`. `pnpm build` builds
it before the web app, and the web Dockerfile does the same.
