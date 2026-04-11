import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkDashboardItemIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}