export async function calculateSha256(body: Blob): Promise<string> {
  const data = await crypto.subtle.digest('SHA-256', await body.arrayBuffer());
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The same digest in the base64 form storage's `x-amz-checksum-sha256` header takes. */
export function sha256HexToBase64(hex: string): string {
  const bytes = hex.match(/[0-9a-f]{2}/gi) ?? [];
  return btoa(String.fromCharCode(...bytes.map((pair) => parseInt(pair, 16))));
}
