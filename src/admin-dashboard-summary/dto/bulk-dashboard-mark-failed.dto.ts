import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class BulkDashboardMarkFailedDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}