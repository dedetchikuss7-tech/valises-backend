import { ApiProperty } from '@nestjs/swagger';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  KycStatus,
  Role,
  TrustProfileStatus,
} from '@prisma/client';

class MobileContractUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}

class MobileContractKycDto {
  @ApiProperty({ enum: KycStatus })
  status!: KycStatus;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ nullable: true })
  nextStep!: string | null;

  @ApiProperty({ nullable: true })
  nextStepUrl!: string | null;
}

class MobileContractTrustProfileDto {
  @ApiProperty()
  score!: number;

  @ApiProperty({ enum: TrustProfileStatus })
  status!: TrustProfileStatus;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  positiveEvents!: number;

  @ApiProperty()
  negativeEvents!: number;

  @ApiProperty()
  activeRestrictionCount!: number;

  @ApiProperty({ nullable: true })
  lastEventAt!: Date | null;
}

class MobileContractRestrictionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BehaviorRestrictionKind })
  kind!: BehaviorRestrictionKind;

  @ApiProperty({ enum: BehaviorRestrictionScope })
  scope!: BehaviorRestrictionScope;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  imposedAt!: Date;
}

class MobileContractCapabilitiesDto {
  @ApiProperty()
  canPublishTrips!: boolean;

  @ApiProperty()
  canPublishPackages!: boolean;

  @ApiProperty()
  canMessage!: boolean;

  @ApiProperty()
  canCreateTransactions!: boolean;
}

class MobileContractLegalDto {
  @ApiProperty()
  hasAcceptedTermsOfService!: boolean;

  @ApiProperty()
  hasAcceptedPrivacyNotice!: boolean;

  @ApiProperty()
  hasAcceptedEscrowNotice!: boolean;

  @ApiProperty({ type: [String] })
  acceptedGlobalDocumentKeys!: string[];
}

export class MobileContractResponseDto {
  @ApiProperty({ example: 'v1' })
  contractVersion!: string;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: MobileContractUserDto })
  user!: MobileContractUserDto;

  @ApiProperty({ type: MobileContractKycDto })
  kyc!: MobileContractKycDto;

  @ApiProperty({ type: MobileContractTrustProfileDto })
  trustProfile!: MobileContractTrustProfileDto;

  @ApiProperty({ type: [MobileContractRestrictionDto] })
  activeRestrictions!: MobileContractRestrictionDto[];

  @ApiProperty({ type: MobileContractCapabilitiesDto })
  capabilities!: MobileContractCapabilitiesDto;

  @ApiProperty({ type: MobileContractLegalDto })
  legal!: MobileContractLegalDto;
}