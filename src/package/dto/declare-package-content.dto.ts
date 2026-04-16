import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CurrencyCode,
  PackageContentCategory,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class DeclarePackageContentDto {
  @ApiProperty({
    description: 'Main declared package content category',
    enum: PackageContentCategory,
    example: PackageContentCategory.CLOTHING,
  })
  @IsEnum(PackageContentCategory)
  contentCategory!: PackageContentCategory;

  @ApiProperty({
    description: 'Short sender-side structured summary of the package contents',
    example: 'Clothes, shoes and personal care items',
  })
  @IsString()
  @MaxLength(500)
  contentSummary!: string;

  @ApiPropertyOptional({
    description: 'Approximate number of items declared by the sender',
    example: 6,
    minimum: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  declaredItemCount?: number;

  @ApiPropertyOptional({
    description: 'Approximate declared package value',
    example: 150,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredValueAmount?: number;

  @ApiPropertyOptional({
    description: 'Currency for the declared package value',
    enum: CurrencyCode,
    example: CurrencyCode.EUR,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  declaredValueCurrency?: CurrencyCode;

  @ApiPropertyOptional({ description: 'Sender declares fragile items', example: false })
  @IsOptional()
  @IsBoolean()
  containsFragileItems?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares liquid contents', example: false })
  @IsOptional()
  @IsBoolean()
  containsLiquid?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares electronics', example: false })
  @IsOptional()
  @IsBoolean()
  containsElectronic?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares batteries or battery-powered items', example: false })
  @IsOptional()
  @IsBoolean()
  containsBattery?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares medicines', example: false })
  @IsOptional()
  @IsBoolean()
  containsMedicine?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares perishable items', example: false })
  @IsOptional()
  @IsBoolean()
  containsPerishableItems?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares valuable items', example: false })
  @IsOptional()
  @IsBoolean()
  containsValuableItems?: boolean;

  @ApiPropertyOptional({ description: 'Sender declares documents', example: false })
  @IsOptional()
  @IsBoolean()
  containsDocuments?: boolean;

  @ApiProperty({
    description:
      'Explicit sender self-declaration that the package contains prohibited items. If true, the package will be blocked.',
    example: false,
  })
  @IsBoolean()
  containsProhibitedItems!: boolean;

  @ApiProperty({
    description:
      'Sender confirms they have read and accepted the platform prohibited-items declaration step.',
    example: true,
  })
  @IsBoolean()
  prohibitedItemsDeclarationAccepted!: boolean;
}