import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { OtpInput, emptyOtp, toAsciiDigits } from './otp-input';

const LENGTH = 6;

function Harness({ onComplete }: { onComplete?: (code: string) => void }) {
  const [value, setValue] = useState(() => emptyOtp(LENGTH));
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const codeOf = () => boxes().map((box) => box.value).join('');

describe('toAsciiDigits', () => {
  it('converts Persian and Arabic-Indic digits', () => {
    expect(toAsciiDigits('۱۲۳۴۵۶')).toBe('123456');
    expect(toAsciiDigits('١٢٣٤٥٦')).toBe('123456');
  });
});

describe('OtpInput', () => {
  it('renders one box per digit with accessible labels', () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(LENGTH);
    expect(screen.getByLabelText('رقم 1 از 6')).toBeDefined();
  });

  it('advances focus as digits are typed', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: '1' } });
    expect(document.activeElement).toBe(boxes()[1]);
    fireEvent.change(boxes()[1]!, { target: { value: '2' } });
    expect(document.activeElement).toBe(boxes()[2]);
    expect(codeOf()).toBe('12');
  });

  it('ignores non-numeric input', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: 'a' } });
    expect(codeOf()).toBe('');
  });

  it('accepts Persian digits', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: '۷' } });
    expect(boxes()[0]!.value).toBe('7');
  });

  it('moves back to the previous box on backspace in an empty box', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: '1' } });
    fireEvent.keyDown(boxes()[1]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(boxes()[0]);
    expect(codeOf()).toBe('');
  });

  it('clears only the focused box without shifting later digits', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => '123456' } });
    fireEvent.change(boxes()[2]!, { target: { value: '' } });
    expect(boxes().map((box) => box.value)).toEqual(['1', '2', '', '4', '5', '6']);
  });

  it('distributes a pasted code across every box and fires onComplete', () => {
    const onComplete = jest.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => '123456' } });
    expect(codeOf()).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('strips separators and extra characters from a pasted code', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => 'کد: 12-34 56 789' } });
    expect(codeOf()).toBe('123456');
  });

  it('spills a multi-character autofill forward from the first box', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: '987654' } });
    expect(codeOf()).toBe('987654');
  });

  it('opens a numeric keyboard on mobile', () => {
    render(<Harness />);
    expect(boxes()[0]!.getAttribute('inputmode')).toBe('numeric');
    expect(boxes()[0]!.getAttribute('autocomplete')).toBe('one-time-code');
    expect(boxes()[1]!.getAttribute('autocomplete')).toBe('off');
  });
});
