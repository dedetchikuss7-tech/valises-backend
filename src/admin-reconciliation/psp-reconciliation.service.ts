import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { CinetPayProvider } from '../payment/providers/cinetpay.provider';
import { PrismaService } from '../prisma/prisma.service';
import { TriggerPspReconciliationRunDto } from './dto/trigger-psp-reconciliation-run.dto';
import {
  PspReconciliationCaseResponseDto,
  PspReconciliationRunResponseDto,
} from './dto/psp-reconciliation-run-response.dto';
import { ListPspReconciliationRunsQueryDto } from './dto/list-psp-reconciliation-runs-query.dto';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';

const PSP_ACCEPTED_STATUSES = new Set(['ACCEPTED', 'SUCCESS', 'SUCCESSFUL']);

type DiscrepancyType = 'PSP_NOT_FOUND' | 'PSP_STATUS_MISMATCH' | 'AMOUNT_MISMATCH';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

function resolveSeverity(type: DiscrepancyType, localStatus: PaymentStatus): Severity {
  if (type === 'PSP_NOT_FOUND' && localStatus === PaymentStatus.SUCCESS) return 'CRITICAL';
  if (type === 'PSP_STATUS_MISMATCH') return 'CRITICAL';
  if (type === 'AMOUNT_MISMATCH') return 'HIGH';
  return 'MEDIUM';
}

@Injectable()
export class PspReconciliationService {
  private readonly logger = new Logger(PspReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cinetPay: CinetPayProvider,
    private readonly config: ConfigService,
  ) {}

  async triggerRun(
    dto: TriggerPspReconciliationRunDto,
    initiatedById: string,
  ): Promise<PspReconciliationRunResponseDto> {
    const paymentProvider = this.config.get<string>('PAYMENT_PROVIDER', 'MOCK');

    // Create the run record
    const run = await this.prisma.reconciliationRun.create({
      data: {
        initiatedById,
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        dryRun: dto.dryRun ?? false,
        provider: 'CINETPAY',
        status: 'RUNNING',
      },
    });

    try {
      // Fetch transactions in date range that have a PSP reference (went through real PSP)
      const transactions = await this.prisma.transaction.findMany({
        where: {
          createdAt: { gte: dto.dateFrom, lte: dto.dateTo },
          payinProviderReference: { not: null },
        },
        select: {
          id: true,
          paymentStatus: true,
          payinProviderReference: true,
          amount: true,
          currency: true,
        },
      });

      let verified = 0;
      let skipped = 0;
      let discrepanciesFound = 0;

      for (const tx of transactions) {
        if (paymentProvider !== 'CINETPAY') {
          // Skip PSP verification when not using CinetPay — log as skipped
          skipped++;
          continue;
        }

        let pspResult;
        try {
          pspResult = await this.cinetPay.verifyTransaction(tx.id);
        } catch (err) {
          this.logger.warn(`PSP verify failed for tx ${tx.id}`, err);
          skipped++;
          continue;
        }

        const discrepancy = this.detectDiscrepancy(tx, pspResult);

        if (!discrepancy) {
          verified++;
          continue;
        }

        discrepanciesFound++;

        if (!dto.dryRun) {
          await this.prisma.reconciliationCase.create({
            data: {
              reconciliationRunId: run.id,
              transactionId: tx.id,
              payinProviderRef: tx.payinProviderReference,
              discrepancyType: discrepancy.type,
              severity: discrepancy.severity,
              localStatus: tx.paymentStatus,
              pspStatus: pspResult.pspStatus,
              localAmount: tx.amount,
              pspAmount: pspResult.pspAmount,
              metadata: { pspRawResponse: pspResult.rawResponse },
            },
          });
        }
      }

      const completed = await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          totalChecked: transactions.length,
          verified,
          skipped,
          discrepanciesFound,
        },
      });

      return this.mapRun(completed);
    } catch (err: any) {
      this.logger.error(`ReconciliationRun ${run.id} failed`, err);
      await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: err?.message ?? 'Unknown error' },
      });
      throw err;
    }
  }

  async listRuns(
    query: ListPspReconciliationRunsQueryDto,
  ): Promise<PaginatedListResponseDto<PspReconciliationRunResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [total, runs] = await Promise.all([
      this.prisma.reconciliationRun.count({ where }),
      this.prisma.reconciliationRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      items: runs.map((r) => this.mapRun(r)),
      total,
      limit,
      offset,
      hasMore: offset + runs.length < total,
    };
  }

  async getRunById(id: string): Promise<PspReconciliationRunResponseDto> {
    const run = await this.prisma.reconciliationRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`ReconciliationRun ${id} not found`);

    const cases = await this.prisma.reconciliationCase.findMany({
      where: { reconciliationRunId: id },
      orderBy: { createdAt: 'desc' },
    });

    return { ...this.mapRun(run), cases: cases.map((c) => this.mapCase(c)) };
  }

  private detectDiscrepancy(
    tx: { id: string; paymentStatus: PaymentStatus; amount: number },
    pspResult: { found: boolean; pspStatus: string | null; pspAmount: number | null },
  ): { type: DiscrepancyType; severity: Severity } | null {
    if (!pspResult.found) {
      // Only flag as discrepancy if local status is SUCCESS (orphaned local success)
      if (tx.paymentStatus === PaymentStatus.SUCCESS) {
        return { type: 'PSP_NOT_FOUND', severity: resolveSeverity('PSP_NOT_FOUND', tx.paymentStatus) };
      }
      return null;
    }

    const pspAccepted = pspResult.pspStatus ? PSP_ACCEPTED_STATUSES.has(pspResult.pspStatus.toUpperCase()) : false;
    const localSuccess = tx.paymentStatus === PaymentStatus.SUCCESS;

    if (pspAccepted !== localSuccess) {
      return { type: 'PSP_STATUS_MISMATCH', severity: resolveSeverity('PSP_STATUS_MISMATCH', tx.paymentStatus) };
    }

    if (pspResult.pspAmount != null && Math.abs(pspResult.pspAmount - tx.amount) > 0) {
      return { type: 'AMOUNT_MISMATCH', severity: resolveSeverity('AMOUNT_MISMATCH', tx.paymentStatus) };
    }

    return null;
  }

  private mapRun(run: any): PspReconciliationRunResponseDto {
    return {
      id: run.id,
      initiatedById: run.initiatedById,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      dateFrom: run.dateFrom,
      dateTo: run.dateTo,
      dryRun: run.dryRun,
      totalChecked: run.totalChecked,
      verified: run.verified,
      skipped: run.skipped,
      discrepanciesFound: run.discrepanciesFound,
      provider: run.provider,
      status: run.status,
      errorMessage: run.errorMessage,
      metadata: run.metadata as Record<string, unknown> | null,
      createdAt: run.createdAt,
    };
  }

  private mapCase(c: any): PspReconciliationCaseResponseDto {
    return {
      id: c.id,
      reconciliationRunId: c.reconciliationRunId,
      transactionId: c.transactionId,
      payinProviderRef: c.payinProviderRef,
      discrepancyType: c.discrepancyType,
      severity: c.severity,
      localStatus: c.localStatus,
      pspStatus: c.pspStatus,
      localAmount: c.localAmount,
      pspAmount: c.pspAmount,
      firstDetectedAt: c.firstDetectedAt,
      lastCheckedAt: c.lastCheckedAt,
      verificationAttempts: c.verificationAttempts,
      resolvedAt: c.resolvedAt,
      resolvedById: c.resolvedById,
      notes: c.notes,
      metadata: c.metadata as Record<string, unknown> | null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
