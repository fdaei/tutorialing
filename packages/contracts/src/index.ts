import { z } from 'zod';

export const localeSchema = z.enum(['fa', 'en']);
export const phoneSchema = z.string().regex(/^09\d{9}$/, 'شماره موبایل باید با 09 شروع شود و 11 رقم باشد.');
export const requestOtpSchema = z.object({ phone: phoneSchema });
export const verifyOtpSchema = requestOtpSchema.extend({ code: z.string().regex(/^\d{6}$/, 'کد تأیید باید دقیقاً 6 رقم باشد.') });

export const matchingSchema = z.object({
  languageId: z.string().min(1, 'زبان آموزشی را انتخاب کنید.'),
  currentLevel: z.string().optional(),
  learningGoal: z.string().min(2, 'هدف یادگیری را مشخص کنید.'),
  targetLevel: z.string().optional(),
  targetBand: z.coerce.number().min(0).max(9).multipleOf(.5).optional(),
  currentBand: z.coerce.number().min(0).max(9).multipleOf(.5).optional(),
  examDate: z.string().date().optional(),
  weakSkills: z.array(z.string()).min(1, 'حداقل یک مهارت ضعیف را انتخاب کنید.'),
  budget: z.coerce.number().int().positive('بودجه باید بیشتر از صفر باشد.'),
  suitableDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'حداقل یک روز مناسب را انتخاب کنید.'),
  preferredTime: z.enum(['morning','afternoon','evening']).optional(),
  preferredTeacherGender: z.enum(['female','male','other','prefer_not_to_say']).optional(),
  trialRequired: z.boolean(),
  classType: z.enum(['private','group','either']),
});
export const bookingSchema = z.object({
  teacherId: z.string().min(1),
  startsAt: z.string().datetime(),
  type: z.enum(['trial','regular']),
  policyAccepted: z.literal(true),
  timezone: z.string().min(1),
});
export type MatchingInput = z.infer<typeof matchingSchema>;
export type Skill = string;
export type Role = 'student' | 'teacher' | 'admin';
export type TeacherCard = { id:string; nameFa:string; nameEn:string; bio:string; specialties:Skill[]; rating:number; reviews:number; price:number; trialPrice:number; targetBands:number[]; languages:string[]; nextSlot:string; verified:boolean; matchScore?:number; matchReasons?:string[] };
