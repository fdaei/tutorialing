import { BadRequestException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

function host(language: string, json: jest.Mock) {
  const status = jest.fn(() => ({ json }));
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status, getHeader: () => 'request-id' }),
      getRequest: () => ({
        headers: { 'accept-language': language },
        method: 'POST',
        url: '/api/tests',
      }),
    }),
  } as never;
}

describe('ApiExceptionFilter', () => {
  it('returns Persian validation errors when requested', () => {
    const json = jest.fn();
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'), host('fa-IR', json));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'fa',
      message: 'این جلسه آزمون بسته شده است.',
    }));
  });

  it('keeps English errors in English', () => {
    const json = jest.fn();
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'), host('en', json));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'en',
      message: 'Attempt is closed',
    }));
  });
});
