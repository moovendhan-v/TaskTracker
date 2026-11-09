import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { CALL_STARTED_LINE, describeEndedCall, type CallJoinResponse, type CallsOverviewResponse } from '@taskflow/shared-types';
import { AccessToken, RoomServiceClient, WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { CallRepository, type CallSessionRecord } from '../domain/call.repository.js';
import { ChatService } from './chat.service.js';

/** Join tokens only let you in; LiveKit keeps the connection after they expire. */
const TOKEN_TTL_SECONDS = 600;
/** A call nobody has been in for this long is ended, in case LiveKit's "room finished" never came. */
const ABANDONED_AFTER_MS = 2 * 60_000;
const SWEEP_BATCH = 200;

/**
 * Calls (huddles) in chat channels (D2), on a LiveKit media server. TaskFlow decides who
 * may join which call and hands out short-lived tokens; LiveKit carries the audio and
 * video. Who's in a call, and when it ends, comes from LiveKit's signed webhooks.
 */
@Injectable()
export class CallsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly calls: CallRepository,
    private readonly chat: ChatService,
    private readonly transactional: TransactionalManager,
  ) {}

  get enabled(): boolean {
    return Boolean(this.env.LIVEKIT_URL && this.env.LIVEKIT_API_KEY && this.env.LIVEKIT_API_SECRET);
  }

  async overview(access: WorkspaceAccess): Promise<CallsOverviewResponse> {
    return { enabled: this.enabled, calls: this.enabled ? await this.calls.activeCalls(access.workspaceId) : [] };
  }

  /**
   * Joins the channel's call, starting one if none is going. You need to be able to post in
   * the channel (in a public channel, joining the call joins the channel). The token is for
   * that one room, as you: names come from your session, and you can't change them.
   */
  async join(actor: Actor, userName: string, access: WorkspaceAccess, channelId: string): Promise<CallJoinResponse> {
    if (!this.enabled) throw DomainError.forbidden('Calls aren’t set up on this server');
    const channel = await this.chat.channelForCall(actor, access, channelId);
    const id = randomUUID();
    const { session, created } = await this.calls.start({ id, workspaceId: access.workspaceId, channelId: channel.id, room: `tf-${id}`, startedBy: actor.userId });
    if (created) {
      const messageId = await this.chat.postSystemLine(actor, channel, CALL_STARTED_LINE);
      await this.calls.setMessage(access.workspaceId, session.id, messageId);
      await this.chat.announceChannel(actor, channel);
    }
    const token = new AccessToken(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET, { identity: actor.userId, name: userName, ttl: TOKEN_TTL_SECONDS });
    token.addGrant({ room: session.room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false });
    return { callId: session.id, channelId: channel.id, url: this.env.LIVEKIT_URL!, token: await token.toJwt() };
  }

  /**
   * A LiveKit webhook. Refused unless its signature (a JWT signed with the API secret over
   * the body's hash) checks out; a delivery seen before is ignored.
   */
  async webhook(rawBody: Buffer, authorization: string | undefined): Promise<'ok' | 'invalid' | 'ignored'> {
    if (!this.enabled || !authorization) return 'invalid';
    let event: WebhookEvent;
    try {
      event = await new WebhookReceiver(this.env.LIVEKIT_API_KEY!, this.env.LIVEKIT_API_SECRET!).receive(rawBody.toString('utf8'), authorization);
    } catch {
      return 'invalid';
    }
    const room = event.room?.name ?? '';
    if (!event.id || !/^tf-[0-9a-f-]{36}$/.test(room)) return 'ignored';
    const session = await this.transactional.runInScope({ kind: 'platform' }, async () =>
      (await this.calls.firstDelivery(event.id)) ? this.calls.findByRoom(room) : null,
    );
    if (!session) return 'ignored';
    const identity = event.participant?.identity ?? '';
    switch (event.event) {
      case 'participant_joined':
        if (identity) await this.inWorkspace(session, () => this.calls.joined(session, identity));
        break;
      case 'participant_left':
        if (identity) await this.inWorkspace(session, () => this.calls.left(session, identity));
        break;
      case 'room_finished':
        await this.finish(session);
        return 'ok';
      default:
        return 'ignored';
    }
    await this.announce(session);
    return 'ok';
  }

  onApplicationBootstrap(): void {
    if (!this.enabled || this.env.CALL_SWEEP_SECONDS === 0) return;
    this.timer = setInterval(() => void this.sweep(), this.env.CALL_SWEEP_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Ends calls nobody has been in for a while, and removes people from calls in private
   * channels and DMs they're no longer members of. Never throws.
   */
  async sweep(): Promise<void> {
    if (this.sweeping || !this.enabled) return;
    this.sweeping = true;
    try {
      const { abandoned, outsiders } = await this.transactional.runInScope({ kind: 'platform' }, async () => ({
        abandoned: await this.calls.abandoned(new Date(Date.now() - ABANDONED_AFTER_MS), SWEEP_BATCH),
        outsiders: await this.calls.outsiders(SWEEP_BATCH),
      }));
      for (const session of abandoned) await this.finish(session).catch((error: unknown) => this.logger.error('Ending a call failed', String(error)));
      if (outsiders.length) {
        const rooms = new RoomServiceClient(this.env.LIVEKIT_SERVER_URL ?? this.env.LIVEKIT_URL!.replace(/^ws/, 'http'), this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET);
        for (const { room, userId } of outsiders) {
          await rooms.removeParticipant(room, userId).catch(() => undefined);
          const session = await this.transactional.runInScope({ kind: 'platform' }, () => this.calls.findByRoom(room));
          if (session) await this.inWorkspace(session, () => this.calls.left(session, userId));
        }
      }
    } catch (error) {
      this.logger.error('Call sweep failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.sweeping = false;
    }
  }

  /** Ends the call and turns its "started a huddle" line into how it went. */
  private async finish(session: CallSessionRecord): Promise<void> {
    const ended = await this.inWorkspace(session, () => this.calls.end(session));
    if (!ended) return;
    const starter: Actor = { userId: session.startedBy, platformRole: 'USER', ip: null };
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: session.workspaceId, userId: session.startedBy }, async () => {
      const channel = await this.chat.findChannelAs(session.workspaceId, session.startedBy, session.channelId);
      if (!channel) return;
      if (session.messageId) await this.chat.editSystemLine(starter, channel, session.messageId, describeEndedCall(ended.minutes, ended.people));
      await this.chat.announceChannel(starter, channel);
    });
  }

  /** Tells the channel's readers that who's in the call changed. */
  private async announce(session: CallSessionRecord): Promise<void> {
    const starter: Actor = { userId: session.startedBy, platformRole: 'USER', ip: null };
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: session.workspaceId, userId: session.startedBy }, async () => {
      const channel = await this.chat.findChannelAs(session.workspaceId, session.startedBy, session.channelId);
      if (channel) await this.chat.announceChannel(starter, channel);
    });
  }

  private inWorkspace<T>(session: CallSessionRecord, work: () => Promise<T>): Promise<T> {
    return this.transactional.runInScope({ kind: 'workspace', workspaceId: session.workspaceId, userId: null }, work);
  }
}
