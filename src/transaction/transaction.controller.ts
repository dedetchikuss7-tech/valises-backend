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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentStatus, Role, TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionReadResponseDto } from './dto/transaction-read-response.dto';
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

  private userRole(req: any): Role {
    const role = req?.user?.role;
    if (!role) {
      throw new UnauthorizedException('Missing auth role');
    }
    return role as Role;
  }

  @Post()
  @ApiOperation({
    summary: 'Create a transaction with automatic pricing',
    description:
      'Creates a transaction from the authenticated sender using a trip and package. The transaction amount is computed automatically from the corridor pricing configuration and the package weight. The response includes both the created transaction and pricingDetails for frontend/debug visibility.',
  })
  @ApiBody({ type: CreateTransactionDto })
  async create(@Req() req: any, @Body() body: CreateTransactionDto) {
    return this.service.create(this.userId(req), body);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description:
      'Returns transactions visible to the authenticated user. ADMIN can see all transactions. USER can only see transactions where they are sender or traveler.',
  })
  @ApiOkResponse({
    description: 'Visible transactions for the authenticated user',
    type: TransactionReadResponseDto,
    isArray: true,
  })
  async findAll(@Req() req: any) {
    return this.service.findAll(this.userId(req), this.userRole(req));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one transaction',
    description:
      'Returns one transaction if visible to the authenticated user. ADMIN can access any transaction. USER can only access transactions where they are sender or traveler.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiOkResponse({
    description: 'Visible transaction for the authenticated user',
    type: TransactionReadResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not visible to the requester',
  })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(id, this.userId(req), this.userRole(req));
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
      'Returns the ledger entries linked to a transaction for escrow and audit visibility. ADMIN can access any ledger. USER can only access the ledger of transactions where they are sender or traveler.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async ledger(@Req() req: any, @Param('id') id: string) {
    return this.service.getLedger(id, this.userId(req), this.userRole(req));
  }
}