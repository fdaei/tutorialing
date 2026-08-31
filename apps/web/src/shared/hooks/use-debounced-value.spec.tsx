import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('publishes only the latest value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'ز' },
    });

    rerender({ value: 'زب' });
    act(() => jest.advanceTimersByTime(200));
    rerender({ value: 'زبان' });
    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe('ز');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('زبان');
  });
});
