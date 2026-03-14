import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AbandonmentKind,
  KycStatus,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PaymentStatus,
  Transaction,
  TransactionStatus,
} from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { PayoutService } from '../payout/payout.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly abandonment: AbandonmentService,
    private readonly payoutService: PayoutService,
  ) {}

  private static readonly MAX_PER_TX_VERIFIED_XAF = 2_000_000;

  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    if (!senderId) {
      throw new BadRequestException('senderId is required');
    }
    if (!dto?.tripId || !dto?.packageId) {
      throw new BadRequestException('tripId and packageId are required');
    }
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }

    if (dto.amount > TransactionService.MAX_PER_TX_VERIFIED_XAF) {
      throw new BadRequestException({
        code: 'LIMIT_EXCEEDED',
        message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
        amount: dto.amount,
        maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
      });
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true },
    });
    if (!sender) throw new NotFoundException(`Sender ${senderId} not found`);

    const created = await this.prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: dto.tripId } });
      if (!trip) throw new NotFoundException('Trip not found');

      if (trip.status !== 'ACTIVE') {
        throw new BadRequestException('Trip must be ACTIVE');
      }

      const pkg = await tx.package.findUnique({ where: { id: dto.packageId } });
      if (!pkg) throw new NotFoundException('Package not found');

      if (pkg.senderId !== senderId) {
        throw new ForbiddenException('You are not the sender of this package');
      }

      if (pkg.status !== 'PUBLISHED') {
        throw new BadRequestException('Package must be PUBLISHED');
      }

      if (pkg.corridorId !== trip.corridorId) {
        throw new BadRequestException('Trip and Package corridors do not match');
      }

      const existing = await tx.transaction.findFirst({
        where: {
          packageId: pkg.id,
          NOT: { status: TransactionStatus.CANCELLED },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        throw new BadRequestException(
          `Package already linked to a transaction (${existing.status})`,
        );
      }

      await tx.package.update({
        where: { id: pkg.id },
        data: { status: 'RESERVED' as any },
      });

      return tx.transaction.create({
        data: {
          senderId,
          travelerId: trip.carrierId,
          tripId: trip.id,
          packageId: pkg.id,
          corridorId: trip.corridorId,
          amount: dto.amount,
          commission: 0,
          escrowAmount: 0,
          status: TransactionStatus.CREATED,
          paymentStatus: PaymentStatus.PENDING,
        },
      });
    });

    await this.abandonment.markAbandoned(
      { userId: senderId, role: 'USER' },
      {
        kind: AbandonmentKind.PAYMENT_PENDING,
        transactionId: created.id,
        metadata: {
          step: 'transaction_created',
          amount: created.amount,
        },
      },
    );

    return created;
  }

  async findAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, email: true, role: true, kycStatus: true } },
        traveler: { select: { id: true, email: true, role: true, kycStatus: true } },
        trip: {
          select: {
            id: true,
            status: true,
            flightTicketStatus: true,
            departAt: true,
            corridorId: true,
            carrierId: true,
          },
        },
        package: {
          select: {
            id: true,
            status: true,
            weightKg: true,
            description: true,
            corridorId: true,
            senderId: true,
          },
        },
        corridor: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        payout: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.transaction.findUniqueOrThrow({
      where: { id },
      include: {
        sender: { select: { id: true, email: true, role: true, kycStatus: true } },
        traveler: { select: { id: true, email: true, role: true, kycStatus: true } },
        trip: {
          select: {
            id: true,
            status: true,
            flightTicketStatus: true,
            departAt: true,
            corridorId: true,
            carrierId: true,
          },
        },
        package: {
          select: {
            id: true,
            status: true,
            weightKg: true,
            description: true,
            corridorId: true,
            senderId: true,
          },
        },
        corridor: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        payout: true,
      },
    });
  }

  async updateStatus(id: string, status: TransactionStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    return this.prisma.transaction.update({
      where: { id },
      data: { status },
    });
  }

  async markPayment(id: string, paymentStatus: PaymentStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    if (
      tx.paymentStatus === PaymentStatus.SUCCESS &&
      paymentStatus === PaymentStatus.SUCCESS
    ) {
      return tx;
    }

    if (paymentStatus === PaymentStatus.SUCCESS) {
      const traveler = await this.prisma.user.findUnique({
        where: { id: tx.travelerId },
        select: { id: true, kycStatus: true },
      });

      if (!traveler) throw new NotFoundException(`Traveler ${tx.travelerId} not found`);

      if (traveler.kycStatus !== KycStatus.VERIFIED) {
        throw new BadRequestException({
          code: 'KYC_REQUIRED',
          message: 'Traveler KYC must be VERIFIED before payment can be confirmed.',
          nextStep: 'KYC',
          nextStepUrl: '/kyc',
          travelerId: traveler.id,
          kycStatus: traveler.kycStatus,
        });
      }

      if (tx.amount > TransactionService.MAX_PER_TX_VERIFIED_XAF) {
        throw new BadRequestException({
          code: 'LIMIT_EXCEEDED',
          message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
          amount: tx.amount,
          maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
        });
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        paymentStatus,
        status: paymentStatus === PaymentStatus.SUCCESS ? TransactionStatus.PAID : tx.status,
        escrowAmount: paymentStatus === PaymentStatus.SUCCESS ? tx.amount : tx.escrowAmount,
      },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      await this.ledger.addEntryIdempotent({
        transactionId: id,
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: tx.amount,
        currency: 'XAF',
        note: 'Payment confirmed: escrow credited',
        idempotencyKey: `payment_success:${id}`,
        source: LedgerSource.PAYMENT,
        referenceType: LedgerReferenceType.PAYMENT,
        referenceId: `payment_success:${id}`,
        actorUserId: null,
      });

      await this.abandonment.resolveActiveByReference({
        userId: tx.senderId,
        kind: AbandonmentKind.PAYMENT_PENDING,
        transactionId: tx.id,
      });
    } else {
      await this.abandonment.markAbandoned(
        { userId: tx.senderId, role: 'USER' },
        {
          kind: AbandonmentKind.PAYMENT_PENDING,
          transactionId: tx.id,
          metadata: {
            step: 'payment_not_completed',
            paymentStatus,
          },
        },
      );
    }

    return updated;
  }

  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { payout: true },
    });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Cannot request payout: paymentStatus is not SUCCESS');
    }
    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Cannot request payout: transaction must be DELIVERED');
    }

    const balance = await this.ledger.getEscrowBalance(id);
    if (balance <= 0) {
      return {
        ok: true,
        transactionId: id,
        payout: tx.payout ?? null,
        releasedAmount: 0,
        escrowBalance: balance,
      };
    }

    const payout = await this.payoutService.requestPayoutForTransaction(id);

    return {
      ok: true,
      transactionId: id,
      payout,
      releasedAmount: 0,
      escrowBalance: balance,
      message: 'Payout requested. Escrow will be debited only when payout is marked PAID.',
    };
  }

  async getLedger(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    const entries = await this.ledger.listByTransaction(id);

    return {
      transactionId: id,
      entries: entries.map((e) => ({
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        createdAt: e.createdAt,
        note: e.note ?? null,
        idempotencyKey: e.idempotencyKey ?? null,
        source: (e as any).source ?? null,
        referenceType: (e as any).referenceType ?? null,
        referenceId: (e as any).referenceId ?? null,
        actorUserId: (e as any).actorUserId ?? null,
      })),
    };
  }
}