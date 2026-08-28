export async function calculateSha256(body: Blob): Promise<string> {
  const data = await crypto.subtle.digest('SHA-256', await body.arrayBuffer());
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
