'use client';

import { isDefaultLocale, localized, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, ApiError, Paginated } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'SUPPORT' | 'ADMIN';
type User = { id: string; name?: string; phone: string; email?: string; roles: { role: Role }[] };

const allRoles: Role[] = ['STUDENT', 'INSTRUCTOR', 'SUPPORT', 'ADMIN'];
const roleFa: Record<Role, string> = { STUDENT: 'زبان‌آموز', INSTRUCTOR: 'مدرس', ADMIN: 'مدیر', SUPPORT: 'پشتیبانی' };
const roleLabel = (role: Role) => role[0] + role.slice(1).toLowerCase();

export function AdminRoleSearch() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    qc = useQueryClient(),
    [draft, setDraft] = useState(''),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState<string>();
  const query = useQuery({
    queryKey: ['admin-role-search', search],
    queryFn: () => api<Paginated<User>>(`/admin/users?page=1&search=${encodeURIComponent(search)}`),
    enabled: search.length > 0,
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(draft.trim());
  }
  return (
    <section className="panel-card overflow-hidden">
      <form onSubmit={submit} className="flex flex-col gap-3 border-b hairline p-4 md:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4">
          <Search size={18} className="text-muted" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={translate(locale, 'adminroleSearchSearchUsersToManageRoles')}
            className="w-full bg-transparent py-3 outline-none"
            placeholder={translate(locale, 'adminroleSearchSearchUsersToManageRoles')}
          />
        </label>
        <button className="rounded-xl bg-navy px-6 py-3 font-black text-white">
          {translate(locale, 'adminroleSearchSearch')}
        </button>
      </form>
      {search &&
        (query.isLoading ? (
          <div className="grid gap-3 p-5">
            <div className="skeleton h-16 rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="m-5 rounded-2xl bg-red-50 p-4 text-red-700">
            {query.error instanceof ApiError ? query.error.message : translate(locale, 'adminroleSearchCouldNotLoadUsers')}
          </div>
        ) : query.data?.data.length ? (
          <ul className="divide-y hairline">
            {query.data.data.map((user) => (
              <li key={user.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{user.name || translate(locale, 'adminroleSearchUnnamed')}</strong>
                    <p dir="ltr" className="text-sm text-muted">
                      {user.phone}
                      {user.email ? ` · ${user.email}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {user.roles.map(({ role }) => (
                        <span key={role} className="rounded-full bg-lavender px-2.5 py-1 text-xs font-bold text-purple">
                          {localized({ fa: roleFa[role], en: roleLabel(role) }, locale)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(editing === user.id ? undefined : user.id)}
                    className="rounded-xl border hairline px-3 py-2 font-bold text-blue"
                  >
                    {translate(locale, 'adminroleSearchManageRoles')}
                  </button>
                </div>
                {editing === user.id && (
                  <RoleEditor
                    user={user}
                    fa={fa}
                    onSaved={async () => {
                      await qc.invalidateQueries({ queryKey: ['admin-role-search'] });
                      setEditing(undefined);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-muted">{translate(locale, 'adminroleSearchNoUsersFound')}</div>
        ))}
    </section>
  );
}

function RoleEditor({ user, fa, onSaved }: { user: User; fa: boolean; onSaved: () => Promise<void> }) {
  const { locale } = useTranslations(),
    [roles, setRoles] = useState<Role[]>(user.roles.map((r) => r.role));
  const save = useMutation({
    mutationFn: () => api(`/admin/users/${user.id}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) }),
    onSuccess: onSaved,
  });
  return (
    <div className="mt-3 rounded-2xl border hairline bg-[#fafbff] p-4">
      <div className="flex flex-wrap gap-2">
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
                setRoles((current) => (e.target.checked ? [...current, role] : current.filter((r) => r !== role)))
              }
            />
            {localized({ fa: roleFa[role], en: roleLabel(role) }, locale)}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!roles.length || save.isPending}
          onClick={() => save.mutate()}
          className="brand-gradient rounded-xl px-5 py-2.5 font-black text-white disabled:opacity-40"
        >
          {translate(fa, 'adminroleSearchSaveRoles')}
        </button>
        {save.error && (
          <p className="text-sm text-red-700">
            {save.error instanceof ApiError ? save.error.message : translate(fa, 'adminroleSearchCouldNotSaveRoles')}
          </p>
        )}
      </div>
    </div>
  );
}
