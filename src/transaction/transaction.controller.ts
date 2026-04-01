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
import { TransactionLedgerResponseDto } from './dto/transaction-ledger-response.dto';
import { TransactionReadResponseDto } from './dto/transaction-read-response.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { ConfirmDeliveryCodeDto } from './dto/confirm-delivery-code.dto';
import { GenerateDeliveryCodeResponseDto } from './dto/generate-delivery-code-response.dto';
import { ConfirmDeliveryCodeResponseDto } from './dto/confirm-delivery-code-response.dto';
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
      'Updates the transaction business status such as CREATED, PAID, CANCELLED, or DISPUTED. IN_TRANSIT is not used in the current V1 flow, DELIVERED must be confirmed through the delivery code flow, and paid transactions cannot be cancelled through this generic status endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: UpdateTransactionStatusDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateTransactionStatusDto,
  ) {
    return this.service.updateStatus(id, body.status as TransactionStatus);
  }

  @Post(':id/cancel-before-departure')
  @ApiOperation({
    summary: 'Cancel a paid transaction before departure',
    description:
      'Dedicated pre-departure cancellation flow for a paid transaction. Only the sender or an admin can trigger it. This endpoint cancels the transaction and creates a manual refund request. It must not be used after payout flow has started.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async cancelBeforeDeparture(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelBeforeDeparture(
      id,
      this.userId(req),
      this.userRole(req),
    );
  }

  @Post(':id/cancel-before-departure/traveler')
  @ApiOperation({
    summary: 'Traveler cancels a paid transaction before departure',
    description:
      'Dedicated traveler-side pre-departure cancellation flow for a paid transaction. Only the traveler or an admin can trigger it. This endpoint cancels the transaction and creates a manual refund request. It must not be used after payout flow has started.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async cancelBeforeDepartureByTraveler(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.service.cancelBeforeDepartureByTraveler(
      id,
      this.userId(req),
      this.userRole(req),
    );
  }

  @Post(':id/delivery-code')
  @ApiOperation({
    summary: 'Generate or regenerate delivery code',
    description:
      'Generates or regenerates a one-time delivery code for a PAID transaction. ADMIN or the sender can perform this action.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiOkResponse({
    description: 'Generated delivery code',
    type: GenerateDeliveryCodeResponseDto,
  })
  async generateDeliveryCode(@Req() req: any, @Param('id') id: string) {
    return this.service.generateDeliveryCode(
      id,
      this.userId(req),
      this.userRole(req),
    );
  }

  @Patch(':id/confirm-delivery')
  @ApiOperation({
    summary: 'Confirm delivery with code',
    description:
      'Confirms final delivery for a PAID transaction using the one-time delivery code. ADMIN or the traveler can perform this action. A payout request is triggered automatically after successful delivery confirmation.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: ConfirmDeliveryCodeDto })
  @ApiOkResponse({
    description:
      'Delivery confirmed successfully and payout request triggered automatically',
    type: ConfirmDeliveryCodeResponseDto,
  })
  async confirmDelivery(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ConfirmDeliveryCodeDto,
  ) {
    return this.service.confirmDeliveryWithCode(
      id,
      this.userId(req),
      this.userRole(req),
      body.code,
    );
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
  @ApiOkResponse({
    description: 'Ledger view for a visible transaction',
    type: TransactionLedgerResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not visible to the requester',
  })
  async ledger(@Req() req: any, @Param('id') id: string) {
    return this.service.getLedger(id, this.userId(req), this.userRole(req));
  }
}