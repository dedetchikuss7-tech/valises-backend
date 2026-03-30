import { ApiProperty } from '@nestjs/swagger';
import { ListPricingCorridorsResponseDto } from './list-pricing-corridors-response.dto';

export class ListPricingCorridorsResultDto {
  @ApiProperty({
    description: 'Returned pricing corridor items',
    type: ListPricingCorridorsResponseDto,
    isArray: true,
  })
  items!: ListPricingCorridorsResponseDto[];

  @ApiProperty({
    description: 'Number of items returned in this response',
    example: 2,
  })
  count!: number;

  @ApiProperty({
    description: 'Applied limit for this response',
    example: 100,
  })
  limit!: number;

  @ApiProperty({
    description: 'Applied offset for this response',
    example: 0,
  })
  offset!: number;

  @ApiProperty({
    description:
      'Total number of pricing corridors matching the current filters, regardless of the applied pagination',
    example: 143,
  })
  total!: number;
}