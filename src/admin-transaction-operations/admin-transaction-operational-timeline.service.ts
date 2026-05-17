import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminOwnershipObjectType,
  EvidenceAttachmentObjectType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTransactionOperationalTimelineResponseDto } from './dto/admin-transaction-operational-timeline-response.dto';
import {
  AdminTransactionOperationalTimelineEventDto,
  AdminTransactionOperationalTimelineEventType,
} from './dto/admin-transaction-operational-timeline-event.dto';
import { ListAdminTransactionOperationalTimelineQueryDto } from './dto/list-admin-transaction-operational-timeline-query.dto';

@Injectable()
export class AdminTransactionOperationalTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(
    transactionId: string,
    query: ListAdminTransactionOperationalTimelineQueryDto,
  ): Promise<AdminTransactionOperationalTimelineResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        disputes: true,
        payout: true,
        refund: true,
        amlCase: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const events: AdminTransactionOperationalTimelineEventDto[] = [];

    events.push({
      type: AdminTransactionOperationalTimelineEventType.TRANSACTION,
      eventCode: 'TRANSACTION_CREATED',
      title: 'Transaction created',
      description: null,
      actorUserId: transaction.senderId,
      relatedObjectId: transaction.id,
      relatedObjectType: 'TRANSACTION',
      createdAt: transaction.createdAt,
      metadata: null,
    });

    if (transaction.paymentConfirmedAt) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.TRANSACTION,
        eventCode: 'PAYMENT_CONFIRMED',
        title: 'Payment confirmed',
        description: null,
        actorUserId: null,
        relatedObjectId: transaction.id,
        relatedObjectType: 'TRANSACTION',
        createdAt: transaction.paymentConfirmedAt,
        metadata: null,
      });
    }

    for (const dispute of transaction.disputes) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.DISPUTE,
        eventCode: 'DISPUTE_OPENED',
        title: 'Dispute opened',
        description: dispute.reason,
        actorUserId: dispute.openedById,
        relatedObjectId: dispute.id,
        relatedObjectType: 'DISPUTE',
        createdAt: dispute.createdAt,
        metadata: {
          disputeStatus: dispute.status,
          reasonCode: dispute.reasonCode,
        },
      });
    }

    if (query.includeEvidence) {
      const evidence = await this.prisma.evidenceAttachment.findMany({
        where: {
          OR: [
            {
              targetType: EvidenceAttachmentObjectType.TRANSACTION,
              targetId: transaction.id,
            },
            ...(transaction.packageId
              ? [
                  {
                    targetType: EvidenceAttachmentObjectType.PACKAGE,
                    targetId: transaction.packageId,
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      for (const item of evidence) {
        events.push({
          type: AdminTransactionOperationalTimelineEventType.EVIDENCE,
          eventCode: 'EVIDENCE_ATTACHMENT',
          title: 'Evidence attachment uploaded',
          description: item.label,
          actorUserId: item.uploadedById ?? null,
          relatedObjectId: item.id,
          relatedObjectType: 'EVIDENCE_ATTACHMENT',
          createdAt: item.createdAt,
          metadata: {
            attachmentType: item.attachmentType,
            status: item.status,
          },
        });
      }
    }

    if (transaction.payout) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.PAYOUT,
        eventCode: 'PAYOUT_CREATED',
        title: 'Payout created',
        description: null,
        actorUserId: null,
        relatedObjectId: transaction.payout.id,
        relatedObjectType: 'PAYOUT',
        createdAt: transaction.payout.createdAt,
        metadata: {
          payoutStatus: transaction.payout.status,
          amount: transaction.payout.amount,
          currency: transaction.payout.currency,
        },
      });
    }

    if (transaction.refund) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.REFUND,
        eventCode: 'REFUND_CREATED',
        title: 'Refund created',
        description: null,
        actorUserId: null,
        relatedObjectId: transaction.refund.id,
        relatedObjectType: 'REFUND',
        createdAt: transaction.refund.createdAt,
        metadata: {
          refundStatus: transaction.refund.status,
          amount: transaction.refund.amount,
          currency: transaction.refund.currency,
        },
      });
    }

    if (transaction.amlCase) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.AML,
        eventCode: 'AML_CASE_CREATED',
        title: 'AML case created',
        description: transaction.amlCase.reasonSummary,
        actorUserId: null,
        relatedObjectId: transaction.amlCase.id,
        relatedObjectType: 'AML_CASE',
        createdAt: transaction.amlCase.openedAt,
        metadata: {
          riskLevel: transaction.amlCase.riskLevel,
          status: transaction.amlCase.status,
        },
      });
    }

    if (query.includeOperationalCases) {
      const operationalCase = await this.prisma.adminOwnership.findUnique({
        where: {
          objectType_objectId: {
            objectType: AdminOwnershipObjectType.TRANSACTION,
            objectId: transaction.id,
          },
        },
      });

      if (operationalCase) {
        events.push({
          type: AdminTransactionOperationalTimelineEventType.OPERATIONAL_CASE,
          eventCode: 'OPERATIONAL_CASE',
          title: 'Operational case activity',
          description: null,
          actorUserId: operationalCase.assignedAdminId ?? null,
          relatedObjectId: operationalCase.id,
          relatedObjectType: 'ADMIN_OWNERSHIP',
          createdAt: operationalCase.updatedAt,
          metadata: {
            operationalStatus: operationalCase.operationalStatus,
          },
        });
      }
    }

    if (query.includeAdminActions) {
      const adminActions = await this.prisma.adminActionAudit.findMany({
        where: {
          targetType: 'TRANSACTION',
          targetId: transaction.id,
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      for (const action of adminActions) {
        events.push({
          type: AdminTransactionOperationalTimelineEventType.ADMIN_ACTION,
          eventCode: action.action,
          title: action.action,
          description: null,
          actorUserId: action.actorUserId ?? null,
          relatedObjectId: action.id,
          relatedObjectType: 'ADMIN_ACTION_AUDIT',
          createdAt: action.createdAt,
          metadata:
            action.metadata &&
            typeof action.metadata === 'object' &&
            !Array.isArray(action.metadata)
              ? (action.metadata as Record<string, unknown>)
              : null,
        });
      }
    }

    const timelineEvents = await this.prisma.adminTimelineEvent.findMany({
      where: {
        objectType: 'TRANSACTION',
        objectId: transaction.id,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    for (const item of timelineEvents) {
      events.push({
        type: AdminTransactionOperationalTimelineEventType.TIMELINE_EVENT,
        eventCode: item.eventType,
        title: item.title,
        description: item.message ?? null,
        actorUserId: item.actorUserId ?? null,
        relatedObjectId: item.id,
        relatedObjectType: 'ADMIN_TIMELINE_EVENT',
        createdAt: item.createdAt,
        metadata:
          item.metadata &&
          typeof item.metadata === 'object' &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : null,
      });
    }

    events.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return {
      transactionId,
      items: events,
      total: events.length,
      generatedAt: new Date(),
    };
  }
}