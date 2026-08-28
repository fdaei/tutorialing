'use client';

import { Localized, Props } from '../shared/action-controls';
import { TicketForm } from '../shared/ticket-form';
import { AdminBookingActions } from './admin-booking-actions';
import { AdminFinanceActions } from './admin-finance-actions';
import { AdminRoleActions } from './admin-role-actions';
import { AdminSettingsActions } from './admin-settings-actions';
import { AdminTeacherActions } from './admin-teacher-actions';
import { AdminUserActions } from './admin-user-actions';
export function AdminActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  if (section === 'users') return <AdminUserActions endpoint={endpoint} fa={fa} />;
  if (section === 'teachers') return <AdminTeacherActions endpoint={endpoint} fa={fa} />;
  if (section === 'settings') return <AdminSettingsActions endpoint={endpoint} fa={fa} />;
  if (section === 'bookings') return <AdminBookingActions endpoint={endpoint} fa={fa} />;
  if (section === 'payments') return <AdminFinanceActions endpoint={endpoint} fa={fa} />;
  if (section === 'roles') return <AdminRoleActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}
