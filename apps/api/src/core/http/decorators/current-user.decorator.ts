import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '../types/authenticated-request.js';
import { getRequest } from '../request-context.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => getRequest(ctx).user);
