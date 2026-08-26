export const REVOCATION_STORE = Symbol('REVOCATION_STORE');

export interface RevocationStore {
  revokeUser(userId: string, revokedAt: number, ttlSeconds: number): Promise<void>;
  revokedAt(userId: string): Promise<number>;
}
