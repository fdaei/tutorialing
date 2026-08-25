'use client';

import { useState } from 'react';
import { BadgeCheck, FileCheck2, UserRound, Video } from 'lucide-react';
import { PanelActions } from '@/features/panel/components/panel-actions';
import { useTranslations } from '@/components/shared/locale-provider';

export function TeacherProfileHub() {
  const { locale } = useTranslations(),
    fa = locale === 'fa',
    [tab, setTab] = useState<'profile' | 'documents' | 'video'>('profile');
  const tabs = [
    ['profile', UserRound, fa ? 'اطلاعات پروفایل' : 'Profile details'],
    ['documents', FileCheck2, fa ? 'مدارک و تأیید' : 'Documents'],
    ['video', Video, fa ? 'ویدیوی معرفی' : 'Intro video'],
  ] as const;
  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold text-blue">{fa ? 'ویترین حرفه‌ای شما' : 'Your professional presence'}</p>
          <h1 className="text-3xl font-black">{fa ? 'پروفایل و تأیید مدرس' : 'Profile & verification'}</h1>
          <p className="mt-2 text-muted">
            {fa
              ? 'اطلاعاتی که زبان‌آموز می‌بیند و مراحل تأیید حساب، در یک صفحه.'
              : 'Public details and account verification in one place.'}
          </p>
        </div>
        <span className="status-pill status-info gap-2">
          <BadgeCheck size={16} />
          {fa ? 'پروفایل مدرس' : 'Teacher profile'}
        </span>
      </header>
      <div className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border hairline bg-white p-2">
        {tabs.map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${tab === key ? 'bg-indigo-600 text-white shadow-md' : 'text-muted hover:bg-slate-50'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === 'profile' ? (
          <PanelActions role="teacher" section="profile" endpoint="/teacher/application" />
        ) : tab === 'documents' ? (
          <PanelActions role="teacher" section="verification" endpoint="/teacher/application" />
        ) : (
          <PanelActions role="teacher" section="video" endpoint="/teacher/application" />
        )}
      </div>
    </div>
  );
}
