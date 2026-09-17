'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import type { CourseSessionStudent } from '../course-types';

/**
 * LIVE_ONLINE courses have no chapters/lessons — their content is a fixed
 * number of scheduled classes. Time is negotiated with the student outside
 * the app; this form is where the teacher (or admin) records the agreed time,
 * which creates the actual Booking the student then sees on their calendar.
 */
export function CourseSessionScheduler({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [notice, setNotice] = useState('');
  const students = useQuery({
    queryKey: ['course-session-students', courseId],
    queryFn: () => api<CourseSessionStudent[]>(`/instructor/courses/${courseId}/session-students`),
  });
  const schedule = useMutation({
    mutationFn: (body: { studentId: string; startsAt: string; endsAt: string; timezone: string }) =>
      api('/bookings/schedule-course-session', { method: 'POST', body: JSON.stringify({ ...body, courseId }) }),
    onSuccess: () => {
      setNotice('جلسه با موفقیت زمان‌بندی شد.');
      void qc.invalidateQueries({ queryKey: ['course-session-students', courseId] });
    },
    onError: (error: unknown) => setNotice(apiMessage(error, 'زمان‌بندی جلسه ناموفق بود.')),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      studentId = String(data.get('studentId')),
      date = String(data.get('date')),
      time = String(data.get('time')),
      durationMinutes = Number(data.get('durationMinutes')),
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startsAt = new Date(`${date}T${time}`);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    schedule.mutate({ studentId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timezone });
  }

  return (
    <div className="panel-card p-5">
      <div className="flex items-center gap-2">
        <CalendarPlus className="text-purple" />
        <h2 className="text-lg font-black">زمان‌بندی جلسه (توافق‌شده با دانشجو)</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        زمان هر جلسه را پس از هماهنگی مستقیم با دانشجو اینجا ثبت کنید؛ جلسه به‌صورت خودکار در تقویم و کلاس‌های دانشجو
        نمایش داده می‌شود.
      </p>
      {notice && (
        <p role="status" className="mt-4 rounded-xl border hairline bg-white px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {students.isLoading ? (
        <div className="skeleton mt-5 h-32 rounded-2xl" />
      ) : students.isError ? (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-5 text-red-700">
          {apiMessage(students.error, 'دریافت دانشجویان ناموفق بود.')}
        </div>
      ) : !students.data?.length ? (
        <p className="mt-5 rounded-xl border border-dashed hairline p-6 text-center text-sm text-muted">
          هنوز دانشجویی در این دوره ثبت‌نام نکرده است.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">
            دانشجو
            <select name="studentId" className="input" required>
              {students.data.map((student) => (
                <option key={student.studentId} value={student.studentId} disabled={student.remainingCredits <= 0}>
                  {student.name ?? student.studentId} — {student.remainingCredits} جلسه باقی‌مانده
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            مدت جلسه (دقیقه)
            <input name="durationMinutes" type="number" min={15} step={5} defaultValue={60} required className="input" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            تاریخ
            <input name="date" type="date" required className="input latin" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            ساعت شروع
            <input name="time" type="time" required className="input latin" />
          </label>
          <button disabled={schedule.isPending} className="primary-button justify-center md:col-span-2">
            {schedule.isPending ? 'در حال ثبت...' : 'ثبت زمان جلسه'}
          </button>
        </form>
      )}
    </div>
  );
}
