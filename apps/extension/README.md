# TaskFlow bug reporter (browser extension)

Report a bug from **any website** into a TaskFlow project. You get a screenshot you can mark up, an
optional screen recording, and the page's console, errors, network calls and your recent clicks.
It works in Chrome, Edge and Firefox (Manifest V3). It's open source (MIT) and talks only to your
own TaskFlow server.

## Install

```bash
pnpm --filter @taskflow/extension build
```

That writes `apps/extension/dist/chrome` and `apps/extension/dist/firefox`.

- **Chrome / Edge:** open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and
  pick `apps/extension/dist/chrome`.
- **Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and
  pick `apps/extension/dist/firefox/manifest.json`. For a permanent install, sign the
  `dist/firefox` folder through addons.mozilla.org (it can be unlisted).

To hand it to your team, zip the `dist/chrome` folder and publish it to the Chrome Web Store (it can
be unlisted or private to your Google Workspace), or have people load it unpacked.

## Connect it to TaskFlow (once)

1. Click the extension, enter your TaskFlow address (for example `https://taskflow.example.com`) and
   press **Connect**. The browser asks to let the extension talk to that address.
2. A TaskFlow tab opens. Sign in if asked, pick the workspace and press **Allow**.
3. The extension finishes connecting by itself.

The connection acts as you, and only as far as your role allows. It can file reports and read them
back, and nothing else: no settings, no members, no other tasks. It expires after 90 days. You can
see it and disconnect it in TaskFlow under **Security → Browser extension**, or with **Disconnect**
in the extension.

## Report a bug

- **Report a bug on this page** takes a screenshot of the tab and opens the report form. In the form
  you can:
  - draw arrows, boxes, highlights, freehand and text on the screenshot;
  - pixelate anything private;
  - record the screen (up to 60 seconds, microphone optional);
  - fill in the details, then file.
- **Point at the broken element, then report** lets you click the element first. It is boxed on the
  screenshot, and its selector goes into the steps.
- **Capture console & network on this tab** starts recording that tab: console output, uncaught
  errors, fetch/XHR calls (bodies only for failed ones) and clicks and typing. Reproduce the bug,
  then report. The recorded clicks become numbered reproduction steps.
- **Capture on every site automatically** (optional) starts that recording on every page as it
  loads, so a report always has the lead-up. It asks for access to all sites. Everything stays in the
  page's memory and is sent only when you file a report.

TaskFlow warns when the title looks like an existing report, so you can check for duplicates first.

## Privacy

- **Redaction:** passwords, tokens, cookies, authorization headers, API keys and card numbers are
  removed from the console, the network calls and the page address. This happens before anything
  leaves the page, and TaskFlow does it again on the server. Anything typed into a password or other
  secret-looking field is never recorded.
- **Recordings** use the browser's own screen-sharing prompt.
- **No third parties:** nothing goes anywhere except your TaskFlow server.

## How connecting works (for reviewers)

The extension creates a random PKCE verifier (RFC 7636) and opens TaskFlow with only its SHA-256
challenge. Approving stores the challenge for 10 minutes. The extension then exchanges the verifier
for a token at `POST /api/extension/token`, and this works once. A leaked approval link can't
connect anyone. TaskFlow stores only a hash of the token. Every extension call:

1. checks the token's scope;
2. checks your current role in the workspace;
3. runs inside your row-level security scope.

Approvals, token issue and revokes go to the workspace audit log.

## Develop

```bash
pnpm --filter @taskflow/extension typecheck
pnpm --filter @taskflow/extension test
pnpm --filter @taskflow/extension build
```

The capture code lives in `packages/bug-capture` and is shared with the TaskFlow web app. The browser
test `apps/web/e2e/browser-extension.spec.ts` loads the built extension into Chromium. It then:

1. connects it;
2. reports a failing checkout on a test page;
3. checks the report in TaskFlow, including that secrets were removed.
