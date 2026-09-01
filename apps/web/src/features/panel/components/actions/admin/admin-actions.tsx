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
  if (['teachers', 'teacher-applications'].includes(section))
    return <AdminTeacherActions endpoint={endpoint} fa={fa} />;
  if (section === 'settings' || section === 'cms')
    return <AdminSettingsActions endpoint={endpoint} section={section} fa={fa} />;
  if (section === 'bookings' || section === 'availability-blocks')
    return <AdminBookingActions endpoint={endpoint} fa={fa} />;
  if (['payments', 'discounts', 'refunds', 'payouts'].includes(section))
    return <AdminFinanceActions endpoint={endpoint} section={section} fa={fa} />;
  if (section === 'roles') return <AdminRoleActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}
