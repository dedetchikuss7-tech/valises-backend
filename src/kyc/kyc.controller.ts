import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update KYC status for a user (compat, tolerant)' })
  @ApiParam({ name: 'id', description: 'User ID (uuid)' })
  async updateKycStatus(@Param('id') id: string, @Body() dto: UpdateKycStatusDto) {
    return this.kycService.updateUserKycStatus(id, dto);
  }
}