export type Language = { slug: string; name: string; nativeName: string; flag: string; image: string; levels: string; courses: number };
export type Course = { slug: string; title: string; language: string; flag: string; level: string; teacher: string; rating: number; lessons: number; price: number; image: string };
export type Teacher = { slug: string; name: string; languages: string; specialty: string; rating: number; satisfaction: number; students: number; price: number; image: string };
export type BlogPost = { slug: string; category: string; title: string; excerpt: string; date: string; readTime: string; image: string };
export type SiteStatistic = { label: string; value: string; icon: 'students' | 'teachers' | 'rating' | 'classes' };

const cityImage = '/images/lingospeak-student.png';

export const languages: Language[] = [
  { slug: 'english', name: 'انگلیسی', nativeName: 'English', flag: '🇬🇧', image: cityImage, levels: 'A1 تا C2', courses: 28 },
  { slug: 'german', name: 'آلمانی', nativeName: 'Deutsch', flag: '🇩🇪', image: '/images/auth/register.png', levels: 'A1 تا C1', courses: 18 },
  { slug: 'french', name: 'فرانسوی', nativeName: 'Français', flag: '🇫🇷', image: '/images/auth/login.png', levels: 'A1 تا C1', courses: 14 },
  { slug: 'spanish', name: 'اسپانیایی', nativeName: 'Español', flag: '🇪🇸', image: '/images/auth/forgot.png', levels: 'A1 تا B2', courses: 12 },
];

export const teachers: Teacher[] = [
  { slug: 'sara-mohammadi', name: 'سارا محمدی', languages: 'انگلیسی و آلمانی', specialty: 'مکالمه و آمادگی آزمون', rating: 4.9, satisfaction: 98, students: 186, price: 390000, image: '/images/auth/login.png' },
  { slug: 'amir-hosseini', name: 'امیر حسینی', languages: 'فرانسوی', specialty: 'مکالمه روزمره و مهاجرت', rating: 4.8, satisfaction: 96, students: 142, price: 340000, image: '/images/auth/register.png' },
  { slug: 'maryam-karimi', name: 'مریم کریمی', languages: 'آلمانی', specialty: 'گوته و زبان دانشگاهی', rating: 4.9, satisfaction: 99, students: 211, price: 420000, image: '/images/auth/verify.png' },
  { slug: 'nima-yousefi', name: 'نیما یوسفی', languages: 'اسپانیایی و انگلیسی', specialty: 'مکالمه فشرده', rating: 4.7, satisfaction: 95, students: 98, price: 320000, image: '/images/auth/reset.png' },
];

export const courses: Course[] = [
  { slug: 'english-conversation', title: 'مکالمه روان انگلیسی', language: 'انگلیسی', flag: '🇬🇧', level: 'B1', teacher: 'سارا محمدی', rating: 4.9, lessons: 16, price: 2980000, image: cityImage },
  { slug: 'german-zero', title: 'آلمانی از صفر تا مکالمه', language: 'آلمانی', flag: '🇩🇪', level: 'A1', teacher: 'مریم کریمی', rating: 4.9, lessons: 20, price: 3490000, image: '/images/auth/register.png' },
  { slug: 'french-travel', title: 'فرانسوی برای سفر', language: 'فرانسوی', flag: '🇫🇷', level: 'A2', teacher: 'امیر حسینی', rating: 4.8, lessons: 12, price: 2490000, image: '/images/auth/login.png' },
  { slug: 'spanish-everyday', title: 'اسپانیایی برای زندگی روزمره', language: 'اسپانیایی', flag: '🇪🇸', level: 'A2', teacher: 'نیما یوسفی', rating: 4.7, lessons: 14, price: 2690000, image: '/images/auth/forgot.png' },
];

export const statistics: SiteStatistic[] = [
  { label: 'زبان‌آموز فعال', value: '+۱۲۰٬۰۰۰', icon: 'students' },
  { label: 'مدرس متخصص', value: '+۱٬۲۰۰', icon: 'teachers' },
  { label: 'میانگین رضایت', value: '۴٫۹ از ۵', icon: 'rating' },
  { label: 'کلاس برگزارشده', value: '+۲۵٬۰۰۰', icon: 'classes' },
];

export const posts: BlogPost[] = [
  { slug: 'daily-language-plan', category: 'برنامه‌ریزی', title: 'چطور هر روز برای زبان وقت پیدا کنیم؟', excerpt: 'یک برنامه ساده و قابل اجرا برای ساختن عادت یادگیری، حتی در روزهای شلوغ.', date: '۶ شهریور ۱۴۰۵', readTime: '۶ دقیقه', image: '/images/auth/forgot.png' },
  { slug: 'remember-vocabulary', category: 'یادگیری', title: '۱۰ راه علمی برای ماندگار کردن لغت‌ها', excerpt: 'روش‌هایی که کمک می‌کنند واژه‌های تازه از حافظه کوتاه‌مدت عبور کنند.', date: '۳ شهریور ۱۴۰۵', readTime: '۸ دقیقه', image: '/images/auth/register.png' },
  { slug: 'confident-speaking', category: 'مکالمه', title: 'چطور بدون ترس شروع به صحبت کنیم؟', excerpt: 'تمرین‌های کوتاه برای کاهش اضطراب و روان‌تر شدن مکالمه به زبان جدید.', date: '۱ شهریور ۱۴۰۵', readTime: '۵ دقیقه', image: cityImage },
];

export const marketplaceService = {
  getLanguages: async () => languages,
  getLanguage: async (slug: string) => languages.find((item) => item.slug === slug),
  getCourses: async () => courses,
  getTeachers: async () => teachers,
  getPosts: async () => posts,
  getStatistics: async () => statistics,
};
