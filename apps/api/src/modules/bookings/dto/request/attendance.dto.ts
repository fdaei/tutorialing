import { IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class AttendanceDto {
  @IsOptional() @IsBoolean() student?: boolean;
  @IsOptional() @IsBoolean() teacher?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) meetingUrl?: string;
}
