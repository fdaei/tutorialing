import { Expose } from 'class-transformer';

export class UserProfileResponseDto {
  @Expose() id!: string;
  @Expose() phone!: string;
  @Expose() name!: string;
  @Expose() email?: string;
  @Expose() locale!: string;
  @Expose() timezone!: string;
  @Expose() profileComplete!: boolean;
  @Expose() status!: string;
  @Expose() roles!: string[];
  @Expose() permissions!: string[];
}
