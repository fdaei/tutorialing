'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock3, MapPin, Star, Users, Video } from 'lucide-react';
import type { BlogPost, Course, Language, Teacher } from '@/lib/marketplace-data';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath } from '@/lib/i18n';
import {
  courseBlurb,
  localizedCourseCategory,
  localizedCourseDelivery,
  localizedCourseLanguage,
  localizedCourseLevel,
} from '@/features/courses/course-localization';

const money = (value: number, locale: 'fa' | 'en') =>
  locale === 'fa' ? `${value.toLocaleString('fa-IR')} تومان` : `${value.toLocaleString('en-US')} Toman`;

export function LanguageCard({ language }: { language: Language }) {
  return (
    <article className="market-card group overflow-hidden">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-50 to-violet-100">
        <Image
          src={language.image}
          alt={`تصویر مرتبط با زبان ${language.name}`}
          fill
          sizes="(min-width:1024px) 25vw, 100vw"
          className="object-cover opacity-90 transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{language.flag}</span>
            <div>
              <h3 className="font-black">{language.name}</h3>
              <p className="latin text-xs text-muted">{language.nativeName}</p>
            </div>
          </div>
          <ArrowLeft size={18} className="text-purple" />
        </div>
        <div className="mt-5 flex justify-between text-xs text-muted">
          <span>{language.levels}</span>
          <span>{language.courses.toLocaleString('fa-IR')} دوره</span>
        </div>
        <Link
          href={`/languages/${language.slug}`}
          className="mt-5 flex min-h-11 items-center justify-center rounded-xl border border-purple/35 text-sm font-black text-purple hover:bg-lavender"
        >
          مشاهده دوره‌ها
        </Link>
      </div>
    </article>
  );
}

export function TeacherMarketCard({ teacher }: { teacher: Teacher }) {
  const { locale } = useTranslations();
  return (
    <article className="market-card lift overflow-hidden">
      <div className="relative h-48 bg-indigo-50">
        <Image
          src={teacher.image}
          alt={`تصویر ${teacher.name}`}
          fill
          sizes="(min-width:1024px) 25vw, 100vw"
          className="object-contain object-bottom"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">{teacher.name}</h3>
            <p className="mt-1 text-xs text-purple">{teacher.languages}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold">
            <Star size={15} className="fill-amber-400 text-amber-400" />
            {teacher.rating}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{teacher.specialty}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          <span className="chip">رضایت {teacher.satisfaction.toLocaleString('fa-IR')}٪</span>
          <span className="chip">
            <Users size={13} />
            {teacher.students.toLocaleString('fa-IR')} زبان‌آموز
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t hairline pt-4">
          <span className="text-sm font-black">
            {money(teacher.price, locale)}{' '}
            <small className="font-normal text-muted">/ {locale === 'en' ? 'lesson' : 'جلسه'}</small>
          </span>
          <Link href={`/teachers/${teacher.slug}`} className="text-sm font-black text-purple">
            مشاهده پروفایل
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CourseCard({ course, trial }: { course: Course; trial?: Course }) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const title =
      (english ? course.titleEn : course.titleFa) ?? course.title ?? (english ? 'Language course' : 'دوره زبان'),
    teacher = course.teacherName ?? course.teacher ?? (english ? 'LingoSpeak' : 'لینگواسپیک'),
    lessons = course.lessonsCount ?? course.lessons ?? 0,
    duration = english ? course.durationEn : course.durationFa,
    blurb = courseBlurb(english ? course.descriptionEn : course.descriptionFa);
  const href = localePath(`/courses/${course.slug}`, locale);
  return (
    <article className="course-product-card market-card lift flex flex-col overflow-hidden">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[8/5] bg-indigo-50">
        {course.image ? (
          <Image
            src={course.image}
            alt=""
            fill
            sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            className="object-cover transition duration-500"
          />
        ) : (
          <span className="grid h-full place-items-center text-purple">
            <BookOpen size={36} />
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-navy">
          {course.category
            ? localizedCourseCategory(course.category, locale)
            : `${course.flag ?? ''} ${localizedCourseLanguage(course.language, locale)}`.trim()}
        </span>
        <span className="latin absolute left-3 top-3 rounded-full bg-purple px-3 py-1 text-xs font-bold text-white">
          {localizedCourseLevel(course.level, locale)}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-black leading-7">
          <Link href={href} className="hover:text-purple">
            {title}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-muted">
          {english ? 'Teacher' : 'مدرس'}: {teacher}
        </p>
        {blurb && <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted">{blurb}</p>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {course.delivery && (
            <span className="flex items-center gap-1">
              {course.delivery === 'IN_PERSON' ? <MapPin size={14} /> : <Video size={14} />}
              {localizedCourseDelivery(course.delivery, locale)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock3 size={14} />
            {duration || `${lessons.toLocaleString(english ? 'en-US' : 'fa-IR')} ${english ? 'lessons' : 'جلسه'}`}
          </span>
          <span className="flex items-center gap-1">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {course.reviewsCount ? (
              <>
                <span className="font-bold text-navy">{course.rating}</span>(
                {course.reviewsCount.toLocaleString(english ? 'en-US' : 'fa-IR')})
              </>
            ) : english ? (
              'New'
            ) : (
              'جدید'
            )}
          </span>
        </div>
        <div className="mt-auto pt-5">
          {trial && (
            <Link
              href={localePath(`/courses/${trial.slug}`, locale)}
              className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <span>{english ? 'Trial session' : 'جلسه آزمایشی'}</span>
              <span>{money(trial.price, locale)}</span>
            </Link>
          )}
          <div className="flex items-center justify-between border-t hairline pt-4">
            <strong className="text-sm">{money(course.price, locale)}</strong>
            <Link
              href={href}
              className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-black text-primary-hover hover:bg-primary hover:text-white"
            >
              {english ? 'View course' : 'مشاهده دوره'}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  return (
    <article className="market-card lift overflow-hidden">
      <div className="relative h-40 bg-indigo-50">
        <Image
          src={post.image}
          alt={english ? `Cover for ${post.title}` : `تصویر مقاله ${post.title}`}
          fill
          sizes="(min-width:768px) 33vw, 100vw"
          className="object-cover"
        />
        <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-purple">
          {post.category}
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-black leading-8">{post.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-muted">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>{post.date}</span>
          <span className="flex items-center gap-1">
            <Clock3 size={13} />
            {post.readTime}
          </span>
        </div>
        <Link
          href={localePath(`/blog/${post.slug}`, locale)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-black text-purple"
        >
          {english ? 'Read article' : 'مطالعه مقاله'}{' '}
          <ArrowLeft className={english ? 'rotate-180' : undefined} size={15} />
        </Link>
      </div>
    </article>
  );
}
