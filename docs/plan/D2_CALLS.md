# D2: Calls and huddles

Voice and video calls in chat channels, on a LiveKit media server (LiveKit Cloud, or
self-hosted; the dev stack runs one). TaskFlow never carries audio or video itself: it
decides who may join which call, hands out short-lived tokens, and keeps track of calls.

## What people get (phase 1)

- **Huddle** button in every channel and direct message they can read. One call per channel:
  the first person starts it, everyone else sees "Avery and 2 others are in a huddle" in the
  channel list and the channel header, and joins with one click.
- **Lobby** before joining: camera and microphone preview, on/off toggles, device pickers.
- **Call view**: tiles with names, who's muted, who's speaking; mute, camera, screen share,
  leave. Works with audio only.
- **Dock and picture-in-picture**: moving around the app keeps the call in a small floating
  window; the browser's picture-in-picture can pop the active video out of the tab.
- Chat shows the call as a system message: started by whom, then how long it lasted and how
  many people took part.

## Rules

| Rule | How |
| --- | --- |
| Only people who can read the channel join its call | `joinCall` checks `chat.use` and channel access (row-level security plus the chat service), then signs a LiveKit token for that one room |
| Names can't be faked | The token's identity and name come from the session; participants can't change their own metadata |
| Tokens are short-lived | 10 minutes to join; LiveKit keeps the connection after that |
| Removing someone from a private channel ends their access | Their next token is refused, and a sweep (every minute) asks LiveKit to remove them from a call they're still in |
| Call state can't be forged | LiveKit webhooks are verified (signed with the API secret over the raw body), deduplicated by event id, and only then change call records |
| Calls are off unless configured | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (all or none); without them the Huddle button isn't shown and `joinCall` refuses |
| Browser permissions | The web app's Permissions-Policy allows camera, microphone and screen capture for itself only; the CSP allows connecting to the configured LiveKit URL only |

## Data

- `call_session`: workspace, channel, LiveKit room, who started it, when it started and
  ended, the most people at once, and the chat message that shows it. Row-level security
  like chat messages: readable with the channel.
- `call_participant`: who is in a call now (joined, left). Same visibility.
- `livekit_webhook_event`: ids of handled webhook events, so a retried delivery is ignored.

## Testing

API end-to-end tests sign tokens and webhooks without a media server. The browser tests run a
real call when `E2E_LIVEKIT_BINARY` points at a `livekit-server` binary (Chromium's fake camera
and microphone stand in for devices); without it, that test is skipped.

## Later

Recording and transcripts (needs storage and consent), calls on tasks and docs, scheduled
meetings and a lobby with admission, phone dial-in, the virtual office (D3) built on calls.
