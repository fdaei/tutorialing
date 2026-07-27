import { Expose, Type } from 'class-transformer';

export class BookingTeacherDto {
  @Expose() id!: string;
  @Expose() nameFa!: string;
  @Expose() nameEn!: string;
  @Expose() slug!: string;
}

export class BookingStudentDto {
  @Expose() id!: string;
  @Expose() name!: string;
}

export class BookingResponseDto {
  @Expose() id!: string;
  @Expose() startsAt!: Date;
  @Expose() endsAt!: Date;
  @Expose() status!: string;
  @Expose() type!: string;
  @Expose() timezone!: string;

  @Expose()
  @Type(() => BookingTeacherDto)
  teacher?: BookingTeacherDto;

  @Expose()
  @Type(() => BookingStudentDto)
  student?: BookingStudentDto;

  @Expose() link?: string | null;
}
