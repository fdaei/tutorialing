import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from './locale-provider';
import { JalaliDateTimePicker } from './jalali-date-time-picker';

function Harness() {
  const [value, setValue] = useState<Date | null>(null);
  return <LocaleProvider locale="fa"><JalaliDateTimePicker name="startsAt" value={value} onChange={setValue} minDate={new Date('2026-07-19T00:00:00')} /></LocaleProvider>;
}

describe('JalaliDateTimePicker', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T08:00:00'));
  });
  afterAll(() => jest.useRealTimers());

  it('opens a real RTL Jalali calendar and stores the selected value as ISO UTC', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /انتخاب تاریخ و ساعت/ }));
    expect(screen.getByRole('dialog', { name: 'تقویم شمسی' })).toBeTruthy();
    expect(screen.getByText('ش')).toBeTruthy();
    const selectableDay = Array.from(screen.getByRole('dialog').querySelectorAll('button')).find((button) => !button.disabled && /^\d|^[۰-۹]+$/.test(button.textContent ?? '')) as HTMLButtonElement;
    expect(selectableDay).toBeTruthy();
    fireEvent.click(selectableDay);
    fireEvent.click(screen.getByRole('button', { name: 'تأیید' }));
    const hidden = container.querySelector('input[name="startsAt"]') as HTMLInputElement;
    expect(hidden.value).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });
});
