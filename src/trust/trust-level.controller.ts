import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TrustLevelService } from './trust-level.service';

@ApiTags('trust-level')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TrustLevelController {
  constructor(private readonly trustLevelService: TrustLevelService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Roles('USER', 'ADMIN')
  @Get('users/me/trust-profile')
  @ApiOperation({ summary: 'Get own computed trust level' })
  @ApiOkResponse({ description: 'Computed trust level for authenticated user' })
  async getMyTrustProfile(@Req() req: any) {
    return this.trustLevelService.computeTrustLevel(this.userId(req));
  }

  @Roles('ADMIN')
  @Get('trust/profile/:userId')
  @ApiOperation({ summary: 'Get trust level for any user (admin)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiOkResponse({ description: 'Computed trust level for specified user' })
  async getTrustProfile(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.trustLevelService.computeTrustLevel(userId);
  }
}
