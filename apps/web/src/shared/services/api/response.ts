import { ApiError } from './api-error';

// 204/205 legitimately carry no body; anything else that fails to parse is a
// broken response (an HTML error page, a proxy placeholder, a truncated body).
// Returning null for those used to type-launder the failure into `T` and blow
// up later at an unrelated property access, far from the request that caused it.
const NO_BODY_STATUSES = new Set([204, 205]);

export async function parseResponse(r: Response) {
  const body = await r.json().catch(() => undefined);
  if (!r.ok) throw new ApiError(r.status, body);
  if (body !== undefined) return body;
  if (NO_BODY_STATUSES.has(r.status)) return null;
  throw new ApiError(r.status, { code: 'INVALID_RESPONSE_BODY' });
}
