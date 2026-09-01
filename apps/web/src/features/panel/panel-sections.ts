type SectionConfig = readonly [titleFa: string, titleEn: string, endpoint: string];

export const studentSectionConfig = {
  classes: ['کلاس‌ها و تقویم', 'Classes and calendar', '/bookings/me'],
  tests: ['آزمون‌ها و نتایج', 'Tests and results', '/tests/attempts/history'],
  matches: ['مدرس‌های پیشنهادی', 'Recommended teachers', '/matching/history'],
  plan: ['برنامه یادگیری و تکلیف‌ها', 'Learning plan and assignments', '/learning/plans'],
  wallet: ['کیف پول و پرداخت‌ها', 'Wallet and payments', '/payments/wallet'],
  notifications: ['اعلان‌ها', 'Notifications', '/notifications'],
  tickets: ['تیکت‌های پشتیبانی', 'Support tickets', '/support/tickets'],
  profile: ['پروفایل و تنظیمات', 'Profile and settings', '/users/me'],
  courses: ['دوره‌های من', 'My courses', '/courses/me/learning'],
} as const satisfies Record<string, SectionConfig>;

export const teacherSectionConfig = {
  profile: ['پروفایل عمومی', 'Public profile', '/teacher/application'],
  verification: ['وضعیت درخواست و احراز', 'Application and verification', '/teacher/application'],
  video: ['ویدیوی معرفی', 'Introduction video', '/teacher/application'],
  languages: ['زبان‌های آموزشی', 'Teaching languages', '/teacher/application'],
  specialties: ['تخصص‌ها و سطح‌ها', 'Specialties and levels', '/teacher/application'],
  availability: ['دسترسی هفتگی', 'Weekly availability', '/availability/me'],
  calendar: ['تقویم و مسدودی‌ها', 'Calendar and blocked periods', '/availability/me'],
  classes: ['کلاس‌ها', 'Classes', '/bookings/me'],
  students: ['زبان‌آموزان', 'Students', '/bookings/students'],
  plans: ['برنامه‌های یادگیری', 'Learning plans', '/learning/plans'],
  earnings: ['درآمد و تسویه', 'Earnings and payouts', '/teacher/finance'],
  tickets: ['تیکت‌ها', 'Tickets', '/support/tickets'],
  reviews: ['نظرات و امتیازها', 'Reviews and ratings', '/teacher/application'],
  notifications: ['اعلان‌ها', 'Notifications', '/notifications'],
  settings: ['تنظیمات', 'Settings', '/users/me'],
  magazine: ['مجله', 'Magazine', '/blog/instructor/posts'],
  courses: ['دوره‌های من', 'My courses', '/instructor/courses'],
  pricing: ['قیمت‌گذاری', 'Pricing', '/teacher-prices/me'],
  more: ['ابزارهای بیشتر', 'More tools', '/users/me'],
} as const satisfies Record<string, SectionConfig>;

export type StudentSection = keyof typeof studentSectionConfig;
export type TeacherSection = keyof typeof teacherSectionConfig;

function hasSection<T extends object>(config: T, value: string): value is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(config, value);
}

export const isStudentSection = (value: string): value is StudentSection => hasSection(studentSectionConfig, value);
export const isTeacherSection = (value: string): value is TeacherSection => hasSection(teacherSectionConfig, value);
