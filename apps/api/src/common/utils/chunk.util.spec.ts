import { chunkByPayloadSize } from './chunk.util';

describe('chunkByPayloadSize', () => {
  it('keeps serialized payloads within the byte budget', () => {
    const items = Array.from({ length: 5 }, () => ({ value: 'a'.repeat(10) }));

    expect(chunkByPayloadSize(items, { maxBytes: 50 }).map((chunk) => chunk.length)).toEqual([2, 2, 1]);
  });

  it('counts UTF-8 bytes instead of JavaScript characters', () => {
    const items = Array.from({ length: 3 }, () => ({ value: 'بله'.repeat(5) }));

    expect(chunkByPayloadSize(items, { maxBytes: 90 }).map((chunk) => chunk.length)).toEqual([2, 1]);
  });

  it('isolates an item larger than the configured budget', () => {
    const items = [{ value: 'a' }, { value: 'a'.repeat(100) }, { value: 'a' }];

    expect(chunkByPayloadSize(items, { maxBytes: 30 })).toEqual([[items[0]], [items[1]], [items[2]]]);
  });

  it('supports protocol-specific serialization', () => {
    const items = ['one', 'two', 'three'];

    expect(chunkByPayloadSize(items, { maxBytes: 6, serialize: (item) => item })).toEqual([['one', 'two'], ['three']]);
  });

  it('returns no chunks for an empty input', () => {
    expect(chunkByPayloadSize([])).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid byte budget %p', (maxBytes) => {
    expect(() => chunkByPayloadSize([], { maxBytes })).toThrow(RangeError);
  });
});
