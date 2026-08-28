'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useTranslations } from '@/components/shared/locale-provider';

export function StartTestLink() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    me = useQuery({ queryKey: ['start-test-me'], queryFn: () => api('/users/me'), retry: false });
  const direct = localePath('/test/device-check', locale),
    href = me.data ? direct : localePath(`/auth?next=${direct}`, locale);
  if (me.isLoading)
    return (
      <span className="brand-gradient cursor-wait rounded-xl px-7 py-4 font-black text-white opacity-60">
        {translate(locale, 'testsstartTestLinkCheckingAccount')}
      </span>
    );
  return (
    <Link href={href} className="brand-gradient rounded-xl px-7 py-4 font-black text-white">
      {me.data
        ? translate(locale, 'testsstartTestLinkStartTest')
        : translate(locale, 'testsstartTestLinkSignInAndStart')}
    </Link>
  );
}
