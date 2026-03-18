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
import { ListLedgerMismatchesQueryDto } from './dto/list-ledger-mismatches-query.dto';

@ApiTags('Admin Ledger Integrity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/ledger-integrity')
export class AdminLedgerIntegrityController {
  constructor(
    private readonly adminLedgerIntegrityService: AdminLedgerIntegrityService,
  ) {}

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get ledger integrity for one transaction',
    description:
      'Admin-only endpoint comparing transaction.escrowAmount against the escrow balance computed from ledger entries.',
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
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List ledger integrity mismatches',
    description:
      'Admin-only endpoint listing transactions where stored escrowAmount differs from the escrow balance computed from ledger entries.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listMismatches(@Query() query: ListLedgerMismatchesQueryDto) {
    return this.adminLedgerIntegrityService.listMismatches(query.limit ?? 50);
  }
}