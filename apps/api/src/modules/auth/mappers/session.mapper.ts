import { plainToInstance } from 'class-transformer';
import { SessionResponseDto } from '../dto/response/session-response.dto';

export class SessionMapper {
  static toResponse(session: unknown): SessionResponseDto {
    return plainToInstance(SessionResponseDto, session, { excludeExtraneousValues: true });
  }
}
