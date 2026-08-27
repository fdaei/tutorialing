import { Expose, Type } from 'class-transformer';

class SessionUserDto {
  @Expose() id!: string;
  @Expose() phone!: string | null;
  @Expose() name!: string | null;
  @Expose() locale!: string;
  @Expose() timezone!: string;
  @Expose() profileComplete!: boolean;
  @Expose() roles!: string[];
  @Expose() permissions!: string[];
}

/**
 * Whitelist-based: only `@Expose()`d fields survive `plainToInstance(...,
 * { excludeExtraneousValues: true })`. `refreshToken` (set as an httpOnly
 * cookie, never the response body) is deliberately absent here rather than
 * stripped by hand, so it can't leak if the service's return shape changes.
 */
export class SessionResponseDto {
  @Expose() accessToken!: string;
  @Expose() expiresIn!: number;
  @Expose()
  @Type(() => SessionUserDto)
  user!: SessionUserDto;
}
