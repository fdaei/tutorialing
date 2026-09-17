import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ScheduleCourseSessionDto {
  @IsString() studentId!: string;
  @IsString() courseId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() timezone!: string;
  @IsOptional() @IsString() meetingUrl?: string;
}
