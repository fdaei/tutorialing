import { IsString, Length, Matches } from 'class-validator';

export class PasswordLoginDto {
  @IsString() @Length(3, 254) identity!: string;
  @IsString() @Length(8, 128) password!: string;
}

export class PasswordRegisterDto extends PasswordLoginDto {
  @IsString() @Length(2, 100) name!: string;
}

export class SetPasswordDto {
  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[^\s]).+$/, { message: 'password must contain non-whitespace characters' })
  password!: string;
}
