import { IsString, Length } from 'class-validator';

export class CancelDto {
  @IsString()
  @Length(5, 500, { message: 'Reason must be between 5 and 500 characters' })
  reason!: string;
}
