import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminUserListQueryDto } from './dto/admin-user-list.dto';
import { AdminKycOverrideDto } from './dto/admin-kyc-override.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated user list with filters' })
  async listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full user profile for admin' })
  async getUserProfile(@Param('id') userId: string) {
    return this.adminUsersService.getUserProfile(userId);
  }

  @Patch(':id/kyc-status')
  @ApiOperation({ summary: 'Override KYC status with mandatory reason' })
  async overrideKycStatus(
    @Param('id') userId: string,
    @Body() dto: AdminKycOverrideDto,
    @Req() req: any,
  ) {
    return this.adminUsersService.overrideKycStatus(userId, req.user.userId, dto);
  }
}
