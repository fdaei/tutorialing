import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MeetingUrlDto } from './meeting-url.dto';

const check = (meetingUrl: unknown) => validateSync(plainToInstance(MeetingUrlDto, { meetingUrl }));

describe('MeetingUrlDto', () => {
  it('allows clearing the standing link', () => {
    expect(check(null)).toHaveLength(0);
    expect(check('')).toHaveLength(0);
  });

  it('accepts a Meet link and rejects anything else', () => {
    expect(check('https://meet.google.com/abc-defg-hij')).toHaveLength(0);
    expect(check('https://zoom.us/j/123').length).toBeGreaterThan(0);
  });
});
