import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { PACKAGE_TIERS } from '@lingospeak/contracts';


export class PackageDto {
  @IsString() @MaxLength(120) titleFa!: string;
  @IsString() @MaxLength(120) titleEn!: string;
  @IsString() @MaxLength(2000) descriptionFa!: string;
  @IsString() @MaxLength(2000) descriptionEn!: string;
  /** Sellable session tiers: single session, 5, 10, 15, or 20. */
  @IsIn(PACKAGE_TIERS) credits!: number;
  @IsInt() @Min(15) @Max(240) lessonMinutes!: number;
  /**
   * The teacher's own discount for buying the tier up front. The price itself is
   * derived from their admin-approved lesson rate rather than supplied here, so a
   * package cannot be used to sell lessons at a rate that never passed review.
   */
  @IsInt() @Min(0) @Max(80) discountPercent!: number;
}

export class PackageApprovalDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
