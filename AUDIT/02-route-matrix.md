| Method | Path | Auth | Roles | Permissions | RL | File |
|---|---|---|---|---|---|---|
| `Get` | `/admin/audit-logs` | auth | ADMIN,STAFF | audit.read | — | admin.controller.ts |
| `Get` | `/admin/bookings` | auth | ADMIN,STAFF | bookings.read | — | admin.controller.ts |
| `Get` | `/admin/cms` | auth | ADMIN,STAFF | cms.manage | — | admin.controller.ts |
| `Put` | `/admin/cms/:slug` | auth | ADMIN,STAFF | cms.manage | yes | admin.controller.ts |
| `Get` | `/admin/dashboard` | auth | ADMIN,STAFF | — | — | admin.controller.ts |
| `Get` | `/admin/languages` | auth | ADMIN,STAFF | languages.manage | — | languages.controller.ts |
| `Post` | `/admin/languages` | auth | ADMIN,STAFF | languages.manage | — | languages.controller.ts |
| `Delete` | `/admin/languages/:id` | auth | ADMIN,STAFF | languages.manage | — | languages.controller.ts |
| `Patch` | `/admin/languages/:id` | auth | ADMIN,STAFF | languages.manage | — | languages.controller.ts |
| `Get` | `/admin/notification-deliveries` | auth | ADMIN,STAFF | notifications.read | — | admin.controller.ts |
| `Get` | `/admin/payments` | auth | ADMIN,STAFF | payments.read | — | admin.controller.ts |
| `Get` | `/admin/permissions` | auth | ADMIN,STAFF | roles.manage | — | admin.controller.ts |
| `Post` | `/admin/permissions/grant` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Get` | `/admin/reports` | auth | ADMIN,STAFF | reports.read | — | admin.controller.ts |
| `Get` | `/admin/reviews` | auth | ADMIN,STAFF | reviews.manage | — | reviews.controller.ts |
| `Post` | `/admin/reviews/:id/moderate` | auth | ADMIN,STAFF | reviews.manage | — | reviews.controller.ts |
| `Get` | `/admin/roles` | auth | ADMIN,STAFF | roles.manage | — | admin.controller.ts |
| `Post` | `/admin/roles` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Post` | `/admin/roles/revoke` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Get` | `/admin/settings` | auth | ADMIN,STAFF | settings.manage | — | admin.controller.ts |
| `Put` | `/admin/settings/:key` | auth | ADMIN,STAFF | settings.manage | yes | admin.controller.ts |
| `Get` | `/admin/teacher-applications` | auth | ADMIN,STAFF | teachers.verify | — | admin.controller.ts |
| `Post` | `/admin/teacher-applications/:id/transition` | auth | ADMIN,STAFF | teachers.verify | yes | admin.controller.ts |
| `Get` | `/admin/teacher-prices` | auth | ADMIN,STAFF,FINANCE | teacher-prices.manage | — | pricing.controller.ts |
| `Post` | `/admin/teacher-prices/:id/review` | auth | ADMIN,STAFF,FINANCE | teacher-prices.manage | — | pricing.controller.ts |
| `Get` | `/admin/tests` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Delete` | `/admin/tests/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Patch` | `/admin/tests/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests/:id/sections` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Delete` | `/admin/tests/passages/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Patch` | `/admin/tests/passages/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Delete` | `/admin/tests/questions/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Patch` | `/admin/tests/questions/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Delete` | `/admin/tests/sections/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Patch` | `/admin/tests/sections/:id` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests/sections/:id/passages` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests/sections/:id/questions` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests/sections/:id/questions/import` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Patch` | `/admin/tests/sections/:id/questions/reorder` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Post` | `/admin/tests/simple` | auth | ADMIN,STAFF | tests.manage | — | tests.controller.ts |
| `Get` | `/admin/tickets` | auth | ADMIN,STAFF | tickets.read | — | admin.controller.ts |
| `Get` | `/admin/users` | auth | ADMIN,STAFF | users.read | — | admin.controller.ts |
| `Post` | `/admin/users` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Get` | `/admin/users/:id` | auth | ADMIN,STAFF | users.read | — | admin.controller.ts |
| `Patch` | `/admin/users/:id/roles` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Patch` | `/admin/users/:id/status` | auth | ADMIN,STAFF | roles.manage | yes | admin.controller.ts |
| `Post` | `/auth/logout` | PUBLIC | — | — | — | auth.controller.ts |
| `Post` | `/auth/otp/request` | PUBLIC | — | — | yes | auth.controller.ts |
| `Post` | `/auth/otp/resend` | PUBLIC | — | — | yes | auth.controller.ts |
| `Post` | `/auth/otp/verify` | PUBLIC | — | — | yes | auth.controller.ts |
| `Post` | `/auth/refresh` | PUBLIC | — | — | yes | auth.controller.ts |
| `Get` | `/availability/:teacherId/slots` | PUBLIC | — | — | — | availability.controller.ts |
| `Post` | `/availability/admin/blocks` | auth | ADMIN,STAFF | — | — | availability.controller.ts |
| `Delete` | `/availability/admin/blocks/:id` | auth | ADMIN,STAFF | — | — | availability.controller.ts |
| `Get` | `/availability/me` | auth | TEACHER | — | — | availability.controller.ts |
| `Post` | `/availability/me/blocks` | auth | TEACHER | — | — | availability.controller.ts |
| `Delete` | `/availability/me/blocks/:id` | auth | TEACHER | — | — | availability.controller.ts |
| `Post` | `/availability/me/overrides` | auth | TEACHER | — | — | availability.controller.ts |
| `Delete` | `/availability/me/overrides/:id` | auth | TEACHER | — | — | availability.controller.ts |
| `Put` | `/availability/me/rules` | auth | TEACHER | — | — | availability.controller.ts |
| `Post` | `/bookings` | auth | — | — | — | bookings.controller.ts |
| `Put` | `/bookings/:id/attendance` | auth | TEACHER,ADMIN,STAFF | — | — | bookings.controller.ts |
| `Post` | `/bookings/:id/cancel` | auth | — | — | — | bookings.controller.ts |
| `Post` | `/bookings/:id/complete` | auth | TEACHER,ADMIN,STAFF | — | — | bookings.controller.ts |
| `Post` | `/bookings/:id/reschedule` | auth | — | — | — | bookings.controller.ts |
| `Post` | `/bookings/:id/reschedule/accept` | auth | — | — | — | bookings.controller.ts |
| `Post` | `/bookings/:id/reschedule/decline` | auth | — | — | — | bookings.controller.ts |
| `Get` | `/bookings/me` | auth | — | — | — | bookings.controller.ts |
| `Get` | `/bookings/students` | auth | TEACHER | — | — | bookings.controller.ts |
| `Post` | `/examiner/tests/answers/:id/claim` | auth | EXAMINER,ADMIN | — | — | tests.controller.ts |
| `Post` | `/examiner/tests/answers/review` | auth | EXAMINER,ADMIN | — | — | tests.controller.ts |
| `Get` | `/examiner/tests/queue` | auth | EXAMINER,ADMIN | — | — | tests.controller.ts |
| `Post` | `/files/:id/complete` | auth | — | — | yes | files.controller.ts |
| `Get` | `/files/:id/download` | auth | — | — | — | files.controller.ts |
| `Post` | `/files/uploads` | auth | — | — | yes | files.controller.ts |
| `Post` | `/files/uploads/:id/content` | auth | — | — | yes | files.controller.ts |
| `Get` | `/languages` | PUBLIC | — | — | — | languages.controller.ts |
| `Post` | `/learning/assignments/:id/submit` | auth | — | — | — | learning.controller.ts |
| `Get` | `/learning/plans` | auth | — | — | — | learning.controller.ts |
| `Post` | `/learning/plans` | auth | TEACHER | — | — | learning.controller.ts |
| `Post` | `/learning/plans/:id/assignments` | auth | TEACHER | — | — | learning.controller.ts |
| `Post` | `/learning/trial-evaluations` | auth | TEACHER | — | — | learning.controller.ts |
| `Post` | `/matching` | auth | — | — | — | matching.controller.ts |
| `Get` | `/matching/history` | auth | — | — | — | matching.controller.ts |
| `Get` | `/notifications` | auth | — | — | — | notifications.controller.ts |
| `Put` | `/notifications/:id/read` | auth | — | — | — | notifications.controller.ts |
| `Post` | `/packages` | auth | TEACHER | — | — | packages.controller.ts |
| `Post` | `/packages/:id/approval` | auth | ADMIN,STAFF | — | — | packages.controller.ts |
| `Get` | `/packages/enrollments/me` | auth | — | — | — | packages.controller.ts |
| `Get` | `/packages/me` | auth | TEACHER | — | — | packages.controller.ts |
| `Get` | `/packages/teacher/:teacherId` | PUBLIC | — | — | — | packages.controller.ts |
| `Post` | `/payments` | auth | — | — | yes | payments.controller.ts |
| `Post` | `/payments/:id/gateway` | auth | — | — | yes | payments.controller.ts |
| `Post` | `/payments/:id/refunds` | auth | ADMIN,FINANCE | payments.refund | yes | payments.controller.ts |
| `Get` | `/payments/callback` | PUBLIC | — | — | yes | payments.controller.ts |
| `Get` | `/payments/invoices` | auth | — | — | — | payments.controller.ts |
| `Get` | `/payments/wallet` | auth | — | — | — | payments.controller.ts |
| `Get` | `/payments/wallet/transactions` | auth | — | — | — | payments.controller.ts |
| `Post` | `/payouts/:id/approve` | auth | ADMIN,FINANCE | payouts.manage | — | payouts.controller.ts |
| `Post` | `/payouts/discounts` | auth | ADMIN,FINANCE | payouts.manage | — | payouts.controller.ts |
| `Post` | `/payouts/generate` | auth | ADMIN,FINANCE | payouts.manage | — | payouts.controller.ts |
| `Get` | `/payouts/withdrawals` | auth | ADMIN,FINANCE | payouts.manage | — | payouts.controller.ts |
| `Post` | `/payouts/withdrawals/:id/transfer` | auth | ADMIN,FINANCE | payouts.manage | — | payouts.controller.ts |
| `Post` | `/reviews` | auth | — | — | — | reviews.controller.ts |
| `Post` | `/reviews/:id/reply` | auth | TEACHER | — | — | reviews.controller.ts |
| `Get` | `/search/:entity` | auth | ADMIN,STAFF,FINANCE,SUPPORT,EXAMINER | — | — | search.controller.ts |
| `Get` | `/support/pages/:slug` | PUBLIC | — | — | — | support.controller.ts |
| `Get` | `/support/public-settings` | PUBLIC | — | — | — | support.controller.ts |
| `Get` | `/support/tickets` | auth | — | — | — | support.controller.ts |
| `Post` | `/support/tickets` | auth | — | — | — | support.controller.ts |
| `Get` | `/support/tickets/:id` | auth | — | — | — | support.controller.ts |
| `Patch` | `/support/tickets/:id/assignment` | auth | ADMIN,STAFF,SUPPORT | tickets.manage | — | support.controller.ts |
| `Post` | `/support/tickets/:id/replies` | auth | — | — | — | support.controller.ts |
| `Patch` | `/support/tickets/:id/status` | auth | ADMIN,STAFF,SUPPORT | tickets.manage | — | support.controller.ts |
| `Get` | `/teacher/application` | auth | TEACHER,STUDENT | — | — | teachers.controller.ts |
| `Patch` | `/teacher/application` | auth | — | — | — | teachers.controller.ts |
| `Post` | `/teacher/application` | auth | — | — | — | teachers.controller.ts |
| `Post` | `/teacher/application/submit` | auth | — | — | — | teachers.controller.ts |
| `Get` | `/teacher/finance` | auth | TEACHER | — | — | teacher-finance.controller.ts |
| `Post` | `/teacher/finance/withdrawals` | auth | TEACHER | — | yes | teacher-finance.controller.ts |
| `Get` | `/teacher/pricing` | auth | TEACHER | — | — | pricing.controller.ts |
| `Post` | `/teacher/pricing/accept-counter` | auth | TEACHER | — | — | pricing.controller.ts |
| `Post` | `/teacher/pricing/propose` | auth | TEACHER | — | — | pricing.controller.ts |
| `Get` | `/teachers` | PUBLIC | — | — | — | teachers.controller.ts |
| `Get` | `/teachers/:slug` | PUBLIC | — | — | — | teachers.controller.ts |
| `Get` | `/tests` | PUBLIC | — | — | — | tests.controller.ts |
| `Post` | `/tests/attempts` | auth | — | — | yes | tests.controller.ts |
| `Get` | `/tests/attempts/:id` | auth | — | — | — | tests.controller.ts |
| `Patch` | `/tests/attempts/:id/answers` | auth | — | — | yes | tests.controller.ts |
| `Post` | `/tests/attempts/:id/sections/:sectionId/submit` | auth | — | — | yes | tests.controller.ts |
| `Post` | `/tests/attempts/:id/submit` | auth | — | — | yes | tests.controller.ts |
| `Get` | `/tests/attempts/history` | auth | — | — | — | tests.controller.ts |
| `Get` | `/users/me` | auth | — | — | — | users.controller.ts |
| `Put` | `/users/me` | auth | — | — | — | users.controller.ts |
| `Get` | `/users/me/favorites` | auth | — | — | — | users.controller.ts |
| `Delete` | `/users/me/favorites/:teacherId` | auth | — | — | — | users.controller.ts |
| `Put` | `/users/me/favorites/:teacherId` | auth | — | — | — | users.controller.ts |
| `Put` | `/users/me/locale` | auth | — | — | — | users.controller.ts |

