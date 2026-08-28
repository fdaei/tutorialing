export const PERMISSIONS_KEY = 'permissions';

export const PermissionKeys = {
  Users: { Read: 'users.read' },
  Teachers: { Verify: 'teachers.verify' },
  TeacherPrices: { Manage: 'teacher-prices.manage' },
  Reviews: { Manage: 'reviews.manage' },
  Assessment: { Manage: 'tests.manage' },
  Languages: { Manage: 'languages.manage' },
  Bookings: { Read: 'bookings.read' },
  Tickets: { Read: 'tickets.read', Manage: 'tickets.manage' },
  Notifications: { Read: 'notifications.read' },
  Roles: { Manage: 'roles.manage' },
  Reports: { Read: 'reports.read' },
  Audit: { Read: 'audit.read' },
  Payments: { Read: 'payments.read', Refund: 'payments.refund', AdjustWallet: 'payments.adjust-wallet' },
  Payouts: { Manage: 'payouts.manage' },
  Settings: { Manage: 'settings.manage' },
  Content: { Manage: 'cms.manage' },
} as const;

export type PermissionKey = {
  [Group in keyof typeof PermissionKeys]: (typeof PermissionKeys)[Group][keyof (typeof PermissionKeys)[Group]];
}[keyof typeof PermissionKeys];
