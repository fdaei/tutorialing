'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import {
  AdminUserSelect,
  Field,
  Localized,
  Select,
  Shell,
  Status,
  Submit,
  useAction,
  value,
} from '../shared/action-controls';
import { RoleOptions } from './role-options';
export function AdminUserActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Shell title={translate(fa, 'legacyCreateUser')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                  phone: value(form, 'phone'),
                  name: value(form, 'name'),
                  email: value(form, 'email') || undefined,
                  locale: value(form, 'locale'),
                  roles: [value(form, 'role')],
                }),
              }),
            );
          }}
        >
          <Field name="phone" label={translate(fa, 'legacyPhoneNumber')} pattern="09[0-9]{9}" required dir="ltr" />
          <Field name="name" label={translate(fa, 'legacyname2')} required />
          <Field name="email" label={translate(fa, 'legacyemail2')} type="email" dir="ltr" />
          <Select name="locale" label={translate(fa, 'legacyLanguage')}>
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </Select>
          <Select name="role" label={translate(fa, 'legacyInitialRole')}>
            <RoleOptions />
          </Select>
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacycreateUser2')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyChangeUserStatus')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/admin/users/${value(form, 'userId')}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: value(form, 'status') }),
              }),
            );
          }}
        >
          <AdminUserSelect fa={fa} />
          <Select name="status" label={translate(fa, 'legacyStatus')}>
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>DELETED</option>
          </Select>
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyUpdateStatus')}
          </Submit>
        </form>
      </Shell>
    </div>
  );
}
