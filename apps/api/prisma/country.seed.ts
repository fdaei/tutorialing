import type { PrismaClient } from '@prisma/client';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const knownPhoneLengths: Record<string, [number, number]> = {
  IR: [10, 10], AE: [9, 9], TR: [10, 10], GB: [10, 10], DE: [10, 11], FR: [9, 9], CA: [10, 10], US: [10, 10],
};

const countryFlag = (code: string) =>
  String.fromCodePoint(...code.toUpperCase().split('').map((letter) => 127397 + letter.charCodeAt(0)));

export async function seedCountries(db: PrismaClient) {
  const faNames = new Intl.DisplayNames(['fa'], { type: 'region' });
  const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const rows = getCountries()
    .map((code) => ({
      code,
      nameFa: faNames.of(code) ?? code,
      nameEn: enNames.of(code) ?? code,
      dialCode: `+${getCountryCallingCode(code)}`,
      flag: countryFlag(code),
      minLength: knownPhoneLengths[code]?.[0] ?? 4,
      maxLength: knownPhoneLengths[code]?.[1] ?? 15,
      active: true,
      order: code === 'IR' ? 0 : 100,
    }))
    .sort((a, b) => a.order - b.order || a.nameEn.localeCompare(b.nameEn));

  for (const row of rows) {
    await db.country.upsert({ where: { code: row.code }, create: row, update: row });
  }
  return rows.length;
}
