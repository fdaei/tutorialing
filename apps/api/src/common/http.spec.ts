import {BadRequestException}from'@nestjs/common';import{ApiExceptionFilter,RequestIdMiddleware}from'./http';

describe('localized API errors',()=>{
  it('returns Persian validation errors when requested',()=>{
    const json=jest.fn(),status=jest.fn(()=>({json}));
    const host={switchToHttp:()=>({getResponse:()=>({status,getHeader:()=> 'request-id'}),getRequest:()=>({headers:{'accept-language':'fa-IR'},method:'POST',url:'/api/tests'})})};
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'),host as never);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({locale:'fa',message:'این جلسه آزمون بسته شده است.'}));
  });
  it('keeps English errors in English',()=>{
    const json=jest.fn(),status=jest.fn(()=>({json}));
    const host={switchToHttp:()=>({getResponse:()=>({status,getHeader:()=> 'request-id'}),getRequest:()=>({headers:{'accept-language':'en'},method:'POST',url:'/api/tests'})})};
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'),host as never);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({locale:'en',message:'Attempt is closed'}));
  });
});

describe('RequestIdMiddleware (SEC-009)', () => {
  const run = (headerValue: unknown) => {
    const headers: Record<string, unknown> = { 'accept-language': 'en' };
    if (headerValue !== undefined) headers['x-request-id'] = headerValue;
    const setHeader = jest.fn();
    const req = { headers } as never;
    const res = { setHeader } as never;
    new RequestIdMiddleware().use(req, res, jest.fn());
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
    const id = run('not safe\r\nInjected: header');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates one when the client sends none', () => {
    expect(run(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
