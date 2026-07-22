import { Expose } from 'class-transformer';

export class UserProfileResponseDto {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() email?: string;
  @Expose() locale!: string;
  @Expose() timezone!: string;
}
