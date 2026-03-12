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
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Post()
  async create(@Req() req: any, @Body() body: CreateTransactionDto) {
    return this.service.create(this.userId(req), body);
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
    return this.service.updateStatus(id, body.status as TransactionStatus);
  }

  @Patch(':id/release')
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