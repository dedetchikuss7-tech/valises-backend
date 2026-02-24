import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { KycReleaseGuard } from '../kyc/guards/kyc-release.guard';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @Post()
  async create(@Body() body: CreateTransactionDto) {
    return this.service.create(body.senderId, body.travelerId, body.amount);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateTransactionStatusDto) {
    return this.service.updateStatus(id, body.status);
  }

  @Patch(':id/release')
  @UseGuards(KycReleaseGuard)
  async release(@Param('id') id: string) {
    return this.service.releaseFunds(id);
  }

  @Patch(':id/payment/:status')
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
  async ledger(@Param('id') id: string) {
    return this.service.getLedger(id);
  }
}