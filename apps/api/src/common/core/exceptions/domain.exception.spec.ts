import { HttpStatus } from '@nestjs/common';
import { prismaToDomain } from './domain.exception';

const prismaError = (code: string) => Object.assign(new Error('prisma failed'), { code });

describe('prismaToDomain', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT, 'RESOURCE_ALREADY_EXISTS'],
    ['P2025', HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND'],
    ['P2003', HttpStatus.BAD_REQUEST, 'RELATED_RECORD_MISSING'],
    ['P2014', HttpStatus.CONFLICT, 'RELATED_RECORD_IN_USE'],
  ])('maps %s to a bilingual %i', (code, status, expected) => {
    const mapped = prismaToDomain(prismaError(code));
    expect(mapped?.getStatus()).toBe(status);
    const body = mapped?.getResponse() as { code: string; messageFa: string; messageEn: string };
    expect(body.code).toBe(expected);
    expect(body.messageFa).toBeTruthy();
    expect(body.messageEn).toBeTruthy();
  });

  it('leaves unrecognised Prisma codes as server faults rather than disguising them', () => {
    // P1001 is "cannot reach the database" — a genuine 500, not a caller mistake.
    expect(prismaToDomain(prismaError('P1001'))).toBeUndefined();
  });

  it('ignores errors that are not Prisma known-request errors', () => {
    expect(prismaToDomain(new Error('boom'))).toBeUndefined();
    expect(prismaToDomain({ code: 'ECONNREFUSED' })).toBeUndefined();
    expect(prismaToDomain(null)).toBeUndefined();
    expect(prismaToDomain('P2002')).toBeUndefined();
  });
});
