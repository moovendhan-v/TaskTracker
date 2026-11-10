# D3: Virtual office (phase 1)

A shared floor for each workspace where you see who's around and drop into a conversation,
built on chat (D1) and huddles (D2).

## What people get

- **Office** in the app rail: a floor plan with open desks, a quiet focus area, a lounge and
  three meeting rooms. Flat (top-down grid) or isometric, your choice; both are the same floor.
- Everyone who has the office open appears as an avatar where they stand, with a presence
  state: **available**, **focused** (set by you, or by sitting in the focus area), **in a
  meeting** (in any huddle), **away** (set by you) or **offline** (no sign of you for a few
  minutes). Avatars glide to where people move.
- Click a free spot to walk there. Walking into a meeting room offers its huddle: each room has
  a public channel (`#room-aurora`, …) made the first time someone goes in, so the room's
  chat and call are the ordinary ones.
- A side list of everyone by state, and a status picker.

## Rules

| Rule | How |
| --- | --- |
| Who sees the office | Members with `chat.use` (it's part of chat) |
| Where you can stand | Only on the floor, never in a wall, and not on someone else's spot; the server checks the layout |
| Presence can't be faked | You only move and set your own state; "in a meeting" and "offline" are worked out by the server |
| Not a tracker | Only what you do in the office is shown: where you stand, your state, and whether you're in a huddle. Nothing is recorded over time; leaving the page lets you go offline |
| Data stays in its workspace | `office_presence` has row-level security like every workspace table |

## Data

`office_presence`: workspace, user, position, chosen state, last seen. One row per person per
workspace, updated when they move or change state, and every minute while the page is open.

## Later

Editable floor plans, desks you can claim, rooms tied to existing channels, proximity audio,
showing people's calendars.
