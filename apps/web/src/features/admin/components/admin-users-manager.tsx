'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { api, ApiError, Paginated } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'STAFF' | 'EXAMINER' | 'SUPPORT' | 'FINANCE';
type User = {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  status: string;
  locale: string;
  createdAt: string;
  roles: { role: Role }[];
};
type Activity = {
  status?: string;
  title?: string;
  subject?: string;
  purpose?: string;
  amount?: number;
  overallBand?: number | null;
  startsAt?: string;
  createdAt?: string;
  updatedAt?: string;
  test?: { titleFa: string; titleEn: string };
  teacher?: { nameFa: string; nameEn: string };
};
type Detail = User & {
  teacher?: { nameFa: string; nameEn: string; status: string; rating: number; reviewsCount: number };
  bookings: Activity[];
  attempts: Activity[];
  payments: Activity[];
  tickets: Activity[];
  learningPlans: Activity[];
  _count: Record<string, number>;
};

const allRoles: Role[] = ['STUDENT', 'TEACHER', 'ADMIN', 'STAFF', 'EXAMINER', 'SUPPORT', 'FINANCE'];
const roleFa: Record<Role, string> = {
  STUDENT: 'زبان‌آموز',
  TEACHER: 'مدرس',
  ADMIN: 'مدیر',
  STAFF: 'همکار',
  EXAMINER: 'ارزیاب',
  SUPPORT: 'پشتیبانی',
  FINANCE: 'مالی',
};
const statusFa: Record<string, string> = {
  ACTIVE: 'فعال',
  SUSPENDED: 'تعلیق‌شده',
  DELETED: 'حذف‌شده',
  IN_PROGRESS: 'در حال انجام',
  UNDER_REVIEW: 'در انتظار بررسی',
  APPROVED: 'تأییدشده',
  PAID: 'پرداخت‌شده',
  PENDING: 'در انتظار',
  OPEN: 'باز',
  RESOLVED: 'حل‌شده',
};

