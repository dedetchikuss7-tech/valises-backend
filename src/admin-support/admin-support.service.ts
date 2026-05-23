import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutProvider,
  ProviderEventObjectType,
  RefundProvider,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import {
  AddSupportNoteDto,
  SupportNoteTargetType,
} from './dto/add-support-note.dto';
import { SupportNoteResponseDto } from './dto/support-note-response.dto';

export interface TransactionSearchQuery {
  email?: string;
  status?: TransactionStatus;
  corridorCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
  ) {}

  async addSupportNote(
    authorId: string,
    dto: AddSupportNoteDto,
  ): Promise<SupportNoteResponseDto> {
    const note = await this.prisma.supportNote.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        authorId,
        content: dto.content,
        isInternal: dto.isInternal ?? true,
      },
    });
    return note;
  }

  async getSupportNotes(
    targetType: SupportNoteTargetType,
    targetId: string,
  ): Promise<SupportNoteResponseDto[]> {
    return this.prisma.supportNote.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchTransactions(
    query: TransactionSearchQuery,
  ): Promise<PaginatedListResponseDto<Record<string, unknown>>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const emailFilter = query.email
      ? {
          OR: [
            {
              sender: {
                email: { contains: query.email, mode: 'insensitive' as const },
              },
            },
            {
              traveler: {
                email: { contains: query.email, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {};

    const where = {
      ...emailFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(query.corridorCode
        ? { corridor: { code: query.corridorCode } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: {
          sender: { select: { id: true, email: true } },
          traveler: { select: { id: true, email: true } },
          corridor: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
      items: items as unknown as Record<string, unknown>[],
    };
  }

  async getTransactionSupportView(transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: { select: { id: true, email: true, role: true, kycStatus: true } },
        traveler: { select: { id: true, email: true, role: true, kycStatus: true } },
        package: true,
        trip: true,
        ledgerEntries: { orderBy: { createdAt: 'asc' } },
        payout: {
          include: {
            providerEvents: { orderBy: { occurredAt: 'asc' } },
          },
        },
        refund: {
          include: {
            providerEvents: { orderBy: { occurredAt: 'asc' } },
          },
        },
        disputes: {
          include: {
            resolution: true,
            caseNotes: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        amlCase: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    const [fraudFlags, supportNotes] = await Promise.all([
      this.prisma.fraudFlag.findMany({
        where: { userId: { in: [tx.senderId, tx.travelerId] } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportNote.findMany({
        where: { targetType: 'TRANSACTION', targetId: transactionId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { ...tx, fraudFlags, supportNotes };
  }

  async resendWebhookEvent(providerEventId: string) {
    const event = await this.prisma.providerEvent.findUnique({
      where: { id: providerEventId },
    });

    if (!event) {
      throw new NotFoundException(
        `ProviderEvent not found: ${providerEventId}`,
      );
    }

    const resendKey = `${event.idempotencyKey}_resend_${Date.now()}`;

    if (event.objectType === ProviderEventObjectType.PAYOUT) {
      return this.payoutService.ingestProviderEvent({
        provider: event.provider as PayoutProvider,
        eventType: event.eventType,
        idempotencyKey: resendKey,
        payoutId: event.payoutId ?? null,
        transactionId: event.transactionId ?? null,
        externalReference: event.externalReference ?? null,
        occurredAt: event.occurredAt.toISOString(),
        payload: (event.payload as Record<string, unknown>) ?? undefined,
        actorUserId: null,
      });
    }

    if (event.objectType === ProviderEventObjectType.REFUND) {
      return this.refundService.ingestProviderEvent({
        provider: event.provider as RefundProvider,
        eventType: event.eventType,
        idempotencyKey: resendKey,
        refundId: event.refundId ?? null,
        transactionId: event.transactionId ?? null,
        externalReference: event.externalReference ?? null,
        occurredAt: event.occurredAt.toISOString(),
        payload: (event.payload as Record<string, unknown>) ?? undefined,
        actorUserId: null,
      });
    }

    throw new BadRequestException(
      `Cannot resend event with objectType: ${event.objectType}`,
    );
  }
}
