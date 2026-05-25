import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PayoutAutoService } from './payout-auto.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('admin-payout-auto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/payout-auto')
export class PayoutAutoController {
  constructor(private readonly payoutAutoService: PayoutAutoService) {}

  @Post('run-eligibility-batch')
  async runBatch() {
    return this.payoutAutoService.markEligibleBatch();
  }

  @Get('eligible-queue')
  async getQueue() {
    return this.payoutAutoService.getEligibleQueue();
  }

  @Post('approve')
  async approve(@Body() body: { payoutIds: string[] }, @Request() req: any) {
    return this.payoutAutoService.approveEligible(body.payoutIds, req.user.sub);
  }
}
