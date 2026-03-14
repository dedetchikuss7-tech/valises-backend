import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { TransactionService } from './transaction.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post()
  @ApiOperation({
    summary: 'Create a transaction',
    description:
      'Creates a transaction from the authenticated sender using a trip, package, and amount.',
  })
  @ApiBody({ type: CreateTransactionDto })
  async create(@Req() req: any, @Body() body: CreateTransactionDto) {
    return this.service.create(this.userId(req), body);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description: 'Returns all transactions with related sender, traveler, trip, package, and corridor data.',
  })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one transaction',
    description: 'Returns a single transaction with related entities.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update transaction business status',
    description:
      'Updates the transaction business status such as CREATED, PAID, IN_TRANSIT, DELIVERED, CANCELLED, or DISPUTED.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: UpdateTransactionStatusDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateTransactionStatusDto,
  ) {
    return this.service.updateStatus(id, body.status as TransactionStatus);
  }

  @Patch(':id/release')
  @ApiOperation({
    summary: 'Release transaction funds',
    description:
      'Requests or completes release of escrowed funds depending on the current payout orchestration flow.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async release(@Param('id') id: string) {
    return this.service.releaseFunds(id);
  }

  @Patch(':id/payment/:status')
  @ApiOperation({
    summary: 'Mark payment status',
    description:
      'Marks the payment status for a transaction. Supported route values: success, failed, pending.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiParam({
    name: 'status',
    description: 'Payment status route value',
    enum: ['success', 'failed', 'pending'],
  })
  async markPayment(@Param('id') id: string, @Param('status') status: string) {
    const value =
      status === 'success'
        ? PaymentStatus.SUCCESS
        : status === 'failed'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;

    return this.service.markPayment(id, value);
  }

  @Get(':id/ledger')
  @ApiOperation({
    summary: 'Get transaction ledger',
    description:
      'Returns the ledger entries linked to a transaction for escrow and audit visibility.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async ledger(@Param('id') id: string) {
    return this.service.getLedger(id);
  }
}