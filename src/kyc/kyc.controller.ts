import { Body, Controller, Param, Patch } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycStatus } from '@prisma/client';

type UpdateKycStatusBody = {
  kycStatus: KycStatus;
};

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  // PATCH /kyc/users/:id/status
  @Patch('users/:id/status')
  async updateUserKycStatus(@Param('id') id: string, @Body() body: UpdateKycStatusBody) {
    return this.kyc.setUserKycStatus(id, body.kycStatus);
  }
}