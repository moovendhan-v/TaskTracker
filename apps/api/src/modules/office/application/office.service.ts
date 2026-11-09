import { Injectable } from '@nestjs/common';
import {
  isWalkable,
  meetingRoomChannelName,
  OFFICE_OFFLINE_AFTER_MS,
  OFFICE_ZONES,
  officeStatus,
  zoneAt,
  type OfficeChosenStatus,
  type OfficePersonResponse,
  type OfficeResponse,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { OfficeRepository, type OfficePresenceRecord } from '../domain/office.repository.js';

/**
 * The virtual office (D3): where people stand on the workspace's floor and how they show.
 * You only move and set yourself; "in a meeting" and "offline" are worked out here. Meeting
 * rooms are ordinary public channels, so their chat and huddle are the usual ones.
 */
@Injectable()
export class OfficeService {
  constructor(
    private readonly office: OfficeRepository,
    private readonly chat: ChatService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  async get(access: WorkspaceAccess): Promise<OfficeResponse> {
    const now = this.clock.now();
    return { workspaceId: access.workspaceId, people: (await this.office.list(access.workspaceId)).map((record) => this.person(record, now)) };
  }

  /** Walks to a free spot on the floor. */
  async move(actor: Actor, access: WorkspaceAccess, x: number, y: number): Promise<OfficePersonResponse> {
    if (!isWalkable(x, y)) throw DomainError.invalid('That spot isn’t on the floor');
    const now = this.clock.now();
    if (await this.office.occupied(access.workspaceId, x, y, actor.userId, this.onlineSince(now))) throw DomainError.conflict('Someone is standing there');
    const current = await this.office.find(access.workspaceId, actor.userId);
    await this.office.save(access.workspaceId, actor.userId, { x, y, chosen: current?.chosen ?? 'available', lastSeenAt: now });
    return this.changed(actor, access);
  }

  async setStatus(actor: Actor, access: WorkspaceAccess, chosen: OfficeChosenStatus): Promise<OfficePersonResponse> {
    const now = this.clock.now();
    const current = await this.office.find(access.workspaceId, actor.userId);
    const spot = current ?? (await this.freeSpot(access, actor.userId, now));
    await this.office.save(access.workspaceId, actor.userId, { x: spot.x, y: spot.y, chosen, lastSeenAt: now });
    return this.changed(actor, access);
  }

  /**
   * A sign of life from the open office page. The first one puts you at a free desk; one after
   * you'd gone offline tells everyone you're back.
   */
  async heartbeat(actor: Actor, access: WorkspaceAccess): Promise<OfficePersonResponse> {
    const now = this.clock.now();
    const current = await this.office.find(access.workspaceId, actor.userId);
    const wasOffline = !current || current.lastSeenAt < this.onlineSince(now);
    const spot = current && !(wasOffline && (await this.office.occupied(access.workspaceId, current.x, current.y, actor.userId, this.onlineSince(now)))) ? current : await this.freeSpot(access, actor.userId, now);
    await this.office.save(access.workspaceId, actor.userId, { x: spot.x, y: spot.y, chosen: current?.chosen ?? 'available', lastSeenAt: now });
    if (wasOffline) return this.changed(actor, access);
    return this.person((await this.office.find(access.workspaceId, actor.userId))!, now);
  }

  /** Leaving the office page: you show as offline straight away. */
  async leave(actor: Actor, access: WorkspaceAccess): Promise<boolean> {
    const current = await this.office.find(access.workspaceId, actor.userId);
    if (!current) return false;
    await this.office.save(access.workspaceId, actor.userId, { x: current.x, y: current.y, chosen: current.chosen, lastSeenAt: new Date(0) });
    await this.announce(actor, access);
    return true;
  }

  /** A meeting room's channel (made the first time someone goes in), to chat or huddle in. */
  async meetingRoom(actor: Actor, access: WorkspaceAccess, zoneId: string): Promise<string> {
    const zone = OFFICE_ZONES.find((item) => item.id === zoneId && item.kind === 'meeting');
    if (!zone) throw DomainError.notFound('Meeting room');
    return this.chat.meetingRoomChannel(actor, access, meetingRoomChannelName(zone), `${zone.name}, a meeting room in the office`);
  }

  private async freeSpot(access: WorkspaceAccess, userId: string, now: Date): Promise<{ x: number; y: number }> {
    const taken = new Set(
      (await this.office.list(access.workspaceId)).filter((record) => record.userId !== userId && record.lastSeenAt >= this.onlineSince(now)).map((record) => `${record.x},${record.y}`),
    );
    const desks = OFFICE_ZONES.find((zone) => zone.kind === 'desks')!;
    // Desks first, every other tile so people don't stand shoulder to shoulder; then anywhere.
    for (let y = desks.y; y < desks.y + desks.h; y += 2) for (let x = desks.x; x < desks.x + desks.w; x += 2) if (!taken.has(`${x},${y}`)) return { x, y };
    for (let y = 1; y <= 12; y++) for (let x = 1; x <= 22; x++) if (isWalkable(x, y) && !taken.has(`${x},${y}`)) return { x, y };
    throw DomainError.conflict('The office is full');
  }

  private onlineSince(now: Date): Date {
    return new Date(now.getTime() - OFFICE_OFFLINE_AFTER_MS);
  }

  private async changed(actor: Actor, access: WorkspaceAccess): Promise<OfficePersonResponse> {
    await this.announce(actor, access);
    return this.person((await this.office.find(access.workspaceId, actor.userId))!, this.clock.now());
  }

  private announce(actor: Actor, access: WorkspaceAccess): Promise<void> {
    return this.events.publish(domainEvent('office_presence', 'updated', { workspaceId: access.workspaceId, entityId: actor.userId, actorId: actor.userId }));
  }

  private person(record: OfficePresenceRecord, now: Date): OfficePersonResponse {
    return {
      userId: record.userId,
      name: record.name,
      x: record.x,
      y: record.y,
      chosenStatus: record.chosen,
      status: officeStatus({ chosen: record.chosen, lastSeenAt: record.lastSeenAt, inCall: record.inCall, x: record.x, y: record.y }, now),
      zoneId: zoneAt(record.x, record.y)?.id ?? null,
    };
  }
}
