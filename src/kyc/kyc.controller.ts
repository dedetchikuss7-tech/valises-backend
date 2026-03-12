import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { KycService } from './kyc.service';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Patch('users/:id/status')
  async updateUserKycStatus(@Param('id') id: string, @Body() body: UpdateKycStatusDto) {
    return this.kyc.setUserKycStatus(id, body.kycStatus);
  }
}