import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @Length(2, 3000) comment?: string;
}
