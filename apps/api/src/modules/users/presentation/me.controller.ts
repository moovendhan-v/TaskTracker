import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../core/http/decorators/current-user.decorator.js';
import type { SessionUser } from '../../../core/http/types/authenticated-request.js';
import { CurrentUserResponseDto } from './dto/current-user.response.dto.js';

@ApiTags('users')
@ApiCookieAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({ type: CurrentUserResponseDto })
  me(@CurrentUser() user: SessionUser): CurrentUserResponseDto {
    return { id: user.id, name: user.name, email: user.email, image: user.image, platformRole: user.platformRole };
  }
}
