import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LegalAcceptanceContext,
  LegalDocumentType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordLegalAcceptanceDto } from './dto/record-legal-acceptance.dto';
import { ListLegalAcceptancesQueryDto } from './dto/list-legal-acceptances-query.dto';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAcceptance(userId: string, dto: RecordLegalAcceptanceDto) {
    await this.ensureUserExists(userId);

    this.assertContextPayload(dto);

    if (dto.context === LegalAcceptanceContext.TRANSACTION && dto.transactionId) {
      await this.assertTransactionAccessible(userId, Role.USER, dto.transactionId);
    }

    if (dto.context === LegalAcceptanceContext.PACKAGE && dto.packageId) {
      await this.assertPackageAccessible(userId, Role.USER, dto.packageId);
    }

    const existing = await this.prisma.legalAcceptance.findFirst({
      where: {
        userId,
        documentType: dto.documentType,
        documentVersion: dto.documentVersion,
        context: dto.context,
        transactionId: dto.transactionId ?? null,
        packageId: dto.packageId ?? null,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (existing) {
      return existing;
    }

    return this.prisma.legalAcceptance.create({
      data: {
        userId,
        documentType: dto.documentType,
        documentVersion: dto.documentVersion,
        context: dto.context,
        transactionId: dto.transactionId ?? null,
        packageId: dto.packageId ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async listMyAcceptances(userId: string) {
    return this.prisma.legalAcceptance.findMany({
      where: { userId },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listAcceptances(query: ListLegalAcceptancesQueryDto) {
    return this.prisma.legalAcceptance.findMany({
      where: {
        userId: query.userId,
        documentType: query.documentType,
        context: query.context,
        transactionId: query.transactionId,
        packageId: query.packageId,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
    });
  }

  async acknowledgeTransactionPlatformRole(
    actorUserId: string,
    actorRole: Role,
    transactionId: string,
  ) {
    await this.ensureUserExists(actorUserId);
    await this.assertTransactionAccessible(actorUserId, actorRole, transactionId);

    return this.createContextualAcceptanceIfMissing(actorUserId, {
      documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.TRANSACTION,
      transactionId,
      metadata: {
        source: 'transaction_acknowledge_platform_role',
        actorRole,
      },
    });
  }

  async acknowledgeTransactionDeliveryRisk(
    actorUserId: string,
    actorRole: Role,
    transactionId: string,
  ) {
    await this.ensureUserExists(actorUserId);
    await this.assertTransactionAccessible(actorUserId, actorRole, transactionId);

    return this.createContextualAcceptanceIfMissing(actorUserId, {
      documentType: LegalDocumentType.DELIVERY_RISK_NOTICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.TRANSACTION,
      transactionId,
      metadata: {
        source: 'transaction_acknowledge_delivery_risk',
        actorRole,
      },
    });
  }

  async acknowledgePackageRules(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
  ) {
    await this.ensureUserExists(actorUserId);
    await this.assertPackageAccessible(actorUserId, actorRole, packageId);

    return this.createContextualAcceptanceIfMissing(actorUserId, {
      documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.PACKAGE,
      packageId,
      metadata: {
        source: 'package_acknowledge_rules',
        actorRole,
      },
    });
  }

  async assertTransactionPlatformRoleAcknowledged(
    actorUserId: string,
    actorRole: Role,
    transactionId: string,
  ) {
    await this.ensureUserExists(actorUserId);
    await this.assertTransactionAccessible(actorUserId, actorRole, transactionId);

    if (actorRole === Role.ADMIN) {
      return;
    }

    const acceptance = await this.prisma.legalAcceptance.findFirst({
      where: {
        userId: actorUserId,
        documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.TRANSACTION,
        transactionId,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (acceptance) {
      return;
    }

    throw new BadRequestException({
      code: 'LEGAL_ACCEPTANCE_REQUIRED',
      message:
        'Platform role acknowledgment is required before this transaction action can proceed.',
      requiredFor: 'TRANSACTION_PLATFORM_ROLE_NOTICE',
      userId: actorUserId,
      documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
      context: LegalAcceptanceContext.TRANSACTION,
      transactionId,
      nextStep: 'LEGAL_ACKNOWLEDGMENT',
      nextStepUrl: `/legal/transactions/${transactionId}/acknowledge-platform-role`,
    });
  }

  async assertTransactionDeliveryRiskAcknowledged(
    actorUserId: string,
    actorRole: Role,
    transactionId: string,
  ) {
    await this.ensureUserExists(actorUserId);
    await this.assertTransactionAccessible(actorUserId, actorRole, transactionId);

    if (actorRole === Role.ADMIN) {
      return;
    }

    const acceptance = await this.prisma.legalAcceptance.findFirst({
      where: {
        userId: actorUserId,
        documentType: LegalDocumentType.DELIVERY_RISK_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.TRANSACTION,
        transactionId,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (acceptance) {
      return;
    }

    throw new BadRequestException({
      code: 'LEGAL_ACCEPTANCE_REQUIRED',
      message:
        'Delivery risk acknowledgment is required before this transaction action can proceed.',
      requiredFor: 'TRANSACTION_DELIVERY_RISK_NOTICE',
      userId: actorUserId,
      documentType: LegalDocumentType.DELIVERY_RISK_NOTICE,
      context: LegalAcceptanceContext.TRANSACTION,
      transactionId,
      nextStep: 'LEGAL_ACKNOWLEDGMENT',
      nextStepUrl: `/legal/transactions/${transactionId}/acknowledge-delivery-risk`,
    });
  }

  private async createContextualAcceptanceIfMissing(
    userId: string,
    input: {
      documentType: LegalDocumentType;
      documentVersion: string;
      context: LegalAcceptanceContext;
      transactionId?: string;
      packageId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.legalAcceptance.findFirst({
      where: {
        userId,
        documentType: input.documentType,
        documentVersion: input.documentVersion,
        context: input.context,
        transactionId: input.transactionId ?? null,
        packageId: input.packageId ?? null,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (existing) {
      return existing;
    }

    return this.prisma.legalAcceptance.create({
      data: {
        userId,
        documentType: input.documentType,
        documentVersion: input.documentVersion,
        context: input.context,
        transactionId: input.transactionId ?? null,
        packageId: input.packageId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  private assertContextPayload(dto: RecordLegalAcceptanceDto) {
    if (dto.context === LegalAcceptanceContext.GLOBAL) {
      if (dto.transactionId || dto.packageId) {
        throw new BadRequestException(
          'GLOBAL legal acceptance must not include transactionId or packageId',
        );
      }
      return;
    }

    if (dto.context === LegalAcceptanceContext.TRANSACTION) {
      if (!dto.transactionId) {
        throw new BadRequestException(
          'TRANSACTION legal acceptance requires transactionId',
        );
      }
      if (dto.packageId) {
        throw new BadRequestException(
          'TRANSACTION legal acceptance must not include packageId',
        );
      }
      return;
    }

    if (dto.context === LegalAcceptanceContext.PACKAGE) {
      if (!dto.packageId) {
        throw new BadRequestException(
          'PACKAGE legal acceptance requires packageId',
        );
      }
      if (dto.transactionId) {
        throw new BadRequestException(
          'PACKAGE legal acceptance must not include transactionId',
        );
      }
    }
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  private async assertTransactionAccessible(
    actorUserId: string,
    actorRole: Role,
    transactionId: string,
  ) {
    const where =
      actorRole === Role.ADMIN
        ? { id: transactionId }
        : {
            id: transactionId,
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const tx = await this.prisma.transaction.findFirst({
      where,
      select: { id: true },
    });

    if (!tx) {
      throw new ForbiddenException(
        'Transaction not found or not accessible for legal acknowledgment',
      );
    }
  }

  private async assertPackageAccessible(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
  ) {
    const where =
      actorRole === Role.ADMIN
        ? { id: packageId }
        : {
            id: packageId,
            senderId: actorUserId,
          };

    const pkg = await this.prisma.package.findFirst({
      where,
      select: { id: true },
    });

    if (!pkg) {
      throw new ForbiddenException(
        'Package not found or not accessible for legal acknowledgment',
      );
    }
  }
}