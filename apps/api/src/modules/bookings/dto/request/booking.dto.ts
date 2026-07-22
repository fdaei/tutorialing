import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class BookingDto {
  @IsString() teacherId!: string;
  @IsDateString() startsAt!: string;
  @IsIn(['trial', 'regular']) type!: 'trial' | 'regular';
  @IsOptional() @IsString() enrollmentId?: string;
  @IsBoolean() policyAccepted!: boolean;
  @IsString() timezone!: string;
}
