import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkDashboardCompleteItemsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}