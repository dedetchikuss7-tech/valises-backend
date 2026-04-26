import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageContentComplianceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPackageContentDto {
  @ApiProperty({
    description:
      'Admin-reviewed package content compliance status. NOT_DECLARED is not accepted through this endpoint.',
    enum: PackageContentComplianceStatus,
    example: PackageContentComplianceStatus.DECLARED_SENSITIVE,
  })
  @IsEnum(PackageContentComplianceStatus)
  contentComplianceStatus!: PackageContentComplianceStatus;

  @ApiPropertyOptional({
    description: 'Optional admin compliance review notes',
    example: 'Electronics declared. Manual review completed; package allowed with caution.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  contentComplianceNotes?: string;
}