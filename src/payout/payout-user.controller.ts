import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PayoutUserService } from './payout-user.service';
import { PayoutHistoryQueryDto } from './dto/payout-history-query.dto';

@ApiTags('payouts')
@ApiBearerAuth()
@Roles('USER', 'ADMIN')
@Controller('payouts')
export class PayoutUserController {
  constructor(private readonly payoutUserService: PayoutUserService) {}

  @Get('my-history')
  @ApiOperation({ summary: 'Paginated payout history for the authenticated traveler' })
  async getMyHistory(@Query() query: PayoutHistoryQueryDto, @Req() req: any) {
    return this.payoutUserService.getMyHistory(req.user.userId, query);
  }

  @Get('my-next-eligible')
  @ApiOperation({ summary: 'Next eligible payout for the authenticated traveler' })
  async getNextEligible(@Req() req: any) {
    return this.payoutUserService.getNextEligible(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Payout detail (owner only)' })
  async getPayoutById(@Param('id') payoutId: string, @Req() req: any) {
    return this.payoutUserService.getPayoutById(payoutId, req.user.userId);
  }
}
