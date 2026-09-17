import { ValidateIf } from 'class-validator';
import { IsGoogleMeetUrl } from '../../../../common/validators/is-google-meet-url.decorator';

export class MeetingUrlDto {
  // null or an empty string clears the teacher's standing link.
  @ValidateIf((_, value) => typeof value === 'string' && value.trim() !== '')
  @IsGoogleMeetUrl()
  meetingUrl?: string | null;
}
