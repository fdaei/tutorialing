import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ProfileDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(['fa', 'en']) locale!: 'fa' | 'en';
  @IsString() timezone!: string;
}
