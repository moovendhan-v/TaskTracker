import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  CHAT_ADD_MEMBERS_MAX,
  CHAT_CHANNEL_NAME_MAX,
  CHAT_MESSAGE_MAX,
  CHAT_TOPIC_MAX,
  type ChatChannelKind,
  type ChatChannelResponse,
  type ChatMemberResponse,
  type ChatMemberRole,
  type ChatMessagePage,
  type ChatMessageResponse,
  type ChatPersonResponse,
  type ChatReactionSummary,
} from '@taskflow/shared-types';
import { ArrayMaxSize, IsArray, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('ChatPerson')
export class ChatPersonGql implements ChatPersonResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
}

@ObjectType('ChatChannel', { description: 'A channel or direct message you can read' })
export class ChatChannelGql implements ChatChannelResponse {
  @Field(() => ID) id: string;
  @Field(() => String, { description: 'public, private or dm' }) kind: ChatChannelKind;
  @Field(() => String, { nullable: true, description: 'Null for direct messages' }) name: string | null;
  @Field() topic: string;
  @Field() archived: boolean;
  @Field(() => String, { nullable: true, description: 'owner or member; null for a public channel you have not joined' }) myRole: ChatMemberRole | null;
  @Field() muted: boolean;
  @Field(() => Int) memberCount: number;
  @Field(() => [ChatPersonGql], { description: 'For direct messages: the other people in it' }) dmMembers: ChatPersonGql[];
  @Field(() => Int, { description: 'Top-level messages from others since you last read the channel' }) unreadCount: number;
  @Field(() => String, { nullable: true }) lastMessageAt: string | null;
  @Field() createdAt: string;
}

@ObjectType('ChatMember')
export class ChatMemberGql implements ChatMemberResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @Field(() => String) role: ChatMemberRole;
  @Field() joinedAt: string;
}

@ObjectType('ChatReaction')
export class ChatReactionGql implements ChatReactionSummary {
  @Field() emoji: string;
  @Field(() => Int) count: number;
  @Field({ description: 'You reacted with this one' }) mine: boolean;
  @Field(() => [String], { description: 'Up to five names, for a tooltip' }) names: string[];
}

@ObjectType('ChatMessage')
export class ChatMessageGql implements ChatMessageResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) channelId: string;
  @Field(() => ID, { nullable: true, description: 'The thread root, for replies' }) parentId: string | null;
  @Field(() => ID, { nullable: true }) authorId: string | null;
  @Field(() => String, { nullable: true }) authorName: string | null;
  @Field(() => String, { description: 'user, or system for lines such as "created #123"' }) kind: 'user' | 'system';
  @Field({ description: 'Markdown. Render without raw HTML. Empty once deleted' }) body: string;
  @Field(() => ID, { nullable: true, description: 'The task a system line refers to' }) taskId: string | null;
  @Field(() => Int) replyCount: number;
  @Field(() => String, { nullable: true }) lastReplyAt: string | null;
  @Field(() => String, { nullable: true }) editedAt: string | null;
  @Field() deleted: boolean;
  @Field() createdAt: string;
  @Field(() => [ChatReactionGql]) reactions: ChatReactionGql[];
}

@ObjectType('ChatMessagePage')
export class ChatMessagePageGql implements ChatMessagePage {
  @Field(() => [ChatMessageGql]) items: ChatMessageGql[];
  @Field(() => String, { nullable: true, description: 'Pass back for the next page; null when there is none' }) cursor: string | null;
}

@InputType('CreateChatChannelInput')
export class CreateChatChannelInput {
  @Field() @IsString() @IsNotBlank() @MaxLength(CHAT_CHANNEL_NAME_MAX) name: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(CHAT_TOPIC_MAX) topic?: string;
  @Field(() => String, { defaultValue: 'public' }) @IsIn(['public', 'private']) kind: 'public' | 'private' = 'public';
  @Field(() => [ID], { nullable: true }) @IsClearable() @IsArray() @ArrayMaxSize(CHAT_ADD_MEMBERS_MAX) @IsString({ each: true }) @MaxLength(64, { each: true }) memberIds?: string[] | null;
}

@InputType('UpdateChatChannelInput')
export class UpdateChatChannelInput {
  @Field({ nullable: true }) @IsOmittable() @IsString() @IsNotBlank() @MaxLength(CHAT_CHANNEL_NAME_MAX) name?: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(CHAT_TOPIC_MAX) topic?: string;
}

@InputType('SendChatMessageInput')
export class SendChatMessageInput {
  @Field(() => ID) @IsUUID() channelId: string;
  @Field() @IsString() @MaxLength(CHAT_MESSAGE_MAX + 200) body: string;
  @Field(() => ID, { nullable: true, description: 'Reply in the thread of this message' }) @IsClearable() @IsUUID() parentId?: string | null;
}

@InputType('CreateTaskFromMessageInput')
export class CreateTaskFromMessageInput {
  @Field(() => ID) @IsUUID() messageId: string;
  @Field(() => ID) @IsUUID() listId: string;
  @Field({ nullable: true, description: 'Defaults to the first line of the message' }) @IsOmittable() @IsString() @MaxLength(200) title?: string;
}
