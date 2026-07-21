# LingoSpeak UI route index

The interface uses one responsive blue–purple design system across Persian RTL and English LTR experiences. Shared tokens, typography, motion, cards, inputs, navigation, loading, empty, success, and error states live in the web application design layer.

## Public and authentication

- `/` — Persian landing page
- `/en` — English landing page
- `/auth` — phone and OTP authentication
- `/teachers` and `/teachers/[id]` — teacher directory and profile
- `/placement` — assessment introduction
- `/matching` — teacher matching form and results
- `/checkout` — trial booking and checkout
- `/about`, `/how-it-works`, `/faq`, `/contact`, `/terms`, `/privacy`, `/cancellation-policy`, `/become-a-teacher` — CMS pages
- `/en/[slug]` — English CMS pages

## Student

- `/dashboard` — student overview
- `/dashboard/plan` — learning plan and milestones
- `/dashboard/classes` — bookings and classes
- `/dashboard/tests` — test history and results
- `/dashboard/tickets` — support tickets
- `/dashboard/wallet` — wallet and transactions
- `/dashboard/settings` — profile settings
- `/test/device-check` and `/test/session` — assessment flow

## Teacher

- `/teacher-panel` — teacher overview
- `/teacher-panel/profile` — profile editor
- `/teacher-panel/availability` — availability
- `/teacher-panel/bookings` — classes and bookings
- `/teacher-panel/students` — student list
- `/teacher-panel/earnings` — earnings
- `/teacher-panel/settings` — account settings

## Administration

- `/admin` — operations overview
- `/admin/users` — users and roles
- `/admin/teachers` — teacher approvals
- `/admin/tests` — test management, question builder, JSON/CSV question import
- `/admin/reviews` — human assessment review
- `/admin/bookings` — bookings
- `/admin/payments` — payment status
- `/admin/tickets` — support operations
- `/admin/cms` — bilingual content management
- `/admin/audit` — audit log
- `/admin/settings` — platform settings

## Payment states

- `/payment/pending`
- `/payment/success`
- `/payment/failure`
- `/payment/development`

