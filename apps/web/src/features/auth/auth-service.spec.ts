import { displayPhone, normalizePhone, parseIdentity } from './auth-service';

describe('normalizePhone', () => {
  it.each([
    ['09121234567', '+989121234567'],
    ['9121234567', '+989121234567'],
    ['00989121234567', '+989121234567'],
    ['989121234567', '+989121234567'],
    ['0912 123 4567', '+989121234567'],
    ['0912-123-4567', '+989121234567'],
  ])('normalizes the Iranian number %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('keeps an already international number as-is', () => {
    expect(normalizePhone('+447911123456')).toBe('+447911123456');
  });

  it('rejects numbers that are the wrong length', () => {
    expect(normalizePhone('0912')).toBeNull();
    expect(normalizePhone('091212345678')).toBeNull();
  });
});

describe('parseIdentity', () => {
  it('detects an email and lowercases it', () => {
    expect(parseIdentity('  Someone@Example.COM ')).toEqual({ kind: 'email', email: 'someone@example.com' });
  });

  it('detects a phone number', () => {
    expect(parseIdentity('09121234567')).toEqual({ kind: 'phone', phone: '+989121234567' });
  });

  it('reports anything else as invalid', () => {
    expect(parseIdentity('not-an-identity')).toEqual({ kind: 'invalid' });
    expect(parseIdentity('')).toEqual({ kind: 'invalid' });
  });
});

describe('displayPhone', () => {
  it('shows Iranian numbers in their local form', () => {
    expect(displayPhone('+989121234567')).toBe('09121234567');
  });

  it('leaves other countries international', () => {
    expect(displayPhone('+447911123456')).toBe('+447911123456');
  });
});
