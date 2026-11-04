import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import {
  PULL_REQUEST_STATES,
  REPO_PATTERN,
  STATUS_CATEGORIES,
  TASK_PREFIX_PATTERN,
  type GithubConnectionResponse,
  type GithubSecretResponse,
  type GithubSyncSettings,
  type GithubSyncEventResponse,
  type GithubSyncOutcome,
  type GithubInboxPullRequestResponse,
  type PullRequestLinkResponse,
  type PullRequestState,
  type SaveGithubConnectionRequest,
  type StatusCategory,
} from '@taskflow/shared-types';
import { registerEnumType } from '@nestjs/graphql';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { StatusCategoryEnum } from '../../../../core/graphql/enums.js';
import { IsOmittable } from '../../../../core/graphql/validation.js';

const PullRequestStateEnum = Object.fromEntries(PULL_REQUEST_STATES.map((state) => [state, state])) as Record<PullRequestState, PullRequestState>;
registerEnumType(PullRequestStateEnum, { name: 'PullRequestState' });

@ObjectType('GithubSync')
export class GithubSyncGql implements GithubSyncSettings {
  @Field(() => StatusCategoryEnum, { nullable: true, description: 'Move linked tasks here when a pull request opens' }) onOpened: StatusCategory | null;
  @Field(() => StatusCategoryEnum, { nullable: true, description: 'Move linked tasks here when a pull request merges' }) onMerged: StatusCategory | null;
  @Field(() => StatusCategoryEnum, { nullable: true, description: 'Move linked tasks here when a pull request is closed without merging' }) onClosed?: StatusCategory | null;
}

@ObjectType('GithubSyncEvent', { description: 'What one webhook delivery did' })
export class GithubSyncEventGql implements GithubSyncEventResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) connectionId: string;
  @Field() event: string;
  @Field(() => String, { description: 'ok, ignored or error' }) outcome: GithubSyncOutcome;
  @Field() detail: string;
  @Field(() => Int, { nullable: true }) prNumber: number | null;
  @Field(() => [Int]) taskNumbers: number[];
  @Field() createdAt: string;
}

@ObjectType('GithubInboxPullRequest', { description: 'A pull request that mentions no task, waiting to be linked or dismissed' })
export class GithubInboxPullRequestGql implements GithubInboxPullRequestResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) connectionId: string;
  @Field() repo: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field() url: string;
  @Field() author: string;
  @Field() branch: string;
  @Field(() => PullRequestStateEnum) state: PullRequestState;
  @Field() updatedAt: string;
}

@ObjectType('GithubConnection')
export class GithubConnectionGql implements GithubConnectionResponse {
  @Field(() => ID) id: string;
  @Field() repo: string;
  @Field() taskPrefix: string;
  @Field(() => GithubSyncGql) sync: GithubSyncGql;
  @Field({ description: 'Prefix with the site origin for the GitHub webhook URL' }) webhookPath: string;
  @Field(() => String, { nullable: true, description: 'Linked tasks are moved as this person' }) createdById: string | null;
  @Field(() => String, { nullable: true }) lastDeliveryAt: string | null;
  @Field(() => String, { nullable: true }) lastDeliveryStatus: string | null;
  @Field() createdAt: string;
}

@ObjectType('GithubSecret', { description: 'Shown once; store it in the GitHub webhook settings' })
export class GithubSecretGql implements GithubSecretResponse {
  @Field(() => GithubConnectionGql) connection: GithubConnectionGql;
  @Field() webhookSecret: string;
}

@ObjectType('PullRequestLink')
export class PullRequestLinkGql implements PullRequestLinkResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) taskId: string;
  @Field() repo: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field() url: string;
  @Field(() => PullRequestStateEnum) state: PullRequestState;
  @Field() author: string;
  @Field() branch: string;
  @Field() updatedAt: string;
}

@InputType('GithubSyncInput')
export class GithubSyncInput implements Partial<GithubSyncSettings> {
  @Field(() => StatusCategoryEnum, { nullable: true }) @ValidateIf((_, value) => value !== null && value !== undefined) @IsIn(STATUS_CATEGORIES) onOpened?: StatusCategory | null;
  @Field(() => StatusCategoryEnum, { nullable: true }) @ValidateIf((_, value) => value !== null && value !== undefined) @IsIn(STATUS_CATEGORIES) onMerged?: StatusCategory | null;
  @Field(() => StatusCategoryEnum, { nullable: true }) @ValidateIf((_, value) => value !== null && value !== undefined) @IsIn(STATUS_CATEGORIES) onClosed?: StatusCategory | null;
}

@FormSchema('github.connect')
@InputType('ConnectGithubInput')
export class ConnectGithubInput implements SaveGithubConnectionRequest {
  @Field({ description: 'owner/name' }) @IsString() @MaxLength(201) @Matches(new RegExp(REPO_PATTERN), { message: 'Use the repository as owner/name, like acme/web' }) repo: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @Matches(new RegExp(TASK_PREFIX_PATTERN), { message: 'Letters and digits, starting with a letter, like TF' }) taskPrefix?: string;
  @Field(() => GithubSyncInput, { nullable: true }) @IsOmittable() @ValidateNested() @Type(() => GithubSyncInput) sync?: GithubSyncInput;
}

@InputType('UpdateGithubConnectionInput')
export class UpdateGithubConnectionInput implements Omit<SaveGithubConnectionRequest, 'repo'> {
  @Field({ nullable: true }) @IsOmittable() @IsString() @Matches(new RegExp(TASK_PREFIX_PATTERN), { message: 'Letters and digits, starting with a letter, like TF' }) taskPrefix?: string;
  @Field(() => GithubSyncInput, { nullable: true }) @IsOmittable() @ValidateNested() @Type(() => GithubSyncInput) sync?: GithubSyncInput;
}
