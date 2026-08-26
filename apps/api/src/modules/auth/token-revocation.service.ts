import { Inject, Injectable } from '@nestjs/common';
import { REVOCATION_STORE, RevocationStore } from './revocation-store.port';

/**
 * Invalidates already-issued access tokens.
 *
 * Access tokens are stateless and carry the holder's roles and permissions
 * baked in at issuance, so suspending a user or stripping a role only took
 * effect once their current token expired — up to 15 minutes of continued
 * ADMIN or FINANCE access after the privilege was taken away. `refresh()`
 * already re-reads live state and refuses to mint a replacement, so this closes
 * the remaining window on the token the user is already holding.
 *
 * The marker is a per-user timestamp rather than a token blacklist: one write
 * invalidates every outstanding session for that user, including ones issued on
 * other devices, without having to enumerate them.
 */
@Injectable()
export class TokenRevocationService {
  /**
   * Comfortably longer than the 15-minute access-token lifetime
   * (`auth.module.ts`), so a marker always outlives every token it has to
   * invalidate; past that point no token old enough to be affected can still
   * verify, and the key is free to expire rather than accumulate forever.
   */
  private static readonly TTL_SECONDS = 3600;

  constructor(@Inject(REVOCATION_STORE) private readonly store: RevocationStore) {}

  /** Voids every access token issued to this user up to now. */
  async revokeUser(userId: string) {
    // Seconds since epoch, matching the unit of the JWT `iat` claim this is
    // compared against.
    const now = Math.floor(Date.now() / 1000);
    await this.store.revokeUser(userId, now, TokenRevocationService.TTL_SECONDS);
  }

  /** Seconds-since-epoch of the last revocation, or 0 if the user has none. */
  async revokedAt(userId: string) {
    return this.store.revokedAt(userId);
  }
}
