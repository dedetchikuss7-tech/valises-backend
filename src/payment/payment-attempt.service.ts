import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentAttemptService {
  private readonly logger = new Logger(PaymentAttemptService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAttempt(params: {
    transactionId: string;
    attemptOrigin: 'INITIAL' | 'RETRY' | 'MANUAL';
    pspProvider?: string;
    metadata?: Record<string, any>;
  }) {
    const existingCount = await this.prisma.paymentAttempt.count({
      where: { transactionId: params.transactionId },
    });

    return this.prisma.paymentAttempt.create({
      data: {
        transactionId: params.transactionId,
        attemptNumber: existingCount + 1,
        attemptOrigin: params.attemptOrigin,
        pspProvider: params.pspProvider ?? 'CINETPAY',
        status: 'PENDING',
        requestedAt: new Date(),
        metadata: params.metadata,
      },
    });
  }

  async resolveAttempt(params: {
    attemptId: string;
    status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
    pspReference?: string;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return this.prisma.paymentAttempt.update({
      where: { id: params.attemptId },
      data: {
        status: params.status,
        pspReference: params.pspReference,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        respondedAt: new Date(),
      },
    });
  }

  async getAttemptsForTransaction(transactionId: string) {
    return this.prisma.paymentAttempt.findMany({
      where: { transactionId },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  async getSuccessfulAttempt(transactionId: string) {
    return this.prisma.paymentAttempt.findFirst({
      where: {
        transactionId,
        status: 'SUCCESS',
      },
      orderBy: { attemptNumber: 'desc' },
    });
  }
}
