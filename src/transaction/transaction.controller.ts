import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { TransactionService } from './transaction.service';

class CreateTransactionDto {
  senderId: string;
  travelerId: string;
  totalAmount: number;
}

class UpdateStatusDto {
  status: TransactionStatus;
}

@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @Post()
  create(@Body() body: CreateTransactionDto) {
    return this.service.create(body.senderId, body.travelerId, body.totalAmount);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.service.updateStatus(id, body.status);
  }

  @Patch(':id/release')
  releaseFunds(@Param('id') id: string) {
    return this.service.releaseFunds(id);
  }
}