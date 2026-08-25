import { UserProfileResponseDto } from '../dto/response/user-profile-response.dto';
import { plainToInstance } from 'class-transformer';

export class UserProfileMapper {
  static toResponse(entity: unknown): UserProfileResponseDto {
    return plainToInstance(UserProfileResponseDto, entity, { excludeExtraneousValues: true });
  }
}
