'use client';

import { isDefaultLocale } from '@/lib/i18n';
import { useTranslations } from '@/components/shared/locale-provider';
import { AdminActions } from './actions/admin';
import { StudentActions } from './actions/student';
import { TeacherActions } from './actions/teacher';
import type { Props } from './actions/shared/action-controls';

export function PanelActions({ role, section, endpoint }: Props) {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  if (role === 'student') return <StudentActions section={section} endpoint={endpoint} fa={fa} />;
  if (role === 'teacher') return <TeacherActions section={section} endpoint={endpoint} fa={fa} />;
  return <AdminActions section={section} endpoint={endpoint} fa={fa} />;
}
