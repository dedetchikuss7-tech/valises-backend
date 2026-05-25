import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PROTECTION_MAX_AMOUNT_XAF = parseInt(process.env.PROTECTION_MAX_AMOUNT_XAF ?? '50000', 10);

const CLAIM_WINDOW_DAYS = 7;

@Injectable()
export class CompensationService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(params: {
    transactionId: string;
    requestedById: string;
    type: 'LOST' | 'DAMAGED' | 'DELAYED';
    declaredValue?: number;
    description: string;
    evidenceUrls?: string[];
  }) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: params.transactionId },
      include: { compensationRequests: true },
    });

    if (!tx) throw new NotFoundException('Transaction not found');

    if (!['DELIVERED', 'DISPUTED'].includes(tx.status)) {
      throw new BadRequestException(
        'Protection Valises can only be requested for DELIVERED or DISPUTED transactions',
      );
    }

    if (tx.senderId !== params.requestedById) {
      throw new ForbiddenException(
        'Only the sender can request Protection Valises',
      );
    }

    const confirmedAt = (tx as any).deliveryConfirmedAt;
    if (!confirmedAt) {
      throw new BadRequestException('Transaction has no confirmed delivery date');
    }

    const claimWindowMs = CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(confirmedAt).getTime() > claimWindowMs) {
      throw new BadRequestException(
        `Protection Valises must be requested within ${CLAIM_WINDOW_DAYS} days of delivery confirmation`,
      );
    }

    if (tx.compensationRequests.length > 0) {
      throw new BadRequestException(
        'A Protection Valises request already exists for this transaction',
      );
    }

    if (params.declaredValue !== undefined && params.declaredValue > PROTECTION_MAX_AMOUNT_XAF) {
      throw new BadRequestException(
        `Declared value cannot exceed ${PROTECTION_MAX_AMOUNT_XAF} XAF`,
      );
    }

    return this.prisma.compensationRequest.create({
      data: {
        transactionId: params.transactionId,
        requestedById: params.requestedById,
        type: params.type,
        declaredValue: params.declaredValue,
        description: params.description,
        evidenceUrls: params.evidenceUrls ?? [],
        status: 'PENDING_REVIEW',
      },
    });
  }

  async getMyRequests(userId: string) {
    return this.prisma.compensationRequest.findMany({
      where: { requestedById: userId },
      include: {
        transaction: { select: { id: true, status: true, deliveryConfirmedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingRequests() {
    return this.prisma.compensationRequest.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'UNDER_INVESTIGATION'] } },
      include: {
        transaction: { select: { id: true, status: true, amount: true } },
        requestedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewRequest(params: {
    compensationId: string;
    adminId: string;
    decision: 'APPROVED' | 'REJECTED' | 'UNDER_INVESTIGATION';
    adminNotes?: string;
    approvedAmount?: number;
  }) {
    const request = await this.prisma.compensationRequest.findUnique({
      where: { id: params.compensationId },
    });

    if (!request) throw new NotFoundException('Compensation request not found');

    if (['APPROVED', 'REJECTED', 'PAID'].includes(request.status)) {
      throw new BadRequestException('This request has already been reviewed');
    }

    if (
      params.approvedAmount !== undefined &&
      params.approvedAmount > PROTECTION_MAX_AMOUNT_XAF
    ) {
      throw new BadRequestException(
        `Approved amount cannot exceed ${PROTECTION_MAX_AMOUNT_XAF} XAF`,
      );
    }

    return this.prisma.compensationRequest.update({
      where: { id: params.compensationId },
      data: {
        status: params.decision,
        adminNotes: params.adminNotes,
        approvedAmount: params.approvedAmount,
        reviewedById: params.adminId,
        reviewedAt: new Date(),
      },
    });
  }
}
