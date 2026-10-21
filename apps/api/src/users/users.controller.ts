import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { SessionUser } from '../common/http/authenticated-request.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from './dto/current-user.dto.js';

@ApiTags('users')
@ApiCookieAuth()
@Controller('me')
export class UsersController {
  @Get()
  @ApiOkResponse({ type: CurrentUserDto })
  me(@CurrentUser() user: SessionUser): CurrentUserDto {
    return { id: user.id, name: user.name, email: user.email, image: user.image, platformRole: user.platformRole };
  }
}
