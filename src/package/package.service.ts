import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentKind,
  CurrencyCode,
  Package as PrismaPackage,
  PackageContentComplianceStatus,
  PackageStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { DeclarePackageContentDto } from './dto/declare-package-content.dto';
import { ReviewPackageContentDto } from './dto/review-package-content.dto';
import { PackageResponseDto } from './dto/package-response.dto';
import {
  EnforcementService,
  noopEnforcementService,
} from '../enforcement/enforcement.service';
import {
  PackageHandoverStatus,
  PackageOperationalReadinessReason,
  PackageOperationalReadinessStatus,
  PackageTravelerResponsibilityStatus,
} from './dto/package-operational-status.dto';

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
    private readonly enforcement: EnforcementService = noopEnforcementService,
  ) {}

  private normalizeOptionalNotes(notes?: string | null): string | null {
    const value = String(notes ?? '').trim();

    if (!value) {
      return null;
    }

    if (value.length > 1000) {
      throw new BadRequestException('notes must not exceed 1000 characters');
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

  private decimalToNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value &&
      typeof (value as { toNumber: () => number }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed;
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

  private toResponse(pkg: Partial<PrismaPackage>): PackageResponseDto {
    const operationalStatus = this.computeOperationalStatus(pkg);

    return {
      id: pkg.id as string,
      senderId: pkg.senderId as string,
      corridorId: pkg.corridorId as string,
      weightKg: pkg.weightKg ?? null,
      description: pkg.description ?? null,
      status: pkg.status as PackageStatus,
      contentCategory: pkg.contentCategory ?? null,
      contentSummary: pkg.contentSummary ?? null,
      declaredItemCount: pkg.declaredItemCount ?? null,
      declaredValueAmount: this.decimalToNumber(pkg.declaredValueAmount),
      declaredValueCurrency: pkg.declaredValueCurrency ?? null,
      containsFragileItems: Boolean(pkg.containsFragileItems),
      containsLiquid: Boolean(pkg.containsLiquid),
      containsElectronic: Boolean(pkg.containsElectronic),
      containsBattery: Boolean(pkg.containsBattery),
      containsMedicine: Boolean(pkg.containsMedicine),
      containsPerishableItems: Boolean(pkg.containsPerishableItems),
      containsValuableItems: Boolean(pkg.containsValuableItems),
      containsDocuments: Boolean(pkg.containsDocuments),
      containsProhibitedItems: Boolean(pkg.containsProhibitedItems),
      prohibitedItemsDeclarationAcceptedAt:
        pkg.prohibitedItemsDeclarationAcceptedAt ?? null,
      prohibitedItemsDeclarationAcceptedById:
        pkg.prohibitedItemsDeclarationAcceptedById ?? null,
      contentDeclaredAt: pkg.contentDeclaredAt ?? null,
      contentDeclaredById: pkg.contentDeclaredById ?? null,
      contentComplianceStatus:
        pkg.contentComplianceStatus ??
        PackageContentComplianceStatus.NOT_DECLARED,
      contentComplianceNotes: pkg.contentComplianceNotes ?? null,
      handoverDeclaredAt: pkg.handoverDeclaredAt ?? null,
      handoverDeclaredById: pkg.handoverDeclaredById ?? null,
      handoverNotes: pkg.handoverNotes ?? null,
      travelerResponsibilityAcknowledgedAt:
        pkg.travelerResponsibilityAcknowledgedAt ?? null,
      travelerResponsibilityAcknowledgedById:
        pkg.travelerResponsibilityAcknowledgedById ?? null,
      handoverStatus: operationalStatus.handoverStatus,
      travelerResponsibilityStatus:
        operationalStatus.travelerResponsibilityStatus,
      packageOperationalReadiness:
        operationalStatus.packageOperationalReadiness,
      packageOperationalReadinessReasons:
        operationalStatus.packageOperationalReadinessReasons,
      createdAt: pkg.createdAt as Date,
      updatedAt: pkg.updatedAt as Date,
    };
  }

  private computeOperationalStatus(pkg: Partial<PrismaPackage>) {
    const status = pkg.status as PackageStatus;
    const contentComplianceStatus =
      pkg.contentComplianceStatus ??
      PackageContentComplianceStatus.NOT_DECLARED;

    const handoverStatus = pkg.handoverDeclaredAt
      ? PackageHandoverStatus.DECLARED
      : PackageHandoverStatus.NOT_DECLARED;

    const isReserved = status === PackageStatus.RESERVED;

    const travelerResponsibilityStatus = !isReserved
      ? PackageTravelerResponsibilityStatus.NOT_APPLICABLE
      : pkg.travelerResponsibilityAcknowledgedAt
        ? PackageTravelerResponsibilityStatus.ACKNOWLEDGED
        : PackageTravelerResponsibilityStatus.PENDING;

    const reasons: PackageOperationalReadinessReason[] = [];

    if (status === PackageStatus.CANCELLED) {
      reasons.push(PackageOperationalReadinessReason.PACKAGE_IS_CANCELLED);

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.CANCELLED,
        packageOperationalReadinessReasons: reasons,
      };
    }

    if (contentComplianceStatus === PackageContentComplianceStatus.BLOCKED) {
      reasons.push(PackageOperationalReadinessReason.CONTENT_BLOCKED);

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.BLOCKED_CONTENT,
        packageOperationalReadinessReasons: reasons,
      };
    }

    if (
      contentComplianceStatus ===
      PackageContentComplianceStatus.NOT_DECLARED
    ) {
      reasons.push(PackageOperationalReadinessReason.CONTENT_NOT_DECLARED);

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.DRAFT_INCOMPLETE,
        packageOperationalReadinessReasons: reasons,
      };
    }

    if (
      contentComplianceStatus ===
      PackageContentComplianceStatus.DECLARED_SENSITIVE
    ) {
      reasons.push(PackageOperationalReadinessReason.CONTENT_DECLARED_SENSITIVE);
    } else {
      reasons.push(PackageOperationalReadinessReason.CONTENT_DECLARED_CLEAR);
    }

    if (status === PackageStatus.DRAFT) {
      reasons.push(PackageOperationalReadinessReason.READY_FOR_PUBLICATION);

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.READY_TO_PUBLISH,
        packageOperationalReadinessReasons: reasons,
      };
    }

    if (status === PackageStatus.PUBLISHED) {
      reasons.push(PackageOperationalReadinessReason.PACKAGE_IS_PUBLISHED);
      reasons.push(PackageOperationalReadinessReason.READY_FOR_MATCHING);

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.PUBLISHED_WAITING_MATCH,
        packageOperationalReadinessReasons: reasons,
      };
    }

    if (
      status === PackageStatus.RESERVED &&
      !pkg.travelerResponsibilityAcknowledgedAt
    ) {
      reasons.push(PackageOperationalReadinessReason.PACKAGE_IS_RESERVED);

      if (pkg.handoverDeclaredAt) {
        reasons.push(PackageOperationalReadinessReason.HANDOVER_DECLARED);
      } else {
        reasons.push(PackageOperationalReadinessReason.HANDOVER_NOT_DECLARED);
      }

      reasons.push(
        PackageOperationalReadinessReason.TRAVELER_RESPONSIBILITY_PENDING,
      );

      return {
        handoverStatus,
        travelerResponsibilityStatus,
        packageOperationalReadiness:
          PackageOperationalReadinessStatus.RESERVED_WAITING_TRAVELER_ACK,
        packageOperationalReadinessReasons: reasons,
      };
    }

    reasons.push(PackageOperationalReadinessReason.PACKAGE_IS_RESERVED);

    if (pkg.handoverDeclaredAt) {
      reasons.push(PackageOperationalReadinessReason.HANDOVER_DECLARED);
    } else {
      reasons.push(PackageOperationalReadinessReason.HANDOVER_NOT_DECLARED);
    }

    reasons.push(
      PackageOperationalReadinessReason.TRAVELER_RESPONSIBILITY_ACKNOWLEDGED,
    );
    reasons.push(PackageOperationalReadinessReason.READY_FOR_TRANSPORT);

    return {
      handoverStatus,
      travelerResponsibilityStatus,
      packageOperationalReadiness:
        PackageOperationalReadinessStatus.READY_FOR_TRANSPORT,
      packageOperationalReadinessReasons: reasons,
    };
  }

  async createDraft(
    userId: string,
    dto: CreatePackageDto,
  ): Promise<PackageResponseDto> {
    const pkg = await this.prisma.package.create({
      data: {
        senderId: userId,
        corridorId: dto.corridorId,
        weightKg: dto.weightKg ?? null,
        description: dto.description ?? null,
        status: PackageStatus.DRAFT,
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

    return this.toResponse(pkg);
  }

  async declareContent(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    dto: DeclarePackageContentDto,
  ): Promise<PackageResponseDto> {
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

    if (pkg.status === PackageStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot declare content for a CANCELLED package',
      );
    }

    if (pkg.status === PackageStatus.RESERVED) {
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

    const updated = await this.prisma.package.update({
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

    return this.toResponse(updated);
  }

  async reviewContent(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    dto: ReviewPackageContentDto,
  ): Promise<PackageResponseDto> {
    if (actorRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an admin can review package content compliance',
      );
    }

    if (
      dto.contentComplianceStatus ===
      PackageContentComplianceStatus.NOT_DECLARED
    ) {
      throw new BadRequestException(
        'Admin review cannot reset content compliance to NOT_DECLARED',
      );
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        status: true,
        contentDeclaredAt: true,
        contentComplianceStatus: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.status === PackageStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot review content for a CANCELLED package',
      );
    }

    if (!pkg.contentDeclaredAt) {
      throw new BadRequestException(
        'Package content must be declared before admin review',
      );
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        contentComplianceStatus: dto.contentComplianceStatus,
        contentComplianceNotes: this.normalizeOptionalNotes(
          dto.contentComplianceNotes,
        ),
      },
    });

    return this.toResponse(updated);
  }

  async publish(userId: string, packageId: string): Promise<PackageResponseDto> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.senderId !== userId) {
      throw new ForbiddenException('Not your package');
    }

    if (pkg.status !== PackageStatus.DRAFT) {
      throw new BadRequestException('Package must be DRAFT');
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.NOT_DECLARED
    ) {
      throw new BadRequestException(
        'Package content must be declared before publishing',
      );
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.BLOCKED
    ) {
      throw new BadRequestException(
        'Package contains prohibited items and cannot be published',
      );
    }

    await this.enforcement.assertPackagePublishAllowed({
      userId,
      packageId,
    });

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.PUBLISHED },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return this.toResponse(updated);
  }

  async cancel(userId: string, packageId: string): Promise<PackageResponseDto> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.senderId !== userId) {
      throw new ForbiddenException('Not your package');
    }

    if (pkg.status === PackageStatus.CANCELLED) {
      return this.toResponse(pkg);
    }

    if (pkg.status === PackageStatus.RESERVED) {
      throw new BadRequestException('Cannot cancel a RESERVED package');
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.CANCELLED },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return this.toResponse(updated);
  }

  async declareHandover(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    notes?: string,
  ): Promise<PackageResponseDto> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
        status: true,
        contentComplianceStatus: true,
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

    if (pkg.status === PackageStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot declare handover for a DRAFT package',
      );
    }

    if (pkg.status === PackageStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot declare handover for a CANCELLED package',
      );
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.NOT_DECLARED
    ) {
      throw new BadRequestException(
        'Package content must be declared before handover',
      );
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.BLOCKED
    ) {
      throw new BadRequestException(
        'Cannot declare handover for a package with blocked content',
      );
    }

    const now = new Date();

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        handoverDeclaredAt: now,
        handoverDeclaredById: actorUserId,
        handoverNotes: this.normalizeOptionalNotes(notes),
      },
    });

    return this.toResponse(updated);
  }

  async acknowledgeTravelerResponsibility(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
  ): Promise<PackageResponseDto> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        status: true,
        contentComplianceStatus: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.status === PackageStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a DRAFT package',
      );
    }

    if (pkg.status === PackageStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a CANCELLED package',
      );
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.NOT_DECLARED
    ) {
      throw new BadRequestException(
        'Package content must be declared before traveler acknowledgement',
      );
    }

    if (
      pkg.contentComplianceStatus ===
      PackageContentComplianceStatus.BLOCKED
    ) {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a package with blocked content',
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

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        travelerResponsibilityAcknowledgedAt: now,
        travelerResponsibilityAcknowledgedById: actorUserId,
      },
    });

    return this.toResponse(updated);
  }

  async findMine(userId: string): Promise<PackageResponseDto[]> {
    const packages = await this.prisma.package.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return packages.map((pkg) => this.toResponse(pkg));
  }
}