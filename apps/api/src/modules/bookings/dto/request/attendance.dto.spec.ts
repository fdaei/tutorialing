import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceDto } from './attendance.dto';

const errors = (meetingUrl: string) => validateSync(plainToInstance(AttendanceDto, { meetingUrl }));

describe('AttendanceDto.meetingUrl', () => {
  it('accepts a Google Meet room link', () => {
    expect(errors('https://meet.google.com/abc-defg-hij')).toHaveLength(0);
    expect(errors('https://meet.google.com/abc-defg-hij?authuser=0')).toHaveLength(0);
  });

  it.each([
    'http://meet.google.com/abc-defg-hij',
    'https://evil.example/abc-defg-hij',
    'https://meet.google.com.evil.example/abc-defg-hij',
    'javascript:alert(1)',
    'https://meet.google.com/',
  ])('rejects %s', (url) => {
    expect(errors(url).length).toBeGreaterThan(0);
  });
});
