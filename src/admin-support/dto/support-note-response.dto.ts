import { ApiProperty } from '@nestjs/swagger';

export class SupportNoteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isInternal!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
