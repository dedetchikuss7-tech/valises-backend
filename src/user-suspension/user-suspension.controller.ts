import { Controller, Post, Body, Param, Req, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { UserSuspensionService } from './user-suspension.service';

@ApiTags('admin-user-suspension')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class UserSuspensionController {
  constructor(private readonly suspensionService: UserSuspensionService) {}

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user (optionally with duration)' })
  async suspend(
    @Param('id') id: string,
    @Body() body: { reason: string; durationHours?: number },
    @Req() req: any,
  ) {
    return this.suspensionService.suspendUser(
      id,
      req.user.userId,
      body.reason,
      body.durationHours,
    );
  }

  @Post(':id/unsuspend')
  @ApiOperation({ summary: 'Lift a user suspension' })
  async unsuspend(@Param('id') id: string, @Req() req: any) {
    return this.suspensionService.unsuspendUser(id, req.user.userId);
  }

  @Post(':id/ban')
  @ApiOperation({ summary: 'Permanently ban a user' })
  async ban(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.suspensionService.banUser(id, req.user.userId, body.reason);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get suspension/ban status for a user' })
  async getStatus(@Param('id') id: string) {
    return this.suspensionService.getUserStatus(id);
  }
}
