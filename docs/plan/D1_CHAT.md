# D1: Chat (channels, DMs, threads, task from message)

Design refs: v2 `#2a` (chat with a thread open), spec §5.8, data model §7 (`channels`, `messages(thread_id, task_id?)`), realtime §8 (`chat:{channelId}`).

Chat is a new product, not a gap, so this plan comes before any code (handoff §10 and our build status). It fixes the data model, who can see what (RLS), how messages reach people live, and the build order.

## Scope

**Phase 1 (this plan):**

- Public channels (any workspace member can find, read and join), private channels (members only) and direct messages (1:1, or a group of up to 8).
- Messages with one level of threads: a reply belongs to a root message. The root shows a reply count and the last reply time.
- Edit and delete your own messages. A deleted message keeps its place as "Message deleted".
- Unread state per channel and per thread, from a "last read" marker.
- `#123` task chips and `:::task 123` cards in messages, reusing the C5 renderer, so a reader only sees tasks they can access.
- **Create task from message**: pre-fills the title from the message, links the task back to the message, and posts a small "created #123" line in the thread.
- Rail item **Chat** (`G C`), a channel list in the side panel, the message pane, and a 340px thread pane.

**Later (not in phase 1):**

- `@mentions` with inbox notifications.
- Reactions, typing indicator, pinned messages, file uploads and search.
- "Every task has a thread": task comments already do this job. Bridging the two comes later; we won't keep two copies of the same conversation.
- Huddles and calls (D2, needs an SFU).
- Retention settings, export, and a chat-message automation trigger (E1).

## Data

All tables are tenant tables: `workspace_id` on every row, forced RLS, and `ON DELETE CASCADE` from the workspace.

### `chat_channel`

| column | |
|---|---|
| `id` uuid PK | |
| `workspace_id` uuid → workspace | |
| `kind` text | `public` · `private` · `dm` (check constraint) |
| `name` text null | 1–80 chars, lowercase `a-z0-9-_`; unique per workspace among non-DM channels; null for DMs |
| `topic` text | ≤ 250 chars, default `''` |
| `dm_key` text null | sorted member ids joined, unique per workspace, so a DM between the same people is found, not duplicated |
| `created_by` text → user, set null | |
| `archived_at` timestamptz null | archived channels are read-only |
| `last_message_at` timestamptz null | for sorting the channel list |
| `created_at` timestamptz | |

### `chat_member`

| column | |
|---|---|
| `channel_id` uuid → chat_channel, cascade | PK with `user_id` |
| `user_id` text → user, cascade | |
| `workspace_id` uuid | denormalised for RLS and indexes |
| `role` text | `owner` · `member` |
| `last_read_at` timestamptz null | unread = messages after this |
| `muted` boolean | default false |
| `joined_at` timestamptz | |

When someone leaves the workspace, their memberships go too (a membership-removal hook, plus RLS denies them anyway).

### `chat_message`

| column | |
|---|---|
| `id` uuid PK | |
| `workspace_id` uuid | |
| `channel_id` uuid → chat_channel, cascade | |
| `author_id` text → user, set null | |
| `parent_id` uuid null → chat_message, cascade | thread root; a reply's parent must be a root in the same channel (checked in the service and by a trigger) |
| `body` text | 1–4000 chars after trimming; plain markdown, never raw HTML |
| `task_id` uuid null → task, set null | the task created from this message |
| `kind` text | `user` · `system` (the "created #123" line) |
| `reply_count` int, `last_reply_at` timestamptz null | kept on the root inside the same transaction as the reply |
| `edited_at`, `deleted_at` timestamptz null | delete clears `body` and keeps the row |
| `created_at` timestamptz | |

Indexes: `(channel_id, created_at DESC, id)` for paging the channel, `(parent_id, created_at, id)` for threads, and `(workspace_id, channel_id)`.

## Who can see what (RLS)

The core rule: **you can read a channel if it is public in a workspace you can access, or you are a member of it.** Private channels and DMs don't exist for anyone else, not even as names or counts.

A `SECURITY DEFINER` helper does the membership lookup, so policies on `chat_member` don't call themselves (fixed `search_path`, `STABLE`, owned by the migration role, `EXECUTE` granted only to the app role):

```sql
app_can_read_chat_channel(channel uuid) → boolean
  -- channel is in an accessible workspace AND (kind = 'public' OR current user is a member)
app_is_chat_member(channel uuid) → boolean
```

| table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `chat_channel` | `app_can_read_chat_channel(id)` | workspace access AND `created_by = me` | owner of the channel (or `chat.manage` on public channels, enforced in the service) | none (archive instead) |
| `chat_member` | workspace access AND (`user_id = me` OR `app_can_read_chat_channel(channel_id)`) | `user_id = me` AND channel is public (join), OR I own the channel (add people), OR the channel was created by me in this transaction (DM / new channel setup) | own row only (`last_read_at`, `muted`) | own row (leave), or I own the channel (remove) |
| `chat_message` | `app_can_read_chat_channel(channel_id)` | `author_id = me` AND `app_is_chat_member(channel_id)` AND channel not archived | `author_id = me` (edit / delete) | none (soft delete) |

No `USING (true)`. Platform scope keeps its usual bypass for the admin console, as on every tenant table. A test proves each row of this table directly in SQL as two users (member and non-member of a private channel, and a DM outsider), like the dashboard tables.

Service-level rules on top of RLS (the frontend sends ids and text only; never roles, authors or membership):

