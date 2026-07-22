import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AssignmentDto {
  @IsString() title!: string;
  @IsString() instructions!: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