export function AdminUsersManager() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    qc = useQueryClient(),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [draft, setDraft] = useState(''),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState<string>();
  const query = useQuery({
    queryKey: ['admin-users', page, search, status],
    queryFn: () =>
      api<Paginated<User>>(`/admin/users?page=${page}&search=${encodeURIComponent(search)}&status=${status}`),
  });
  const data = query.data;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  }
  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-bold text-purple">{translate(locale, 'adminadminUsersManagerAccountsAndAccess')}</p>
        <h1 className="mt-2 text-3xl font-black">{translate(locale, 'adminadminUsersManagerUsers')}</h1>
        <p className="mt-2 text-sm text-muted">
          {translate(locale, 'adminadminUsersManagerManageEachUserSDetailsRolesAndActivity')}
        </p>
      </div>
      <div className="panel-card overflow-hidden">
        <form onSubmit={submit} className="flex flex-col gap-3 border-b hairline p-4 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4">
            <Search size={18} className="text-muted" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-transparent py-3 outline-none"
              placeholder={translate(locale, 'adminadminUsersManagerSearchNamePhoneOrEmail')}
            />
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border hairline bg-white px-4 py-3"
          >
            <option value="">{translate(locale, 'commercepricingManagerAllStatuses')}</option>
            <option value="ACTIVE">{translate(locale, 'admincountryManagerActive')}</option>
            <option value="SUSPENDED">{translate(locale, 'adminadminUsersManagerSuspended')}</option>
            <option value="DELETED">{translate(locale, 'adminadminUsersManagerDeleted')}</option>
          </select>
          <button className="rounded-xl bg-navy px-6 py-3 font-black text-white">
            {translate(locale, 'adminadminUsersManagerSearch')}
          </button>
        </form>
        {query.isLoading ? (
          <div className="grid gap-3 p-5">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        ) : query.isError ? (
          <ErrorBox fa={fa} error={query.error} retry={() => query.refetch()} />
        ) : data?.data.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-[#f8f9fd] text-muted">
                  <tr>
                    <th className="p-4 text-start">{translate(locale, 'adminadminUsersManagerUser')}</th>
                    <th className="p-4 text-start">{translate(locale, 'adminadminUsersManagerContact')}</th>
                    <th className="p-4 text-start">{translate(locale, 'adminadminUsersManagerRoles')}</th>
                    <th className="p-4 text-start">{translate(locale, 'commercepricingManagerStatus')}</th>
                    <th className="p-4 text-start">{translate(locale, 'adminadminUsersManagerJoined')}</th>
                    <th className="p-4 text-start">{translate(locale, 'adminadminUsersManagerActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {data.data.map((user) => (
                    <tr key={user.id} className="hover:bg-[#fafbff]">
                      <td className="p-4">
                        <span className="flex items-center gap-3">
                          <span className="brand-gradient grid size-10 place-items-center rounded-full font-black text-white">
                            {(user.name ?? 'U').slice(0, 1)}
                          </span>
                          <strong>{user.name || translate(locale, 'adminadminUsersManagerUnnamed')}</strong>
                        </span>
                      </td>
                      <td className="p-4">
                        <span dir="ltr" className="block">
                          {user.phone}
                        </span>
                        {user.email && <small className="text-muted">{user.email}</small>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map(({ role }) => (
                            <span
                              key={role}
                              className="rounded-full bg-lavender px-2.5 py-1 text-xs font-bold text-purple"
                            >
                              {localized({ fa: roleFa[role], en: roleLabel(role) }, locale)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <Status value={user.status} fa={fa} />
                      </td>
                      <td className="p-4 text-muted">{date(user.createdAt, fa)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelected(user.id)}
                          className="inline-flex items-center gap-2 rounded-xl border hairline px-3 py-2 font-bold text-blue"
                        >
                          <Eye size={16} />
                          {translate(locale, 'adminadminUsersManagerDetails')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.totalPages} total={data.total} setPage={setPage} fa={fa} />
          </>
        ) : (
          <div className="p-12 text-center text-muted">{translate(locale, 'adminadminUsersManagerNoUsersFound')}</div>
        )}
      </div>
      {selected && (
        <UserDetails
          id={selected}
          close={() => setSelected(undefined)}
          fa={fa}
          invalidate={async () => {
            await qc.invalidateQueries({ queryKey: ['admin-users'] });
          }}
        />
      )}
    </section>
  );
}

function Pagination({
  page,
  pages,
  total,
  setPage,
  fa,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (n: number) => void;
  fa: boolean;
}) {
  const { locale } = useTranslations();
  const visible = Array.from(
    { length: Math.min(5, pages) },
    (_, i) => Math.max(1, Math.min(page - 2, pages - 4)) + i,
  ).filter((n) => n <= pages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline p-4">
      <p className="text-sm text-muted">
        {localized({ fa: `${new Intl.NumberFormat('fa-IR').format(total)} کاربر`, en: `${total} users` }, fa)}
      </p>
      <div className="flex items-center gap-1">
        <button
          aria-label={translate(fa, 'adminadminUsersManagerPreviousPage')}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="grid size-9 place-items-center rounded-lg border hairline disabled:opacity-30"
        >
          {localized({ fa: <ChevronRight size={17} />, en: <ChevronLeft size={17} /> }, fa)}
        </button>
        {visible.map((n) => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`grid size-9 place-items-center rounded-lg ${n === page ? 'bg-navy text-white' : 'border hairline bg-white'}`}
          >
            {localized({ fa: new Intl.NumberFormat('fa-IR').format(n), en: String(n) }, locale)}
          </button>
        ))}
        <button
          aria-label={translate(fa, 'adminadminUsersManagerNextPage')}
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="grid size-9 place-items-center rounded-lg border hairline disabled:opacity-30"
        >
          {localized({ fa: <ChevronLeft size={17} />, en: <ChevronRight size={17} /> }, fa)}
        </button>
      </div>
    </div>
  );
}

function UserDetails({
  id,
  close,
  fa,
  invalidate,
}: {
  id: string;
  close: () => void;
  fa: boolean;
  invalidate: () => Promise<void>;
}) {
  const { locale } = useTranslations();
  const qc = useQueryClient(),
    query = useQuery({ queryKey: ['admin-user-detail', id], queryFn: () => api<Detail>(`/admin/users/${id}`) }),
    [roles, setRoles] = useState<Role[]>([]),
    [status, setStatus] = useState('ACTIVE');
  useEffect(() => {
    if (query.data) {
      setRoles(query.data.roles.map((r) => r.role));
      setStatus(query.data.status);
    }
  }, [query.data]);
  const saveRoles = useMutation({
    mutationFn: () => api(`/admin/users/${id}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) }),
    onSuccess: async () => {
      await query.refetch();
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['panel-me'] });
    },
  });
  const saveStatus = useMutation({
    mutationFn: () => api(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => {
      await query.refetch();
      await invalidate();
    },
  });
  const user = query.data;
  return (
    <div className="fixed inset-0 z-[80] bg-navy/35 p-3 backdrop-blur-sm" onClick={close}>
      <aside
        className={`h-full w-full max-w-3xl overflow-y-auto bg-[#f8f9fd] p-5 shadow-2xl md:p-7 ${translate(fa, 'adminadminUsersManagerMlAutoRoundedR28px')}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="grid size-10 place-items-center rounded-full border hairline bg-white"
          aria-label={translate(fa, 'adminadminUsersManagerClose')}
        >
          <X />
        </button>
        {query.isLoading ? (
          <div className="skeleton mt-6 h-64 rounded-3xl" />
        ) : query.isError ? (
          <ErrorBox fa={fa} error={query.error} retry={() => query.refetch()} />
        ) : (
          user && (
            <>
              <div className="mt-5 flex items-center gap-4">
                <span className="brand-gradient grid size-16 place-items-center rounded-full text-2xl font-black text-white">
                  {(user.name ?? 'U').slice(0, 1)}
                </span>
                <div>
                  <h2 className="text-2xl font-black">{user.name || translate(fa, 'adminadminUsersManagerUnnamed')}</h2>
                  <p dir="ltr" className={`${translate(fa, 'adminadminUsersManagerTextLeft')} text-sm text-muted`}>
                    {user.phone}
                    {user.email ? ` · ${user.email}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {Object.entries(user._count).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border hairline bg-white p-4">
                    <strong className="text-2xl">{value}</strong>
                    <p className="mt-1 text-xs text-muted">{countLabel(key, fa)}</p>
                  </div>
                ))}
              </div>
              <section className="panel-card mt-5 p-5">
                <h3 className="flex items-center gap-2 font-black">
                  <ShieldCheck size={18} className="text-purple" />
                  {translate(fa, 'adminadminUsersManagerRolesAndStatus')}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {allRoles.map((role) => (
                    <label
                      key={role}
                      className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${roles.includes(role) ? 'border-purple bg-lavender text-purple' : 'hairline bg-white text-muted'}`}
                    >
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={(e) =>
                          setRoles((current) =>
                            e.target.checked ? [...current, role] : current.filter((r) => r !== role),
                          )
                        }
                      />
                      {localized({ fa: roleFa[role], en: roleLabel(role) }, locale)}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    disabled={!roles.length || saveRoles.isPending}
                    onClick={() => saveRoles.mutate()}
                    className="brand-gradient rounded-xl px-5 py-3 font-black text-white disabled:opacity-40"
                  >
                    {translate(fa, 'adminadminUsersManagerSaveRoles')}
                  </button>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-xl border hairline bg-white px-4"
                  >
                    <option value="ACTIVE">{translate(fa, 'admincountryManagerActive')}</option>
                    <option value="SUSPENDED">{translate(fa, 'adminadminUsersManagerSuspended')}</option>
                    <option value="DELETED">{translate(fa, 'adminadminUsersManagerDeleted')}</option>
                  </select>
                  <button
                    disabled={saveStatus.isPending}
                    onClick={() => saveStatus.mutate()}
                    className="rounded-xl border hairline bg-white px-5 py-3 font-black"
                  >
                    {translate(fa, 'adminadminUsersManagerSaveStatus')}
                  </button>
                </div>
                {(saveRoles.error || saveStatus.error) && (
                  <p className="mt-3 text-sm text-red-700">{errorMessage(saveRoles.error || saveStatus.error, fa)}</p>
                )}
              </section>
              {user.teacher && (
                <section className="panel-card mt-5 p-5">
                  <h3 className="font-black">{translate(fa, 'teacherteacherProfileHubTeacherProfile')}</h3>
                  <p className="mt-3">
                    {localized({ fa: user.teacher.nameFa, en: user.teacher.nameEn }, fa)} ·{' '}
                    <Status value={user.teacher.status} fa={fa} />
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {translate(fa, 'adminadminUsersManagerRating')} {user.teacher.rating} · {user.teacher.reviewsCount}{' '}
                    {translate(fa, 'adminadminUsersManagerReviews')}
                  </p>
                </section>
              )}
              <DetailList
                title={translate(fa, 'adminadminUsersManagerRecentTests')}
                rows={user.attempts}
                fa={fa}
                kind="attempt"
              />
              <DetailList
                title={translate(fa, 'adminadminUsersManagerRecentBookings')}
                rows={user.bookings}
                fa={fa}
                kind="booking"
              />
              <DetailList
                title={translate(fa, 'adminadminUsersManagerRecentPayments')}
                rows={user.payments}
                fa={fa}
                kind="payment"
              />
              <DetailList
                title={translate(fa, 'adminadminUsersManagerRecentTickets')}
                rows={user.tickets}
                fa={fa}
                kind="ticket"
              />
              <DetailList
                title={translate(fa, 'adminadminUsersManagerLearningPlans')}
                rows={user.learningPlans}
                fa={fa}
                kind="plan"
              />
            </>
          )
        )}
      </aside>
    </div>
  );
}

function DetailList({ title, rows, fa, kind }: { title: string; rows: Activity[]; fa: boolean; kind: string }) {
  const { locale } = useTranslations();
  if (!rows.length) return null;
  return (
    <section className="panel-card mt-5 p-5">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 divide-y hairline">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <strong>{activityTitle(row, kind, fa)}</strong>
              <p className="mt-1 text-xs text-muted">
                {row.startsAt
                  ? date(row.startsAt, fa)
                  : row.createdAt
                    ? date(row.createdAt, fa)
                    : row.updatedAt
                      ? date(row.updatedAt, fa)
                      : ''}
              </p>
            </div>
            <div className="text-end">
              {row.amount != null && <p>{money(row.amount, fa)}</p>}
              {row.overallBand != null && (
                <p>
                  {translate(locale, 'adminadminUsersManagerBand')} {row.overallBand}
                </p>
              )}
              {row.status && <Status value={row.status} fa={fa} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function activityTitle(row: Activity, kind: string, fa: boolean) {
  if (kind === 'attempt') return localized({ fa: row.test?.titleFa ?? 'آزمون', en: row.test?.titleEn ?? 'Test' }, fa);
  if (kind === 'booking')
    return `${translate(fa, 'adminadminUsersManagerClassWith')} ${localized({ fa: row.teacher?.nameFa ?? '—', en: row.teacher?.nameEn ?? '—' }, fa)}`;
  return row.title ?? row.subject ?? row.purpose ?? translate(fa, 'adminadminUsersManagerActivity');
}
function Status({ value, fa }: { value: string; fa: boolean }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
      {localized({ fa: statusFa[value] ?? value, en: value.replaceAll('_', ' ').toLowerCase() }, fa)}
    </span>
  );
}
function roleLabel(role: Role) {
  return role[0] + role.slice(1).toLowerCase();
}
function date(value: string, fa: boolean) {
  return new Intl.DateTimeFormat(translate(fa, 'commercepricingManagerEnUS2'), { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
function money(value: number, fa: boolean) {
  return `${new Intl.NumberFormat(translate(fa, 'commercepricingManagerEnUS2')).format(value)} ${translate(fa, 'teacherteacherFinanceIrr')}`;
}
function countLabel(key: string, fa: boolean) {
  const labels: Record<string, [string, string]> = {
    bookings: ['رزرو', 'Bookings'],
    attempts: ['آزمون', 'Tests'],
    payments: ['پرداخت', 'Payments'],
    tickets: ['تیکت', 'Tickets'],
    learningPlans: ['برنامه', 'Plans'],
    enrollments: ['بسته آموزشی', 'Enrollments'],
  };
  return labels[key]?.[localized({ fa: 0, en: 1 }, fa)] ?? key;
}
function ErrorBox({ fa, error, retry }: { fa: boolean; error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="m-5 rounded-2xl bg-red-50 p-4 text-red-700">
      {errorMessage(error, fa)}{' '}
      <button onClick={retry} className="font-black underline">
        {translate(fa, 'testsaudioRecorderTryAgain')}
      </button>
    </div>
  );
}
function errorMessage(error: unknown, fa: boolean) {
  return error instanceof ApiError ? error.message : translate(fa, 'adminadminUsersManagerCouldNotLoadOrSaveData');
}
