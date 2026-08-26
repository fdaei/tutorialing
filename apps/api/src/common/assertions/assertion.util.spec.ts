import { badRequest, notFound } from '../errors/domain.exception';
import { assertDomain, requireValue } from './assertion.util';

describe('domain assertions', () => {
  it('returns a present lookup value with its original type', () => {
    const value = { id: 'teacher-1' } as { id: string } | undefined;

    expect(requireValue(value, () => notFound('TEACHER_NOT_FOUND'))).toBe(value);
  });

  it('creates lazy exceptions only when an invariant fails', () => {
    const factory = jest.fn(() => badRequest('VALUE_INVALID'));

    assertDomain(true, factory);
    expect(factory).not.toHaveBeenCalled();

    expect(() => assertDomain(false, factory)).toThrow(
      expect.objectContaining({ response: { code: 'VALUE_INVALID', fieldErrors: {} } }),
    );
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('accepts an already-created domain exception', () => {
    const error = notFound('RESOURCE_NOT_FOUND');

    expect(() => requireValue(null, error)).toThrow(error);
  });
});
