import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminLedgerIntegrityService } from './admin-ledger-integrity.service';
import {
  LedgerIntegritySortBy,
  LedgerIntegrityStatus,
  ListLedgerMismatchesQueryDto,
  SortOrder,
} from './dto/list-ledger-mismatches-query.dto';

@ApiTags('Admin Ledger Integrity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/ledger-integrity')
export class AdminLedgerIntegrityController {
  constructor(
    private readonly adminLedgerIntegrityService: AdminLedgerIntegrityService,
  ) {}

  @Get('transactions/:transactionId')
  @ApiOperation({
    summary: 'Get ledger integrity for one transaction',
    description:
      'Admin-only endpoint comparing transaction.escrowAmount against ledger-derived escrow balance and surfacing payout/refund/commission/reserve integrity signals.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  async getTransactionIntegrity(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.adminLedgerIntegrityService.getTransactionIntegrity(
      transactionId,
    );
  }

  @Get('mismatches')
  @ApiOperation({
    summary: 'List ledger integrity mismatches',
    description:
      'Admin-only endpoint listing transactions with ledger integrity warnings or breaches. By default OK rows are excluded.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: LedgerIntegrityStatus,
  })
  @ApiQuery({
    name: 'includeOk',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'requiresAction',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: LedgerIntegritySortBy,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SortOrder,
  })
  @ApiQuery({
    name: 'inspectLimit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  async listMismatches(@Query() query: ListLedgerMismatchesQueryDto) {
    return this.adminLedgerIntegrityService.listMismatches(query);
  }
}