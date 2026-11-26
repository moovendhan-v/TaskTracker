import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BUG_KINDS, BUG_LIMITS, INTAKE_LIMITS, type BugKind, type PublicBugView, type PublicIntakeConfig, type PublicReportRequest, type PublicReportResponse } from '@taskflow/shared-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { BugContextInput } from '../../../bugs/presentation/graphql/bugs.types.js';
import { BugIntakeService } from '../../application/bug-intake.service.js';
import { BugSharesService } from '../../application/bug-shares.service.js';

class PublicReportBody implements PublicReportRequest {
  @IsIn(['widget', 'portal']) via: 'widget' | 'portal';
  @IsOptional() @IsIn(BUG_KINDS) kind?: BugKind | null;
  @IsString() @MaxLength(BUG_LIMITS.title) title: string;
  @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) actual?: string | null;
  @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) expected?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(BUG_LIMITS.stepText, { each: true }) steps?: string[] | null;
  @IsOptional() @IsString() @MaxLength(INTAKE_LIMITS.reporterName) name?: string | null;
  @IsOptional() @IsString() @MaxLength(INTAKE_LIMITS.reporterEmail) email?: string | null;
  @IsOptional() @ValidateNested() @Type(() => BugContextInput) context?: BugContextInput | null;
  @IsOptional() @IsString() @MaxLength(BUG_LIMITS.captureJson) captureJson?: string | null;
  @IsOptional() @IsString() @MaxLength(Math.ceil((INTAKE_LIMITS.screenshotBytes * 4) / 3) + 40) screenshot?: string | null;
  @IsOptional() @IsString() @MaxLength(2048) captchaToken?: string | null;
  @IsOptional() @IsString() @MaxLength(200) website?: string | null;
}

/**
 * Public on purpose: the feedback widget runs on customers' sites and the portal and report links
 * are opened by people without a TaskFlow account. Every route is keyed (project key, link token),
 * validated, throttled per IP, and answers "not found" for anything unknown, off, expired or
 * revoked. The report route also checks origin, CAPTCHA and a per-project hourly cap. CORS for
 * /api/public is open (no credentials), see security.bootstrap.
 */
@Public()
@Controller('public')
export class PublicFeedbackController {
  constructor(
    private readonly intake: BugIntakeService,
    private readonly shares: BugSharesService,
  ) {}

  @Get('intake/:key')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  config(@Param('key') key: string): Promise<PublicIntakeConfig> {
    return this.intake.publicConfig(key);
  }

  @Post('intake/:key/reports')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  report(@Param('key') key: string, @Body() body: PublicReportBody, @Req() request: Request): Promise<PublicReportResponse> {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : null;
    return this.intake.submit(key, body, { origin, ip: request.ip ?? null });
  }

  @Get('shares/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  share(@Param('token') token: string): Promise<PublicBugView> {
    return this.shares.view(token);
  }
}
