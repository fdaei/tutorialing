import { IsOptional, IsString } from 'class-validator';

export class AssignmentDto {
  @IsOptional() @IsString() assignedToId!: string | null;
  @IsOptional() @IsString() note?: string;
}
