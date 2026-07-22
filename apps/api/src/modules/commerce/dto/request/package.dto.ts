import { IsInt, IsString, Min } from 'class-validator';

export class PackageDto {
  @IsString() titleFa!: string;
  @IsString() titleEn!: string;
  @IsString() descriptionFa!: string;
  @IsString() descriptionEn!: string;
  @IsInt() @Min(1) credits!: number;
  @IsInt() @Min(15) lessonMinutes!: number;
  @IsInt() @Min(1) price!: number;
}
