export const DEFAULT_BULK_PAYLOAD_BYTES = 64 * 1024;

export type PayloadSizeOptions<T> = Readonly<{
  maxBytes?: number;
  serialize?: (item: T) => string;
}>;

/**
 * Splits items by their serialized UTF-8 size rather than by item count.
 * This matters for Persian content and other multibyte text where character
 * count is not a reliable approximation of an HTTP request body.
 *
 * An oversized item is isolated in its own chunk. Silently dropping it or
 * returning an empty chunk would hide the item that the downstream API needs
 * to reject explicitly.
 */
export function chunkByPayloadSize<T>(items: readonly T[], options: PayloadSizeOptions<T> = {}): T[][] {
  const maxBytes = options.maxBytes ?? DEFAULT_BULK_PAYLOAD_BYTES;
  const serialize = options.serialize ?? ((item: T) => JSON.stringify(item) ?? '');

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive safe integer');
  }

  const chunks: T[][] = [];
  let chunk: T[] = [];
  let chunkBytes = 0;

  for (const item of items) {
    const itemBytes = Buffer.byteLength(serialize(item), 'utf8');

    if (chunk.length > 0 && chunkBytes + itemBytes > maxBytes) {
      chunks.push(chunk);
      chunk = [];
      chunkBytes = 0;
    }

    chunk.push(item);
    chunkBytes += itemBytes;
  }

  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}
