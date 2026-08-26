import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware (SEC-009)', () => {
  const run = (headerValue: unknown, loggerAssignedValue?: unknown) => {
    const headers: Record<string, unknown> = { 'accept-language': 'en' };
    if (headerValue !== undefined) headers['x-request-id'] = headerValue;
    const setHeader = jest.fn();
    const getHeader = () => loggerAssignedValue;
    new RequestIdMiddleware().use({ headers } as never, { setHeader, getHeader } as never, jest.fn());
    return setHeader.mock.calls.find((call) => call[0] === 'x-request-id')?.[1] as string;
  };

  it('trusts a short, safe-charset client id', () => {
    expect(run('abc-123_XYZ')).toBe('abc-123_XYZ');
  });

  it('replaces an oversized client-supplied id with a fresh one', () => {
    const id = run('x'.repeat(500));
    expect(id).not.toBe('x'.repeat(500));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replaces a client id containing unsafe characters with a fresh one', () => {
    expect(run('not safe\r\nInjected: header')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates one when the client sends none', () => {
    expect(run(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the request id already assigned by the HTTP logger', () => {
    expect(run(undefined, 'logger-generated-id')).toBe('logger-generated-id');
  });
});
