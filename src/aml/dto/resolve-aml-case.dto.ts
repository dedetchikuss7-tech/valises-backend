import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveAmlCaseDto {
  @ApiProperty({
    enum: ['ALLOW', 'BLOCK'],
    description: 'Final admin decision for the AML case',
  })
  @IsIn(['ALLOW', 'BLOCK'])
  action!: 'ALLOW' | 'BLOCK';

  @ApiPropertyOptional({
    description: 'Optional admin review notes',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}