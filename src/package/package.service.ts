import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentKind,
  CurrencyCode,
  PackageContentComplianceStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { DeclarePackageContentDto } from './dto/declare-package-content.dto';

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
  ) {}

  private normalizeOptionalNotes(notes?: string): string | null {
    const value = String(notes ?? '').trim();

    if (!value) {
      return null;
    }

    if (value.length > 1000) {
      throw new BadRequestException(
        'handover notes must not exceed 1000 characters',
      );
    }

    return value;
  }

  private normalizeRequiredContentSummary(summary: string): string {
    const value = String(summary ?? '').trim();

    if (!value) {
      throw new BadRequestException('contentSummary is required');
    }

    if (value.length > 500) {
      throw new BadRequestException(
        'contentSummary must not exceed 500 characters',
      );
    }

    return value;
  }

  private validateDeclaredValue(
    amount?: number,
    currency?: CurrencyCode,
  ): { amount: number | null; currency: CurrencyCode | null } {
    if (
      (amount === undefined || amount === null) &&
      (currency === undefined || currency === null)
    ) {
      return {
        amount: null,
        currency: null,
      };
    }

    if (amount === undefined || amount === null) {
      throw new BadRequestException(
        'declaredValueAmount is required when declaredValueCurrency is provided',
      );
    }

    if (currency === undefined || currency === null) {
      throw new BadRequestException(
        'declaredValueCurrency is required when declaredValueAmount is provided',
      );
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(
        'declaredValueAmount must be a valid non-negative number',
      );
    }

    return {
      amount,
      currency,
    };
  }

  private deriveContentCompliance(input: DeclarePackageContentDto): {
    status: PackageContentComplianceStatus;
    notes: string | null;
  } {
    if (input.containsProhibitedItems) {
      return {
        status: PackageContentComplianceStatus.BLOCKED,
        notes:
          'Sender declared prohibited items. Package is blocked from publication and booking.',
      };
    }

    const hasSensitiveSignal =
      Boolean(input.containsLiquid) ||
      Boolean(input.containsElectronic) ||
      Boolean(input.containsBattery) ||
      Boolean(input.containsMedicine) ||
      Boolean(input.containsPerishableItems) ||
      Boolean(input.containsValuableItems);

    if (hasSensitiveSignal) {
      return {
        status: PackageContentComplianceStatus.DECLARED_SENSITIVE,
        notes:
          'Sensitive content declared: manual review may be required later.',
      };
    }

    return {
      status: PackageContentComplianceStatus.DECLARED_CLEAR,
      notes: 'No prohibited content declared by sender.',
    };
  }

  async createDraft(userId: string, dto: CreatePackageDto) {
    const pkg = await this.prisma.package.create({
      data: {
        senderId: userId,
        corridorId: dto.corridorId,
        weightKg: dto.weightKg ?? null,
        description: dto.description ?? null,
        status: 'DRAFT',
      },
    });

    await this.abandonment.markAbandoned(
      { userId, role: 'USER' },
      {
        kind: AbandonmentKind.PACKAGE_DRAFT,
        packageId: pkg.id,
        metadata: {
          step: 'draft_created',
          corridorId: dto.corridorId,
        },
      },
    );

    return pkg;
  }

  async declareContent(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    dto: DeclarePackageContentDto,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
        status: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (actorRole !== Role.ADMIN && pkg.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can declare package content',
      );
    }

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot declare content for a CANCELLED package',
      );
    }

    if (pkg.status === 'RESERVED') {
      throw new BadRequestException(
        'Cannot update package content after the package has been RESERVED',
      );
    }

    if (!dto.prohibitedItemsDeclarationAccepted) {
      throw new BadRequestException(
        'prohibitedItemsDeclarationAccepted must be true',
      );
    }

    const declaredValue = this.validateDeclaredValue(
      dto.declaredValueAmount,
      dto.declaredValueCurrency,
    );

    const compliance = this.deriveContentCompliance(dto);
    const now = new Date();

    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        contentCategory: dto.contentCategory,
        contentSummary: this.normalizeRequiredContentSummary(dto.contentSummary),
        declaredItemCount: dto.declaredItemCount ?? null,
        declaredValueAmount: declaredValue.amount,
        declaredValueCurrency: declaredValue.currency,
        containsFragileItems: dto.containsFragileItems ?? false,
        containsLiquid: dto.containsLiquid ?? false,
        containsElectronic: dto.containsElectronic ?? false,
        containsBattery: dto.containsBattery ?? false,
        containsMedicine: dto.containsMedicine ?? false,
        containsPerishableItems: dto.containsPerishableItems ?? false,
        containsValuableItems: dto.containsValuableItems ?? false,
        containsDocuments: dto.containsDocuments ?? false,
        containsProhibitedItems: dto.containsProhibitedItems,
        prohibitedItemsDeclarationAcceptedAt: now,
        prohibitedItemsDeclarationAcceptedById: actorUserId,
        contentDeclaredAt: now,
        contentDeclaredById: actorUserId,
        contentComplianceStatus: compliance.status,
        contentComplianceNotes: compliance.notes,
      },
    });
  }

  async publish(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status !== 'DRAFT') throw new BadRequestException('Package must be DRAFT');

    if (pkg.contentComplianceStatus === PackageContentComplianceStatus.NOT_DECLARED) {
      throw new BadRequestException(
        'Package content must be declared before publishing',
      );
    }

    if (pkg.contentComplianceStatus === PackageContentComplianceStatus.BLOCKED) {
      throw new BadRequestException(
        'Package contains prohibited items and cannot be published',
      );
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'PUBLISHED' },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return updated;
  }

  async cancel(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status === 'CANCELLED') return pkg;

    if (pkg.status === 'RESERVED') {
      throw new BadRequestException('Cannot cancel a RESERVED package');
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'CANCELLED' },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return updated;
  }

  async declareHandover(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    notes?: string,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
        status: true,
        handoverDeclaredAt: true,
        handoverDeclaredById: true,
        handoverNotes: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (actorRole !== Role.ADMIN && pkg.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can declare package handover',
      );
    }

    if (pkg.status === 'DRAFT') {
      throw new BadRequestException(
        'Cannot declare handover for a DRAFT package',
      );
    }

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot declare handover for a CANCELLED package',
      );
    }

    const now = new Date();

    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        handoverDeclaredAt: now,
        handoverDeclaredById: actorUserId,
        handoverNotes: this.normalizeOptionalNotes(notes),
      },
    });
  }

  async acknowledgeTravelerResponsibility(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.status === 'DRAFT') {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a DRAFT package',
      );
    }

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a CANCELLED package',
      );
    }

    const linkedTransaction = await this.prisma.transaction.findFirst({
      where: {
        packageId,
        NOT: { status: TransactionStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        travelerId: true,
      },
    });

    if (!linkedTransaction) {
      throw new BadRequestException(
        'Package is not linked to an active transaction',
      );
    }

    if (
      actorRole !== Role.ADMIN &&
      linkedTransaction.travelerId !== actorUserId
    ) {
      throw new ForbiddenException(
        'Only the traveler or an admin can acknowledge traveler responsibility',
      );
    }

    const now = new Date();

    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        travelerResponsibilityAcknowledgedAt: now,
        travelerResponsibilityAcknowledgedById: actorUserId,
      },
    });
  }

  async findMine(userId: string) {
    return this.prisma.package.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}