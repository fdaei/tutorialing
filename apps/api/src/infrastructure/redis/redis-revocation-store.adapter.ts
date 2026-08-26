import { Injectable } from '@nestjs/common';
import { RevocationStore } from '../../modules/auth/revocation-store.port';
import { RedisService } from './redis.service';

@Injectable()
export class RedisRevocationStoreAdapter implements RevocationStore {
  constructor(private readonly redis: RedisService) {}

  private key(userId: string) {
    return `revoked:user:${userId}`;
  }

  async revokeUser(userId: string, revokedAt: number, ttlSeconds: number) {
    await this.redis.client.set(this.key(userId), String(revokedAt), 'EX', ttlSeconds);
  }

  async revokedAt(userId: string) {
    const parsed = Number(await this.redis.client.get(this.key(userId)));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
