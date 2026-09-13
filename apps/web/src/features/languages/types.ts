export type EducationalLanguage = {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  nativeName: string;
  flag?: string;
  imageId?: string | null;
  imageUrl?: string;
  direction: 'LTR' | 'RTL';
  active: boolean;
  order: number;
  proficiencySystem: 'CEFR' | 'CUSTOM';
};
export type Country = {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  dialCode: string;
  flag: string;
  minLength: number;
  maxLength: number;
  active: boolean;
  order: number;
};
