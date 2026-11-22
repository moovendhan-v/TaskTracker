import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { AiProviderOption, AiSettingsResponse, AiSummaryResponse, UpdateAiSettingsRequest } from '@taskflow/shared-types';

@ObjectType('AiProviderOption', { description: 'A provider the server has configured (never its URL or key)' })
export class AiProviderOptionGql implements AiProviderOption {
  @Field() id: string;
  @Field() label: string;
  @Field(() => [String]) models: string[];
}

@ObjectType('AiSettings')
export class AiSettingsGql implements AiSettingsResponse {
  @Field({ description: 'The server has at least one AI provider configured' }) available: boolean;
  @Field() enabled: boolean;
  @Field(() => String, { nullable: true }) providerId: string | null;
  @Field(() => String, { nullable: true }) model: string | null;
  @Field(() => [AiProviderOptionGql]) providers: AiProviderOptionGql[];
  @Field(() => Int, { description: 'Your AI budget per day in this workspace (tokens)' }) dailyTokens: number;
  @Field(() => Int) usedToday: number;
}

@InputType()
export class UpdateAiSettingsInput implements UpdateAiSettingsRequest {
  @Field() @IsBoolean() enabled: boolean;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @Matches(/^[a-z][a-z0-9_]{0,23}$/) providerId?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(120) model?: string | null;
}

@ObjectType('AiSummary')
export class AiSummaryGql implements AiSummaryResponse {
  @Field({ description: 'Plain text written by a model: render as text, never HTML' }) text: string;
  @Field() providerLabel: string;
  @Field() model: string;
  @Field(() => Int) tokens: number;
  @Field(() => Int) usedToday: number;
  @Field(() => Int) dailyTokens: number;
}
