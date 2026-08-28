# LingoSpeak E-Learning transformation audit

Date: 2026-08-28

## Executive summary

The repository is a mature private-tutoring and booking platform with strong
authentication, payments, assessment, support, file-storage, and audit-log
foundations. It is not yet a complete asynchronous LMS: public course cards are
backed by static web data and there is no persisted course curriculum or lesson
progress. The safest transformation is additive: preserve bookings and teacher
packages, introduce a separate course aggregate, then connect commerce and the
student dashboard to it.

## Current system map

- Web: Next.js App Router, React Query, RTL-first Tailwind/global tokens.
- API: NestJS modules with global authentication, authorization, rate limiting,
  validation and exception filters.
- Data: PostgreSQL through Prisma, with append-only migrations.
- Identity: short-lived bearer access token in session storage, rotating refresh
  cookie scoped to `/api/auth`, server-side revocation.
- Existing domains: users, teachers, bookings, packages/payments, learning plans,
  placement/proctored tests, support, CMS pages, blog, notifications and files.

## Findings by severity

### Critical

1. No persisted `Course`, `CourseChapter`, `Lesson`, `CourseEnrollment` or
   `LessonProgress` aggregate exists. The course catalogue and detail pages use
   `marketplace-data.ts`, so purchase, resume and completion cannot be real.
2. The database role enum exposes seven organizational roles. The requested
   four-role model requires a data migration and permission remapping; deleting
   roles directly would lock finance, examiner and staff users out of live work.

### High

1. No community domain or API exists. Blog comments cannot safely double as a
   feed because they have different publishing, moderation and reply semantics.
2. Blog lifecycle is only `DRAFT -> PUBLISHED -> ARCHIVED`; it lacks instructor
   ownership enforcement, review submission, rejection reason and resubmission.
3. There is no course player, last-lesson pointer, progress calculation,
   attachments or completion idempotency.
4. Protected route enforcement is primarily client-side navigation plus API
   authorization. API security is sound, but middleware cannot inspect the
   session-storage token; protected pages must always fail closed while loading
   `/users/me` and redirect on anonymous state.

### Medium

1. CMS pages share one text-card template and do not express page-specific
   information architecture for FAQ, contact, policies and About.
2. Design tokens exist, but reusable form controls, alert, badge, tabs, modal,
   toast, pagination and state primitives are incomplete or scattered.
3. Admin navigation is role-aware but remains based on legacy organizational
   roles and a long flat list rather than product domains.
4. Authentication offers a combined OTP flow. Its behavior is robust, but the
   distinction between sign-in and registration is not explicit enough in copy.

### Low / completed foundation

1. Logout now clears the access token, announces a global session event and
   updates Header React Query state without a reload.
2. Footer phone/email are actionable and RTL/mobile-safe.
3. Landing placement CTA and immediate weighted CEFR scoring exist, including
   guest completion and authenticated history.
4. The public course detail presentation has been expanded, but remains blocked
   on the missing course backend for enrollment-aware CTA and progress.

## Architecture impact

### New bounded contexts

- `courses`: catalogue, chapters, lessons, attachments, enrollment and progress.
- `community`: posts, reactions, comments/replies and moderation.

### Extended contexts

- `blog`: author workflow and admin review transitions.
- `auth`: canonical four-role projection and migration from legacy roles.
- `learning`: consume course progress rather than static cards.

## Required database changes

1. Role migration: `TEACHER -> INSTRUCTOR`; `STAFF`, `FINANCE`, and `EXAMINER`
   become `ADMIN` or `SUPPORT` plus explicit permissions. Migrate assignments
   before shrinking the PostgreSQL enum.
2. Course tables: course, chapter, lesson, attachment, enrollment, lesson
   progress and optional quiz/question/attempt.
3. Community tables: community post, reaction, comment with nullable `parentId`,
   moderation status and indexed feed ordering.
4. Blog fields/statuses: `PENDING_REVIEW`, `APPROVED`, `REJECTED`, rejection
   reason/reviewer/reviewed timestamps.
5. Placement result table is already introduced by migration
   `20260828150000_immediate_placement_results`.

## UI and component impact

- Public: Header/Footer, Landing, Course Detail, Community Feed/Post, Blog,
  Placement and page-specific CMS layouts.
- Student: dashboard, My Courses, Player, Progress, Placement history/activity.
- Instructor: course authoring, curriculum, students and article workflow.
- Admin: grouped navigation, course/community moderation and article review.
- Shared: Button, Field, Select, Checkbox/Radio, Modal, Dropdown, Tabs, Badge,
  Alert, Card, Table, Pagination, Skeleton, Empty/Error state and Toast.

## Implementation plan

1. Canonical role/permission migration and auth regression coverage.
2. Shared design primitives and grouped role navigation.
3. Course aggregate, APIs, catalogue/detail, enrollment and player/progress.
4. Community aggregate, APIs and responsive feed/detail experience.
5. Instructor-to-admin blog review workflow.
6. Placement/CMS/Footer/Landing consolidation.
7. Full regression, responsive, accessibility, security and production build.

## Design direction

The interface uses learning progression as its visual language: connected
milestones, mastery states and visible next actions. Brand navy/indigo carries
structure, emerald indicates mastery, and warm amber is reserved for attention.
Vazirmatn remains the Persian body/display family and Inter is limited to CEFR,
scores and technical data. The signature is one continuous learning-route motif;
other decoration stays restrained.