TOTAL 139 Counter({'auth': 125, 'PUBLIC': 14})
UNSCOPED 42
   Post /bookings | bookings.controller.ts
   Get /bookings/me | bookings.controller.ts
   Post /bookings/:id/cancel | bookings.controller.ts
   Post /bookings/:id/reschedule | bookings.controller.ts
   Post /bookings/:id/reschedule/accept | bookings.controller.ts
   Post /bookings/:id/reschedule/decline | bookings.controller.ts
   Get /packages/enrollments/me | packages.controller.ts
   Post /payments | payments.controller.ts
   Post /payments/:id/gateway | payments.controller.ts
   Get /payments/wallet | payments.controller.ts
   Get /payments/wallet/transactions | payments.controller.ts
   Get /payments/invoices | payments.controller.ts
   Post /files/uploads | files.controller.ts
   Post /files/uploads/:id/content | files.controller.ts
   Post /files/:id/complete | files.controller.ts
   Get /files/:id/download | files.controller.ts
   Get /learning/plans | learning.controller.ts
   Post /learning/assignments/:id/submit | learning.controller.ts
   Post /matching | matching.controller.ts
   Get /matching/history | matching.controller.ts
   Get /notifications | notifications.controller.ts
   Put /notifications/:id/read | notifications.controller.ts
   Post /support/tickets | support.controller.ts
   Get /support/tickets | support.controller.ts
   Get /support/tickets/:id | support.controller.ts
   Post /support/tickets/:id/replies | support.controller.ts
   Post /reviews | reviews.controller.ts
   Post /teacher/application | teachers.controller.ts
   Patch /teacher/application | teachers.controller.ts
   Post /teacher/application/submit | teachers.controller.ts
   Post /tests/attempts | tests.controller.ts
   Get /tests/attempts/history | tests.controller.ts
   Get /tests/attempts/:id | tests.controller.ts
   Patch /tests/attempts/:id/answers | tests.controller.ts
   Post /tests/attempts/:id/sections/:sectionId/submit | tests.controller.ts
   Post /tests/attempts/:id/submit | tests.controller.ts
   Get /users/me | users.controller.ts
   Put /users/me | users.controller.ts
   Put /users/me/locale | users.controller.ts
   Get /users/me/favorites | users.controller.ts
   Put /users/me/favorites/:teacherId | users.controller.ts
   Delete /users/me/favorites/:teacherId | users.controller.ts
