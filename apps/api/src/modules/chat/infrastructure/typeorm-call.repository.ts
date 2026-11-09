import { Injectable } from '@nestjs/common';
import type { ActiveCallResponse } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { CallRepository, type CallSessionRecord } from '../domain/call.repository.js';

interface SessionRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  room: string;
  started_by: string;
  started_at: Date;
  ended_at: Date | null;
  message_id: string | null;
}

const COLUMNS = 'id, workspace_id, channel_id, room, started_by, started_at, ended_at, message_id';
const toRecord = (row: SessionRow): CallSessionRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  channelId: row.channel_id,
  room: row.room,
  startedBy: row.started_by,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  messageId: row.message_id,
});

/** Bound parameters only. */
@Injectable()
export class TypeOrmCallRepository extends CallRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.transactional.manager.query(sql, params);
  }

  async activeInChannel(workspaceId: string, channelId: string): Promise<CallSessionRecord | null> {
    const [row] = await this.query<SessionRow>(`SELECT ${COLUMNS} FROM call_session WHERE workspace_id = $1 AND channel_id = $2 AND ended_at IS NULL`, [workspaceId, channelId]);
    return row ? toRecord(row) : null;
  }

  async start(input: { id: string; workspaceId: string; channelId: string; room: string; startedBy: string }): Promise<{ session: CallSessionRecord; created: boolean }> {
    // Two people pressing Huddle at once: the second joins the first one's call.
    const [row] = await this.query<SessionRow>(
      `INSERT INTO call_session (id, workspace_id, channel_id, room, started_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (channel_id) WHERE ended_at IS NULL DO NOTHING RETURNING ${COLUMNS}`,
      [input.id, input.workspaceId, input.channelId, input.room, input.startedBy],
    );
    if (row) return { session: toRecord(row), created: true };
    const existing = await this.activeInChannel(input.workspaceId, input.channelId);
    if (!existing) throw new Error('A call was starting and ending at the same time; try again');
    return { session: existing, created: false };
  }

  async setMessage(workspaceId: string, sessionId: string, messageId: string): Promise<void> {
    await this.query(`UPDATE call_session SET message_id = $3 WHERE workspace_id = $1 AND id = $2`, [workspaceId, sessionId, messageId]);
  }

  async activeCalls(workspaceId: string): Promise<ActiveCallResponse[]> {
    const rows = await this.query<{ id: string; channel_id: string; started_by: string; started_at: Date; user_id: string | null; name: string | null }>(
      `SELECT s.id, s.channel_id, s.started_by, s.started_at, p.user_id, u.name
       FROM call_session s
       LEFT JOIN call_participant p ON p.session_id = s.id AND p.left_at IS NULL
       LEFT JOIN "user" u ON u.id = p.user_id
       WHERE s.workspace_id = $1 AND s.ended_at IS NULL
       ORDER BY s.started_at, p.joined_at
       LIMIT 2000`,
      [workspaceId],
    );
    const calls = new Map<string, ActiveCallResponse>();
    for (const row of rows) {
      const call = calls.get(row.id) ?? { id: row.id, channelId: row.channel_id, startedById: row.started_by, startedAt: row.started_at.toISOString(), participants: [] };
      if (row.user_id) call.participants.push({ userId: row.user_id, name: row.name ?? 'Someone' });
      calls.set(row.id, call);
    }
    return [...calls.values()];
  }

  async findByRoom(room: string): Promise<CallSessionRecord | null> {
    const [row] = await this.query<SessionRow>(`SELECT ${COLUMNS} FROM call_session WHERE room = $1`, [room]);
    return row ? toRecord(row) : null;
  }

  async firstDelivery(eventId: string): Promise<boolean> {
    const rows = await this.query(`INSERT INTO livekit_webhook_event (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`, [eventId]);
    return rows.length > 0;
  }

  async joined(session: CallSessionRecord, userId: string): Promise<void> {
    await this.query(
      `INSERT INTO call_participant (session_id, workspace_id, channel_id, user_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, user_id) DO UPDATE SET left_at = NULL`,
      [session.id, session.workspaceId, session.channelId, userId],
    );
    await this.query(
      `UPDATE call_session SET peak_participants = greatest(peak_participants, (SELECT count(*) FROM call_participant WHERE session_id = $1 AND left_at IS NULL)) WHERE id = $1`,
      [session.id],
    );
  }

  async left(session: CallSessionRecord, userId: string): Promise<void> {
    await this.query(`UPDATE call_participant SET left_at = now() WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL`, [session.id, userId]);
  }

  async end(session: CallSessionRecord): Promise<{ minutes: number; people: number } | null> {
    const result: unknown = await this.transactional.manager.query(
      `UPDATE call_session SET ended_at = now() WHERE id = $1 AND ended_at IS NULL
       RETURNING floor(extract(epoch FROM now() - started_at) / 60)::int AS minutes, (SELECT count(*) FROM call_participant WHERE session_id = $1) AS people`,
      [session.id],
    );
    // UPDATE … RETURNING comes back as [rows, count].
    const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as { minutes: number; people: string }[];
    const [row] = rows;
    await this.query(`UPDATE call_participant SET left_at = now() WHERE session_id = $1 AND left_at IS NULL`, [session.id]);
    return row ? { minutes: Number(row.minutes), people: Number(row.people) } : null;
  }

  async abandoned(idleSince: Date, limit: number): Promise<CallSessionRecord[]> {
    const rows = await this.query<SessionRow>(
      `SELECT ${COLUMNS} FROM call_session s
       WHERE s.ended_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM call_participant p WHERE p.session_id = s.id AND p.left_at IS NULL)
         AND greatest(s.started_at, coalesce((SELECT max(left_at) FROM call_participant p WHERE p.session_id = s.id), s.started_at)) < $1
       ORDER BY s.started_at LIMIT $2`,
      [idleSince, limit],
    );
    return rows.map(toRecord);
  }

  async outsiders(limit: number): Promise<{ room: string; userId: string }[]> {
    const rows = await this.query<{ room: string; user_id: string }>(
      `SELECT s.room, p.user_id FROM call_participant p
       JOIN call_session s ON s.id = p.session_id AND s.ended_at IS NULL
       JOIN chat_channel c ON c.id = s.channel_id
       WHERE p.left_at IS NULL AND c.kind <> 'public'
         AND NOT EXISTS (SELECT 1 FROM chat_member m WHERE m.channel_id = c.id AND m.user_id = p.user_id)
       LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({ room: row.room, userId: row.user_id }));
  }
}
