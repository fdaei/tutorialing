import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

// Classes run on Google Meet, so only a meet.google.com room link is accepted —
// an arbitrary URL would be shown to students as the "join class" link.
export const GOOGLE_MEET_URL_PATTERN = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?[^\s]*)?$/;

export const IsGoogleMeetUrl = () =>
  applyDecorators(
    IsString(),
    Matches(GOOGLE_MEET_URL_PATTERN, {
      message: 'meetingUrl must be a Google Meet link (https://meet.google.com/abc-defg-hij)',
    }),
  );
