'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock, ShieldCheck, Star, Users } from 'lucide-react';
import { api, publicApi, ApiError, apiMessage } from '@/shared/services/api';
import type { PublicTeacher } from '@/features/teacher';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';

type Slot = { startsAt: string; endsAt: string; date: string; timezone: string; type: 'trial' | 'regular' };
export default function Checkout() {
  const params = useSearchParams(),
    router = useRouter(),
    teacherId = params.get('teacher') ?? '',
    { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale),
    Arrow = localized({ fa: ArrowLeft, en: ArrowRight }, locale);
  const me = useQuery({
    queryKey: ['checkout-me'],
    queryFn: () => api<{ roles: string[] }>('/users/me'),
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      const next = `${p('/checkout')}?teacher=${encodeURIComponent(teacherId)}`;
      router.replace(`${p('/auth')}?next=${encodeURIComponent(next)}`);
    }
  }, [me.error, p, router, teacherId]);
  const [lessonType, setLessonType] = useState<'trial' | 'regular'>('trial'),
    [slot, setSlot] = useState<Slot | null>(null),
    [accepted, setAccepted] = useState(false),
    [week, setWeek] = useState(0),
    [discount, setDiscount] = useState('');
  const range = useMemo(() => {
    const from = new Date();
    from.setSeconds(0, 0);
    const to = new Date(from.getTime() + 28 * 864e5);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const teacher = useQuery({
    queryKey: ['teacher-checkout', teacherId],
    queryFn: () => publicApi<PublicTeacher>(`/teachers/${encodeURIComponent(teacherId)}`),
    enabled: !!teacherId,
  });
  const wallet = useQuery({
    queryKey: ['wallet', 'checkout'],
    queryFn: () => api<{ balance: number }>('/payments/wallet'),
    enabled: !!me.data,
  });
  const slots = useQuery({
    queryKey: ['slots', teacherId, lessonType, range.from, range.to],
    queryFn: () =>
      publicApi<Slot[]>(
        `/availability/${teacherId}/slots?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&type=${lessonType}`,
      ),
    enabled: !!teacherId,
  });
  const checkout = useMutation({
    mutationFn: async () => {
      if (!slot) throw new Error(translate(locale, 'checkoutChooseATime'));
      await api<{ id: string }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          teacherId,
          startsAt: slot.startsAt,
          type: lessonType,
          policyAccepted: accepted,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          discountCode: discount.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      location.href = p('/payment/success');
    },
  });
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 28 }, (_, index) => {
      const date = new Date(base.getTime() + index * 864e5);
      const key = date.toLocaleDateString('en-CA');
      return { date, key, slots: (slots.data ?? []).filter((item) => localKey(item.startsAt) === key) };
    });
  }, [slots.data]);
  const weekDays = days.slice(week * 7, week * 7 + 7),
    selectedDay = slot ? localKey(slot.startsAt) : (weekDays.find((day) => day.slots.length)?.key ?? weekDays[0]?.key),
    daySlots = weekDays.find((day) => day.key === selectedDay)?.slots ?? [];
  const t = teacher.data,
    trialPrice = t?.approvedTrialPrice ?? 0,
    regularPrice = t?.approvedRegularPrice ?? 0,
    price = lessonType === 'trial' ? trialPrice : regularPrice,
    walletBalance = wallet.data?.balance ?? 0,
    // A coupon is valued by the backend inside the booking transaction. Do not
    // block a potentially affordable discounted booking using the list price.
    walletInsufficient = wallet.isSuccess && !discount.trim() && walletBalance < price,
    duration = lessonType === 'trial' ? (t?.trialDuration ?? 30) : (t?.lessonDuration ?? 60),
    money = (value: number) =>
      new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(value) +
      translate(locale, 'commercepricingManagerIrr');
  function chooseType(type: 'trial' | 'regular') {
    setLessonType(type);
    setSlot(null);
  }
  if (!me.data) return <div className="skeleton min-h-screen" />;
  if (!teacherId)
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-black">{translate(locale, 'checkoutNoTeacherWasSelected')}</h1>
        <Link href={p('/teachers')} className="mt-6 inline-block text-blue underline">
          {translate(locale, 'checkoutBrowseTeachers')}
        </Link>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#f7f8fc] pb-16">
      <header className="border-b hairline bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={t ? p(`/teachers/${t.slug}`) : p('/teachers')}
            className="flex items-center gap-2 text-sm font-bold text-muted"
          >
            <Arrow size={17} />
            {translate(locale, 'checkoutBackToTeacherProfile')}
          </Link>
          <strong className="latin text-lg">LingoSpeak</strong>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-7 rounded-3xl border hairline bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center gap-4">
            <div className="brand-gradient grid size-16 place-items-center rounded-2xl text-2xl font-black text-white">
              {localized({ fa: t?.nameFa, en: t?.nameEn }, locale)?.slice(0, 1) ?? 'L'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xl font-black">
                {teacher.isLoading
                  ? translate(locale, 'checkoutLoadingTeacher')
                  : localized({ fa: t?.nameFa, en: t?.nameEn }, locale)}
                <BadgeCheck size={19} className="text-blue" />
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Star size={15} fill="#f5a623" className="text-[#f5a623]" />
                  {t?.rating ?? 0} ({t?.reviewsCount ?? 0})
                </span>
                <span className="flex items-center gap-1">
                  <Users size={15} />
                  {new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(
                    t?.successfulClasses ?? 0,
                  )}{' '}
                  {translate(locale, 'checkoutSuccessfulClasses')}
                </span>
                <span>
                  {t?.languageLinks
                    ?.map(
                      (link) =>
                        `${link.language.flag ?? ''} ${localized({ fa: link.language.nameFa, en: link.language.nameEn }, locale)}`,
                    )
                    .join(' · ')}
                </span>
              </div>
            </div>
          </div>
        </div>
        {teacher.isError && <ErrorBox text={translate(locale, 'checkoutCouldNotLoadTheTeacher')} />}
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <div className="rounded-3xl border hairline bg-white p-6">
              <h2 className="text-xl font-black">{translate(locale, 'checkoutChooseTheLessonType')}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <TypeCard
                  active={lessonType === 'trial'}
                  onClick={() => chooseType('trial')}
                  title={translate(locale, 'teacherteacherBookingCardTrialLesson')}
                  detail={`${t?.trialDuration ?? 30} ${translate(locale, 'checkoutMinutes')}`}
                  price={money(trialPrice)}
                />
                <TypeCard
                  active={lessonType === 'regular'}
                  disabled={!regularPrice}
                  onClick={() => chooseType('regular')}
                  title={translate(locale, 'checkoutRegularLesson')}
                  detail={`${t?.lessonDuration ?? 60} ${translate(locale, 'checkoutMinutes')}`}
                  price={regularPrice ? money(regularPrice) : translate(locale, 'checkoutNotCurrentlyAvailable')}
                />
              </div>
            </div>
            <div className="rounded-3xl border hairline bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{translate(locale, 'checkoutDateAndTime')}</h2>
                  <p className="mt-1 text-sm text-muted">{translate(locale, 'checkoutEachStepShowsSevenDays')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={week === 0}
                    onClick={() => {
                      setWeek((value) => value - 1);
                      setSlot(null);
                    }}
                    className="grid size-10 place-items-center rounded-xl border hairline disabled:opacity-30"
                    aria-label={translate(locale, 'checkoutPreviousWeek')}
                  >
                    {localized({ fa: <ArrowRight />, en: <ArrowLeft /> }, locale)}
                  </button>
                  <button
                    disabled={week === 3}
                    onClick={() => {
                      setWeek((value) => value + 1);
                      setSlot(null);
                    }}
                    className="grid size-10 place-items-center rounded-xl border hairline disabled:opacity-30"
                    aria-label={translate(locale, 'checkoutNextWeek')}
                  >
                    {localized({ fa: <ArrowLeft />, en: <ArrowRight /> }, locale)}
                  </button>
                </div>
              </div>
              {slots.isLoading ? (
                <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-7">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="skeleton h-24 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {weekDays.map((day) => (
                      <button
                        key={day.key}
                        disabled={!day.slots.length}
                        onClick={() => setSlot(day.slots[0] ?? null)}
                        className={`rounded-2xl border p-3 text-center transition ${selectedDay === day.key ? 'border-purple bg-lavender text-purple' : 'hairline'} disabled:opacity-35`}
                      >
                        <span className="block text-xs text-muted">
                          {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
                            weekday: 'short',
                          }).format(day.date)}
                        </span>
                        <strong className="mt-1 block text-lg">
                          {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
                            day: 'numeric',
                          }).format(day.date)}
                        </strong>
                        <small className="mt-1 block">
                          {day.slots.length
                            ? `${day.slots.length} ${translate(locale, 'checkoutSlots')}`
                            : translate(locale, 'checkoutFull')}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6">
                    <h3 className="flex items-center gap-2 font-black">
                      <Clock size={18} className="text-purple" />
                      {selectedDay
                        ? new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          }).format(new Date(`${selectedDay}T12:00:00`))
                        : translate(locale, 'checkoutNoDateAvailable')}
                    </h3>
                    {daySlots.length ? (
                      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {daySlots.map((item) => (
                          <button
                            key={item.startsAt}
                            onClick={() => setSlot(item)}
                            className={`rounded-xl border px-3 py-3 font-bold transition ${slot?.startsAt === item.startsAt ? 'border-purple bg-purple text-white shadow-lg' : 'hairline hover:border-purple hover:text-purple'}`}
                          >
                            {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS2'), {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(item.startsAt))}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-2xl border border-dashed hairline p-6 text-center text-sm text-muted">
                        {translate(locale, 'checkoutNoTimesAreAvailableOnThisDayChoose')}
                      </p>
                    )}
                  </div>
                </>
              )}
              {slots.isError && <ErrorBox text={translate(locale, 'checkoutCouldNotLoadAvailableTimesTryAgain')} />}
            </div>
            <label className="flex gap-3 rounded-3xl border hairline bg-white p-6">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 size-5 accent-purple"
              />
              <span>
                <strong>{translate(locale, 'checkoutIHaveReadAndAcceptTheCancellationPolicy')}</strong>
                <span className="mt-2 block text-sm leading-7 text-muted">
                  {localized(
                    {
                      fa: t?.policy?.titleFa ?? 'مبلغ بازپرداخت براساس سیاست ثبت‌شده هنگام رزرو محاسبه می‌شود.',
                      en:
                        t?.policy?.titleEn ??
                        'Refund eligibility is calculated from the policy snapshot saved with the booking.',
                    },
                    locale,
                  )}
                </span>
              </span>
            </label>
          </section>
          <aside>
            <div className="sticky top-6 rounded-3xl bg-navy p-7 text-white shadow-2xl">
              <h2 className="text-xl font-black">{translate(locale, 'checkoutBookingSummary')}</h2>
              <Summary
                icon={<BadgeCheck />}
                label={translate(locale, 'schedulingteacherPlannerCalendarTeacher')}
                value={localized({ fa: t?.nameFa, en: t?.nameEn }, locale)}
              />
              <Summary
                icon={<CalendarDays />}
                label={translate(locale, 'checkoutDateAndTime2')}
                value={
                  slot
                    ? new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(slot.startsAt))
                    : translate(locale, 'checkoutNotSelected')
                }
              />
              <Summary
                icon={<Clock />}
                label={translate(locale, 'checkoutTypeAndDuration')}
                value={`${lessonType === 'trial' ? translate(locale, 'teacherteacherDashboardTrial') : translate(locale, 'checkoutRegular')} · ${duration} ${translate(locale, 'teacherteacherDashboardMin')}`}
              />
              <div className="mt-6 border-t border-white/15 pt-5">
                <label className="text-xs text-white/60">{translate(locale, 'checkoutDiscountCode')}</label>
                <input
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value.toUpperCase())}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 outline-none placeholder:text-white/30"
                  placeholder={translate(locale, 'checkoutOptional')}
                />
              </div>
              <div className="mt-6 flex items-end justify-between">
                <span className="text-sm text-white/60">{translate(locale, 'checkoutFinalAmount')}</span>
                <strong className="text-2xl">{money(price)}</strong>
              </div>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-sm">
                <div className="flex justify-between"><span className="text-white/60">{fa ? 'روش پرداخت' : 'Payment method'}</span><b>{fa ? 'کیف پول' : 'Wallet'}</b></div>
                <div className="mt-3 flex justify-between"><span className="text-white/60">{fa ? 'موجودی کیف پول' : 'Wallet balance'}</span><b>{wallet.isLoading ? '…' : money(walletBalance)}</b></div>
                <div className="mt-3 flex justify-between"><span className="text-white/60">{fa ? 'موجودی پس از رزرو' : 'Balance after booking'}</span><b className={walletInsufficient ? 'text-red-300' : 'text-emerald-300'}>{money(Math.max(0, walletBalance - price))}</b></div>
              </div>
              {walletInsufficient && (
                <div className="mt-5 rounded-xl bg-amber-400/15 p-4 text-sm text-amber-100">
                  <b className="block">{fa ? 'موجودی ناکافی' : 'Insufficient balance'}</b>
                  <span className="mt-1 block">{fa ? 'برای رزرو این نوبت ابتدا کیف پول خود را شارژ کنید.' : 'Top up your wallet before booking this lesson.'}</span>
                  <Link href={p('/dashboard/wallet')} className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 font-black text-navy">{fa ? 'شارژ کیف پول' : 'Top up wallet'}</Link>
                </div>
              )}
              {checkout.isError && (
                <div role="alert" className="mt-5 rounded-xl bg-red-500/15 p-4 text-sm text-red-100">
                  {apiMessage(checkout.error, translate(locale, 'checkoutBookingFailedTheSlotMayHaveJustBeen'))}
                </div>
              )}
              <button
                disabled={!slot || !accepted || checkout.isPending || !price || walletInsufficient || wallet.isLoading}
                onClick={() => checkout.mutate()}
                className="brand-gradient mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-black text-white disabled:opacity-40"
              >
                {checkout.isPending
                  ? translate(locale, 'checkoutFinalAvailabilityCheck')
                  : (fa ? 'پرداخت از کیف پول و رزرو' : 'Pay from wallet and book')}
                <ShieldCheck size={18} />
              </button>
              <p className="mt-4 text-center text-xs leading-6 text-white/45">
                {translate(locale, 'checkoutTheServerRechecksAvailabilityBeforeConfirmingTheBooking')}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
function localKey(value: string) {
  const d = new Date(value),
    y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function TypeCard({
  active,
  disabled,
  onClick,
  title,
  detail,
  price,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  price: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border p-5 text-start transition ${active ? 'border-purple bg-lavender ring-2 ring-purple/10' : 'hairline hover:border-purple'} disabled:opacity-40`}
    >
      <strong className="block">{title}</strong>
      <span className="mt-2 block text-sm text-muted">{detail}</span>
      <span className="mt-4 block font-black text-blue">{price}</span>
    </button>
  );
}
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="mt-5 flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 [&>svg]:size-4">{icon}</span>
      <span>
        <small className="block text-white/50">{label}</small>
        <strong className="mt-1 block text-sm">{value || '—'}</strong>
      </span>
    </div>
  );
}
function ErrorBox({ text }: { text: string }) {
  return (
    <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800">
      {text}
    </div>
  );
}
