import { ArgsType, Field, ID, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { NOTIFICATION_KINDS, type NotificationResponse } from '@taskflow/shared-types';
import { NotificationKindEnum } from '../../../../core/graphql/enums.js';
import { PageOf, WorkspacePageArgs } from '../../../../core/graphql/page.type.js';
import type { NotificationKind } from '../../domain/notification.js';

@ObjectType('Notification')
export class NotificationGql implements NotificationResponse {
  @Field(() => ID) id: string;
  @Field(() => NotificationKindEnum) kind: NotificationKind;
  @Field(() => ID, { nullable: true }) actorId: string | null;
  @Field(() => String, { nullable: true }) actorName: string | null;
  @Field() entityType: string;
  @Field(() => ID) entityId: string;
  @Field(() => ID, { nullable: true, description: 'The task to open, when the notification is about one' }) taskId: string | null;
  @Field({ description: 'What it is about, e.g. the task title' }) subject: string;
  @Field({ description: 'Plain text; render as text, never HTML' }) excerpt: string;
  @Field(() => String, { nullable: true }) readAt: string | null;
  @Field(() => String, { nullable: true, description: 'Hidden until then, when it comes back unread' }) snoozedUntil: string | null;
  @Field() createdAt: string;
}

@ObjectType('NotificationPage')
export class NotificationPageGql extends PageOf(NotificationGql) {}

@ArgsType()
export class InboxArgs extends WorkspacePageArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @Field(() => [NotificationKindEnum], { nullable: true, description: 'Only these kinds' })
  @IsOptional()
  @ArrayMaxSize(20)
  @IsIn(NOTIFICATION_KINDS, { each: true })
  kinds?: NotificationKind[];

  @Field({ nullable: true, description: 'The snoozed notifications (soonest back first) instead of the inbox' })
  @IsOptional()
  @IsBoolean()
  snoozed?: boolean;
}



/** Up to one page of notifications at a time. */
@ArgsType()
export class MarkReadArgs {
  @Field(() => ID)
  @IsUUID('4')
  workspaceId: string;

  @Field(() => [ID])
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}

@ArgsType()
export class SnoozeArgs extends MarkReadArgs {
  @Field({ nullable: true, description: 'When they come back (ISO time, at most 30 days ahead); omit to unsnooze now' })
  @IsOptional()
  @IsISO8601({ strict: true })
  until?: string;
}
