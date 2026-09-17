import { IsBoolean, IsOptional } from 'class-validator';
import { IsGoogleMeetUrl } from '../../../../common/validators/is-google-meet-url.decorator';

export class AttendanceDto {
  @IsOptional() @IsBoolean() student?: boolean;
  @IsOptional() @IsBoolean() teacher?: boolean;
  @IsOptional() @IsGoogleMeetUrl() meetingUrl?: string;
}
