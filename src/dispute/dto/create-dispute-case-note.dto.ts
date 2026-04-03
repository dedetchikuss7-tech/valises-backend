import { IsString, MinLength } from 'class-validator';

export class CreateDisputeCaseNoteDto {
  @IsString()
  @MinLength(1)
  note!: string;
}