import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { KycRetryService } from './kyc-retry.service';

@ApiTags('kyc')
@ApiBearerAuth()
@Controller('kyc')
export class KycRetryController {
  constructor(private readonly kycRetryService: KycRetryService) {}

  @Post('retry')
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Retry KYC from REJECTED status (max 3 attempts)' })
  async retry(@Req() req: any) {
    return this.kycRetryService.retryKyc(req.user.userId);
  }

  @Get('status')
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Get detailed KYC status including attempt count and rejection reason' })
  async getStatus(@Req() req: any) {
    return this.kycRetryService.getKycStatus(req.user.userId);
  }
}

@ApiTags('admin-kyc')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/kyc')
export class KycAdminController {
  constructor(private readonly kycRetryService: KycRetryService) {}

  @Post(':userId/override')
  @ApiOperation({ summary: 'Override KYC status (reason mandatory, immutable audit trail)' })
  async override(
    @Param('userId') userId: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; reason: string },
    @Req() req: any,
  ) {
    return this.kycRetryService.adminOverrideKyc(
      userId,
      req.user.userId,
      body.status,
      body.reason,
    );
  }
}
