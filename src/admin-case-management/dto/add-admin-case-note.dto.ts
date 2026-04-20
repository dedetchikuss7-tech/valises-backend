import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddAdminCaseNoteDto {
  @ApiProperty()
  @IsString()
  note!: string;
}