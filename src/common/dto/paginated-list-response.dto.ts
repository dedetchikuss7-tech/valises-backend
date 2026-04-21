import { ApiProperty } from '@nestjs/swagger';

export class PaginatedListResponseDto<T> {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  hasMore!: boolean;

  items!: T[];
}