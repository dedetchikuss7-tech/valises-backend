import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
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
import { AdminTransactionOperationalPlaybooksService } from './admin-transaction-operational-playbooks.service';
import { ListAdminTransactionOperationalPlaybooksQueryDto } from './dto/list-admin-transaction-operational-playbooks-query.dto';
import { TransactionOperationalPlaybookResponseDto } from './dto/admin-transaction-operational-playbook.dto';
import { AdminTransactionOperationalPlaybookSummaryDto } from './dto/admin-transaction-operational-playbook-summary.dto';

@ApiTags('Admin Transaction Operational Playbooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/transaction-operations/playbooks')
export class AdminTransactionOperationalPlaybooksController {
  constructor(
    private readonly playbooksService: AdminTransactionOperationalPlaybooksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List transaction operational playbooks',
    description:
      'Admin-only read model that converts transaction operational queue signals into playbooks, blockers, automation candidates, readiness flags and next-best admin actions.',
  })
  @ApiOkResponse({
    description: 'Transaction operational playbooks',
    type: TransactionOperationalPlaybookResponseDto,
    isArray: true,
  })
  list(@Query() query: ListAdminTransactionOperationalPlaybooksQueryDto) {
    return this.playbooksService.list(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get transaction operational playbook summary',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationalPlaybookSummaryDto,
  })
  summary() {
    return this.playbooksService.summary();
  }

  @Get('transactions/:transactionId')
  @ApiOperation({
    summary: 'Get playbook for one transaction',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiOkResponse({
    type: TransactionOperationalPlaybookResponseDto,
  })
  async getOne(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    const result = await this.playbooksService.list({
      q: transactionId,
      limit: 1,
      offset: 0,
    });

    return result.items[0] ?? null;
  }
}