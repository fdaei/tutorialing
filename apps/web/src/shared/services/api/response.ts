import { ApiError } from './api-error';

export async function parseResponse(r: Response) {
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, body);
  return body;
}
