import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { FinancialAuditService } from './financial-audit.service';

@ApiTags('admin-financial-audit')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/financial-audit')
export class FinancialAuditController {
  constructor(private readonly financialAuditService: FinancialAuditService) {}

  @Get('transaction/:id')
  @ApiOperation({
    summary: 'Full financial audit snapshot for a transaction',
    description:
      'Returns all financial data linked to a transaction: ledger entries, payment attempts, payouts, dispute, reconciliation cases, compensation requests, and fraud flags for both parties. Access is logged.',
  })
  async getTransactionSnapshot(@Param('id') id: string, @Req() req: any) {
    return this.financialAuditService.getTransactionAuditSnapshot(id, req.user.userId);
  }
}
