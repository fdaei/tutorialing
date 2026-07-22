import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class UploadDto {
  @IsString() originalName!: string;
  @IsString() mimeType!: string;
  @IsInt() @Min(1) @Max(52428800) size!: number;
  @Matches(/^[a-f0-9]{64}$/i) checksum!: string;
  @IsString() purpose!: string;
}
