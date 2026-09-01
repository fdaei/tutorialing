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

function RoleActionForm({
  endpoint,
  fa,
  mode,
}: { endpoint: string; mode: 'assign' | 'revoke' | 'permission' } & Localized) {
  const action = useAction(endpoint);
  return (
    <>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const userId = value(data, 'userId');
          const role = value(data, 'role');
          const request =
            mode === 'assign'
              ? api('/admin/roles', { method: 'POST', body: JSON.stringify({ userId, role }) })
              : mode === 'revoke'
                ? api('/admin/roles/revoke', { method: 'POST', body: JSON.stringify({ userId, role }) })
                : api('/admin/permissions/grant', {
                    method: 'POST',
                    body: JSON.stringify({ userId, role, permission: value(data, 'permission') }),
                  });
          action.mutate(() => request);
        }}
      >
        <AdminUserSelect fa={fa} />
        <Select name="role" label={translate(fa, 'legacyRole')}>
          <RoleOptions />
        </Select>
        {mode === 'permission' && (
          <Field
            name="permission"
            label={translate(fa, 'legacyPermissionKey')}
            defaultValue="reports.read"
            required
            dir="ltr"
          />
        )}
        <Submit fa={fa} busy={action.isPending}>
          {mode === 'assign'
            ? translate(fa, 'legacyAssignRole')
            : mode === 'revoke'
              ? translate(fa, 'legacyRevokeRole')
              : translate(fa, 'legacyGrantPermission')}
        </Submit>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </>
  );
}

export function AdminRoleActions({ endpoint, fa }: { endpoint: string } & Localized) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Shell title={translate(fa, 'legacyassignRole2')}>
        <RoleActionForm endpoint={endpoint} fa={fa} mode="assign" />
      </Shell>
      <Shell title={translate(fa, 'legacyrevokeRole2')}>
        <RoleActionForm endpoint={endpoint} fa={fa} mode="revoke" />
      </Shell>
      <Shell title={translate(fa, 'legacyGrantPermissionToUserRole')}>
        <RoleActionForm endpoint={endpoint} fa={fa} mode="permission" />
      </Shell>
    </div>
  );
}
