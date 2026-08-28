'use client';

import { localized, translate } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type RecordValue = Record<string, unknown>;
type Option = { value: string; label: string };
const isRecord = (input: unknown): input is RecordValue =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const rows = (input: unknown): RecordValue[] =>
  Array.isArray(input)
    ? input.filter(isRecord)
    : isRecord(input) && Array.isArray(input.data)
      ? input.data.filter(isRecord)
      : [];
const stringValue = (input: unknown) => (typeof input === 'string' ? input : '');
const nested = (input: unknown, key: string) =>
  isRecord(input) && isRecord(input[key]) ? (input[key] as RecordValue) : undefined;
const localizedDate = (input: unknown, fa: boolean) => {
  if (typeof input !== 'string') return '';
  const date = new Date(input);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(translate(fa, 'commercepricingManagerEnUS2'), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : '';
};

function EntitySelect({
  name,
  label,
  endpoint,
  options,
  fa,
}: {
  name: string;
  label: string;
  endpoint: string;
  options: (data: unknown) => Option[];
  fa: boolean;
}) {
  const query = useQuery({ queryKey: ['entity-options', endpoint], queryFn: () => api<unknown>(endpoint) }),
    items = query.data ? options(query.data) : [];
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        name={name}
        required
        disabled={query.isLoading || query.isError || !items.length}
        defaultValue=""
        className="w-full rounded-2xl border hairline bg-white px-4 py-3 disabled:bg-[#f4f5f8] disabled:text-muted"
      >
        <option value="" disabled>
          {query.isLoading
            ? translate(fa, 'legacyLoadingOptions')
            : query.isError
              ? translate(fa, 'legacyCouldNotLoadOptions')
              : !items.length
                ? translate(fa, 'legacyNoOptionsAvailable')
                : translate(fa, 'legacyChooseAnOption')}
        </option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {query.isError && (
        <button type="button" onClick={() => query.refetch()} className="mt-2 text-xs font-bold text-purple underline">
          {translate(fa, 'legacyTryAgain')}
        </button>
      )}
    </label>
  );
}

export function AssignmentSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="assignmentId"
      label={translate(fa, 'legacyAssignment')}
      endpoint="/learning/plans"
      fa={fa}
      options={(data) =>
        rows(data).flatMap((plan) =>
          Array.isArray(plan.assignments)
            ? plan.assignments
                .filter(isRecord)
                .filter((assignment) => assignment.status !== 'submitted')
                .map((assignment) => ({
                  value: stringValue(assignment.id),
                  label: `${stringValue(assignment.title) || translate(fa, 'legacyUntitledAssignment')} — ${stringValue(plan.title) || translate(fa, 'legacyLearningPlan')}${assignment.dueAt ? ` · ${localizedDate(assignment.dueAt, fa)}` : ''}`,
                }))
                .filter((option) => option.value)
            : [],
        )
      }
    />
  );
}
export function LearningPlanSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="planId"
      label={translate(fa, 'legacylearningPlan2')}
      endpoint="/learning/plans"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((plan) => {
            const student = nested(plan, 'student');
            return {
              value: stringValue(plan.id),
              label: [
                stringValue(plan.title) || translate(fa, 'legacyUntitledPlan'),
                stringValue(student?.name) || translate(fa, 'legacyStudent'),
              ].join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
export function StudentSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="studentId"
      label={translate(fa, 'legacystudent2')}
      endpoint="/bookings/students"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter(
            (student) =>
              !Array.isArray(student.bookings) ||
              student.bookings.some((booking) => isRecord(booking) && booking.status === 'COMPLETED'),
          )
          .map((student) => ({
            value: stringValue(student.id),
            label: [stringValue(student.name) || translate(fa, 'legacyUnnamed'), stringValue(student.phone)]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
export function BookingSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="bookingId"
      label={translate(fa, 'legacyBookedClass')}
      endpoint="/bookings/me"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter((booking) => booking.status === 'CONFIRMED')
          .map((booking) => {
            const student = nested(booking, 'student');
            return {
              value: stringValue(booking.id),
              label: `${stringValue(student?.name) || stringValue(student?.phone) || translate(fa, 'legacystudent3')} — ${localizedDate(booking.startsAt, fa)}`,
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
export function AdminUserSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="userId"
      label={translate(fa, 'legacyUser')}
      endpoint="/admin/users?page=1"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((user) => ({
            value: stringValue(user.id),
            label: [
              stringValue(user.name) || translate(fa, 'legacyunnamed2'),
              stringValue(user.phone),
              stringValue(user.email),
            ]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
export function TeacherApplicationSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="teacherId"
      label={translate(fa, 'legacyTeacherApplication')}
      endpoint="/admin/teacher-applications"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((teacher) => {
            const user = nested(teacher, 'user');
            return {
              value: stringValue(teacher.id),
              label: [
                localized({ fa: stringValue(teacher.nameFa), en: stringValue(teacher.nameEn) }, locale),
                stringValue(user?.phone),
                stringValue(teacher.status),
              ]
                .filter(Boolean)
                .join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
export function ApprovedTeacherSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="teacherId"
      label={translate(fa, 'legacyTeacher')}
      endpoint="/teachers?limit=50"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((teacher) => ({
            value: stringValue(teacher.id),
            label: [
              localized({ fa: stringValue(teacher.nameFa), en: stringValue(teacher.nameEn) }, locale),
              stringValue(teacher.specialties),
            ]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
export function PaymentSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="paymentId"
      label={translate(fa, 'legacyPayment')}
      endpoint="/admin/payments"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter((payment) => ['PAID', 'PARTIALLY_REFUNDED'].includes(stringValue(payment.status)))
          .map((payment) => {
            const user = nested(payment, 'user'),
              amount =
                typeof payment.amount === 'number'
                  ? new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(payment.amount)
                  : '';
            return {
              value: stringValue(payment.id),
              label: [
                stringValue(user?.name) || stringValue(user?.phone) || translate(fa, 'legacyuser2'),
                amount && localized({ fa: `${amount} تومان`, en: `${amount} IRR` }, locale),
                localizedDate(payment.createdAt, fa),
                stringValue(payment.status),
              ]
                .filter(Boolean)
                .join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
