export function createHeaders(init?: RequestInit, token?: string | null) {
  return { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...init?.headers };
}