- Author, owner and membership always come from the session.
- DMs: the people must all be workspace members, there are 2–8 of them including you, nobody can be added later (start a new DM instead), and nobody owns them.
- Private channels: only owners add or remove people. The last owner can't leave without handing over ownership.
- Archived channels reject posts, edits and joins.
- Every lookup by id goes through RLS-scoped queries in the session's workspace (no IDOR: a message id from another channel or workspace simply isn't found).

## Permissions

- New `chat.use`: read, post, start DMs, create channels. Granted by the `Contributor` (member), `WorkspaceAdmin` and `FullAccess` policies. Not by `ReadOnly` (guests), who can still be added to a specific private channel later; that comes later too.
- New `chat.manage`: archive or rename any public channel, and remove people from it. `WorkspaceAdmin` and `FullAccess` only. These actions write an **audit log entry** (who, what, channel, when, IP).
- Create task from message also needs `task.create` on the chosen list, checked the normal way.

## API (GraphQL)

Every resolver uses `@RequirePermissions('chat.use')` (or `chat.manage`) and takes the user from the session. Inputs are validated with class-validator and the shared limits.

Queries:

- `chatChannels(workspaceId)`: channels I'm in, plus unread counts and the latest message time.
- `browseChannels(workspaceId, search?, first ≤ 50)`: public channels to join.
- `chatMessages(workspaceId, channelId, before?, first ≤ 50)`: keyset pagination on `(created_at, id)`.
- `chatThread(workspaceId, messageId, after?, first ≤ 100)`.

Mutations:

- `createChannel`, `updateChannel` (name, topic), `archiveChannel`.
- `joinChannel`, `leaveChannel`, `addChannelMembers` (≤ 50 per call), `removeChannelMember`.
- `openDirectMessage(userIds)`: finds or creates by `dm_key`.
- `sendMessage(channelId, body, parentId?)`, `editMessage`, `deleteMessage`.
- `markChannelRead(channelId, at)`, which never moves the marker backwards.
- `createTaskFromMessage(messageId, listId, title?)`: one transaction that creates the task, sets `chat_message.task_id`, and adds the system line.

Rate limits (per user, on top of the global 120/min): `sendMessage` 30/min, `createChannel` / `openDirectMessage` 10/min, `addChannelMembers` 20/min.

Responses go through explicit GraphQL types: no internal columns, no `dm_key`, and no member lists for channels you can't read.

## Realtime

Today every workspace event goes to every member unless it has a `recipientId`. Events carry ids only, and clients refetch through the permission-checked API. So even a private channel's message id should not reach outsiders.

- **Public channel events** (`chat_message.created/updated/deleted`, `chat_channel.updated`) go to the whole workspace with `recipientId = null`. Anyone may read public channels, so this leaks nothing.
- **Private channel and DM events fan out**: one event per current member with `recipientId = member`. Private channels cap at 500 members to keep the fan-out bounded. A removed member stops getting events as soon as they're removed.
- New entity types `chat_channel` and `chat_message` join `REALTIME_ENTITY_TYPES`. The web maps them to `['chat', …]` query keys, and an open channel appends new messages by refetching its newest page.
- The 30-second session and membership re-check on the subscription stays as it is.

## Web

- `modules/chat`: `api/chat.api.ts`, `hooks` (channels, messages with infinite query, thread, mutations with optimistic send and retry), `components` (channel list, message list, message, composer, thread pane, channel header, new channel / DM dialogs), and `pages/chat.page.tsx`.
- Routes: `/w/$workspaceId/chat` (last channel) and `/w/$workspaceId/chat/$channelId?thread=`. Each channel opens in a workbench tab with its name.
- Rail: a Chat icon after Tracker, `G C`, and an unread dot. The side panel lists Channels and Direct messages with unread counts.
- Messages render through the existing markdown preview (no raw HTML, links get `rel="noopener noreferrer"`), plus `#123` chips and task cards from C5.
- Composer: Enter sends, Shift+Enter adds a newline, `#` autocompletes tasks (`TaskMentionTextarea` moves to a shared place), and the 4000-character limit is shown near the end.
- Message actions on hover or focus: Reply in thread, Create task, Copy link, and Edit / Delete for your own messages.
- Keyboard: ↑ in an empty composer edits your last message, Esc closes the thread, and `J/K` move between channels in the list.

## Tests

- **Shared:** channel name and body validation.
- **API unit:** service rules (DM size and dedupe, owner-only adds, last owner can't leave, archived is read-only, thread depth of 1, mark-read never goes back).
- **API e2e:** each RLS row above, proven in SQL as different users. Also: GraphQL access denied for outsiders and guests, a message from another channel or workspace isn't found, private events don't reach non-members, the rate limit on `sendMessage`, create-task-from-message needs `task.create`, and archiving writes an audit row.
- **Web unit:** message grouping by author and time, and unread maths.
- **Browser e2e:** create a channel, post, reply in a thread, create a task from a message, and open a DM.

## Build order

1. Migration (tables, helpers, policies, grants), permissions in shared types, the SQL RLS tests.
2. API: channels and members, then messages and threads, then create task from message. Realtime fan-out. Unit and e2e tests. SDK regenerate.
3. Web: route, rail, channel list, message pane, composer. Then threads, unread, and create task. Browser e2e. Screenshots.
4. `/security-review` on the branch (data access and realtime changes) before asking to merge.

## Decisions made with defaults (easy to change before building)

- Guests can't use chat in phase 1.
- Group DMs are capped at 8 people, private channels at 500.
- Deleting a message keeps a "Message deleted" placeholder, so threads stay readable.
- Messages are never hard-deleted in phase 1. Retention settings come later.
