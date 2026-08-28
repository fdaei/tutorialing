import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock3, Star, Users } from 'lucide-react';
import type { BlogPost, Course, Language, Teacher } from '@/lib/marketplace-data';

const money = (value: number) => `${value.toLocaleString('fa-IR')} تومان`;

export function LanguageCard({ language }: { language: Language }) {
  return <article className="market-card group overflow-hidden">
    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-50 to-violet-100"><Image src={language.image} alt={`تصویر مرتبط با زبان ${language.name}`} fill sizes="(min-width:1024px) 25vw, 100vw" className="object-cover opacity-90 transition duration-500 group-hover:scale-105" /></div>
    <div className="p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="text-2xl">{language.flag}</span><div><h3 className="font-black">{language.name}</h3><p className="latin text-xs text-muted">{language.nativeName}</p></div></div><ArrowLeft size={18} className="text-purple" /></div>
      <div className="mt-5 flex justify-between text-xs text-muted"><span>{language.levels}</span><span>{language.courses.toLocaleString('fa-IR')} دوره</span></div>
      <Link href={`/languages/${language.slug}`} className="mt-5 flex min-h-11 items-center justify-center rounded-xl border border-purple/35 text-sm font-black text-purple hover:bg-lavender">مشاهده دوره‌ها</Link>
    </div></article>;
}

export function TeacherMarketCard({ teacher }: { teacher: Teacher }) {
  return <article className="market-card lift overflow-hidden"><div className="relative h-48 bg-indigo-50"><Image src={teacher.image} alt={`تصویر ${teacher.name}`} fill sizes="(min-width:1024px) 25vw, 100vw" className="object-contain object-bottom" /></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{teacher.name}</h3><p className="mt-1 text-xs text-purple">{teacher.languages}</p></div><span className="flex items-center gap-1 text-sm font-bold"><Star size={15} className="fill-amber-400 text-amber-400" />{teacher.rating}</span></div><p className="mt-3 text-sm text-muted">{teacher.specialty}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted"><span className="chip">رضایت {teacher.satisfaction.toLocaleString('fa-IR')}٪</span><span className="chip"><Users size={13}/>{teacher.students.toLocaleString('fa-IR')} زبان‌آموز</span></div><div className="mt-5 flex items-center justify-between border-t hairline pt-4"><span className="text-sm font-black">{money(teacher.price)} <small className="font-normal text-muted">/ جلسه</small></span><Link href={`/teachers/${teacher.slug}`} className="text-sm font-black text-purple">مشاهده پروفایل</Link></div></div></article>;
}

export function CourseCard({ course }: { course: Course }) {
  return <article className="market-card lift overflow-hidden"><div className="relative h-40 bg-indigo-50"><Image src={course.image} alt={`تصویر دوره ${course.title}`} fill sizes="(min-width:1024px) 25vw, 100vw" className="object-cover" /><span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black">{course.flag} {course.language}</span><span className="absolute left-3 top-3 rounded-full bg-purple px-3 py-1 text-xs font-bold text-white">{course.level}</span></div><div className="p-5"><h3 className="font-black">{course.title}</h3><p className="mt-2 text-xs text-muted">مدرس: {course.teacher}</p><div className="mt-4 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><Star size={14} className="fill-amber-400 text-amber-400" />{course.rating}</span><span className="flex items-center gap-1"><BookOpen size={14}/>{course.lessons.toLocaleString('fa-IR')} جلسه</span></div><div className="mt-5 flex items-center justify-between border-t hairline pt-4"><strong className="text-sm">{money(course.price)}</strong><Link href={`/courses/${course.slug}`} className="text-sm font-black text-purple">مشاهده دوره</Link></div></div></article>;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return <article className="market-card lift overflow-hidden"><div className="relative h-40 bg-indigo-50"><Image src={post.image} alt={`تصویر مقاله ${post.title}`} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" /><span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-purple">{post.category}</span></div><div className="p-5"><h3 className="text-lg font-black leading-8">{post.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-muted">{post.excerpt}</p><div className="mt-4 flex items-center justify-between text-xs text-muted"><span>{post.date}</span><span className="flex items-center gap-1"><Clock3 size={13}/>{post.readTime}</span></div><Link href={`/blog/${post.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-purple">مطالعه مقاله <ArrowLeft size={15}/></Link></div></article>;
}
