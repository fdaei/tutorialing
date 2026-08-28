'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Rule = { weekday: number; startMinute: number; endMinute: number };
type Block = { id: string; startsAt: string; endsAt: string; reason?: string };
type Availability = { rules: Rule[]; blocks: Block[] };
type Booking = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  student?: { name?: string; phone?: string };
  teacher?: { nameFa?: string; nameEn?: string };
};
type Note = { id: string; date: string; time: string; title: string; color: 'indigo' | 'amber' | 'emerald' };
type CalendarMode = 'student' | 'teacher' | 'admin';

export function TeacherPlannerCalendar({ mode = 'teacher' }: { mode?: CalendarMode }) {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    [month, setMonth] = useState(() => startMonth(new Date())),
    [selected, setSelected] = useState(() => dateKey(new Date())),
    [open, setOpen] = useState(false),
    [notes, setNotes] = useState<Note[]>([]);
  const storageKey = `lingospeak.${mode}-planner.v1`;
  const availability = useQuery({
    queryKey: ['availability-me'],
    queryFn: () => api<Availability>('/availability/me'),
    enabled: mode === 'teacher',
  });
  const endpoint = mode === 'admin' ? '/admin/bookings' : '/bookings/me';
  const bookings = useQuery({ queryKey: [endpoint], queryFn: () => api<Booking[]>(endpoint) });
  useEffect(() => {
    try {
      setNotes(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      setNotes([]);
    }
  }, [storageKey]);
  const save = (next: Note[]) => {
    setNotes(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const days = useMemo(() => calendarDays(month), [month]),
    today = dateKey(new Date()),
    selectedDate = parseKey(selected);
  const dayBookings = (key: string) =>
    (Array.isArray(bookings.data) ? bookings.data : []).filter(
      (item) => dateKey(new Date(item.startsAt)) === key && !['CANCELLED'].includes(item.status),
    );
  const dayBlocks = (key: string) =>
    (availability.data?.blocks ?? []).filter((item) => dateKey(new Date(item.startsAt)) === key);
  const selectedBookings = dayBookings(selected),
    selectedBlocks = dayBlocks(selected),
    selectedNotes = notes.filter((item) => item.date === selected).sort((a, b) => a.time.localeCompare(b.time));
  const weekdayNames = localized(
    { fa: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'], en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
    locale,
  );
  const title = new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
    month: 'long',
    year: 'numeric',
  }).format(month);
  const changeMonth = (amount: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const copy =
    mode === 'admin'
      ? {
          eyebrow: translate(locale, 'schedulingteacherPlannerCalendarPlatformWideSchedule'),
          title: translate(locale, 'schedulingteacherPlannerCalendarClassesAndEventsCalendar'),
          description: translate(
            locale,
            'schedulingteacherPlannerCalendarEveryTeacherAndStudentBookingAlongsideAdministrativeTasks',
          ),
        }
      : mode === 'student'
        ? {
            eyebrow: translate(locale, 'schedulingteacherPlannerCalendarMyLearningSchedule'),
            title: translate(locale, 'schedulingteacherPlannerCalendarClassesAndTasksCalendar'),
            description: translate(
              locale,
              'schedulingteacherPlannerCalendarClassesAssignmentsAndPersonalRemindersAtAGlance',
            ),
          }
        : {
            eyebrow: translate(locale, 'schedulingteacherPlannerCalendarUnifiedSchedule'),
            title: translate(locale, 'schedulingteacherPlannerCalendarMyWorkCalendar'),
            description: translate(locale, 'schedulingteacherPlannerCalendarClassesBlockedTimesAndPersonalNotesAtA'),
          };
  const bookingTitle = (item: Booking) => {
    if (mode === 'admin')
      return `${item.student?.name || item.student?.phone || translate(locale, 'schedulingteacherPlannerCalendarStudent')} — ${localized({ fa: item.teacher?.nameFa, en: item.teacher?.nameEn || item.teacher?.nameFa || translate(locale, 'schedulingteacherPlannerCalendarTeacher') }, locale)}`;
    if (mode === 'student')
      return (
        localized({ fa: item.teacher?.nameFa, en: item.teacher?.nameEn }, locale) ||
        item.teacher?.nameFa ||
        translate(locale, 'schedulingteacherPlannerCalendarMyClass')
      );
    return item.student?.name || translate(locale, 'schedulingteacherPlannerCalendarBookedClass');
  };
  return (
    <section className="panel-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline p-5 md:p-6">
        <div>
          <p className="text-sm font-bold text-blue">{copy.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">{copy.description}</p>
        </div>
        <button onClick={() => setOpen(true)} className="primary-button">
          <CalendarPlus size={18} />
          {translate(locale, 'schedulingteacherPlannerCalendarNewEvent')}
        </button>
      </div>
      <div className="grid lg:grid-cols-[1fr_340px]">
        <div className="p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => changeMonth(localized({ fa: 1, en: -1 }, locale))}
              className="grid size-10 place-items-center rounded-xl border hairline bg-white"
            >
              {localized({ fa: <ChevronRight />, en: <ChevronLeft /> }, locale)}
            </button>
            <strong className="text-lg">{title}</strong>
            <button
              onClick={() => changeMonth(localized({ fa: -1, en: 1 }, locale))}
              className="grid size-10 place-items-center rounded-xl border hairline bg-white"
            >
              {localized({ fa: <ChevronLeft />, en: <ChevronRight /> }, locale)}
            </button>
          </div>
          <div className="grid grid-cols-7">
            {weekdayNames.map((name, index) => (
              <div key={index} className="pb-3 text-center text-xs font-bold text-muted">
                {name}
              </div>
            ))}
            {days.map((date, index) => {
              const key = dateKey(date),
                inMonth = date.getMonth() === month.getMonth(),
                booked = dayBookings(key),
                blocked = dayBlocks(key),
                dayNotes = notes.filter((item) => item.date === key),
                active = key === selected;
              return (
                <button
                  key={index}
                  onClick={() => setSelected(key)}
                  className={`calendar-day min-h-24 border p-2 text-start md:min-h-28 ${active ? 'calendar-day-active' : ''} ${!inMonth ? 'opacity-35' : ''}`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full text-xs font-bold ${key === today ? 'bg-indigo-600 text-white' : ''}`}
                  >
                    {new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(date.getDate())}
                  </span>
                  <span className="mt-2 grid gap-1">
                    {booked.slice(0, 2).map((item) => (
                      <i key={item.id} className="calendar-event bg-indigo-50 text-indigo-700">
                        {time(item.startsAt)} {translate(locale, 'schedulingteacherPlannerCalendarClass')}
                      </i>
                    ))}
                    {blocked.length > 0 && (
                      <i className="calendar-event bg-rose-50 text-rose-700">
                        {translate(locale, 'schedulingteacherPlannerCalendarBlocked')}
                      </i>
                    )}
                    {dayNotes.slice(0, 1).map((item) => (
                      <i key={item.id} className={`calendar-event calendar-${item.color}`}>
                        {item.time} {item.title}
                      </i>
                    ))}
                    {booked.length + blocked.length + dayNotes.length > 3 && (
                      <small className="text-[10px] text-muted">
                        +{booked.length + blocked.length + dayNotes.length - 3}
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <aside className="border-t hairline bg-[#fafbff] p-5 lg:border-s lg:border-t-0 md:p-6">
          <p className="text-xs font-bold text-blue">
            {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
              weekday: 'long',
            }).format(selectedDate)}
          </p>
          <h3 className="mt-1 text-xl font-black">
            {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
              day: 'numeric',
              month: 'long',
            }).format(selectedDate)}
          </h3>
          <div className="mt-5 grid gap-3">
            {selectedBookings.map((item) => (
              <Event
                key={item.id}
                color="indigo"
                time={`${time(item.startsAt)}–${time(item.endsAt)}`}
                title={bookingTitle(item)}
              />
            ))}
            {selectedBlocks.map((item) => (
              <Event
                key={item.id}
                color="rose"
                time={time(item.startsAt)}
                title={item.reason || translate(locale, 'schedulingteacherPlannerCalendarBlockedTime')}
              />
            ))}
            {selectedNotes.map((item) => (
              <div key={item.id} className={`flex gap-3 rounded-2xl border bg-white p-3 calendar-border-${item.color}`}>
                <Clock3 size={17} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{item.title}</strong>
                  <small className="text-muted">{item.time}</small>
                </div>
                <button
                  aria-label={translate(locale, 'schedulingteacherPlannerCalendarDelete')}
                  onClick={() => save(notes.filter((note) => note.id !== item.id))}
                  className="text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!selectedBookings.length && !selectedBlocks.length && !selectedNotes.length && (
              <div className="rounded-2xl border border-dashed hairline p-6 text-center">
                <p className="text-sm text-muted">
                  {translate(locale, 'schedulingteacherPlannerCalendarNothingPlannedForThisDay')}
                </p>
                <button onClick={() => setOpen(true)} className="mt-3 text-sm font-bold text-blue">
                  {translate(locale, 'schedulingteacherPlannerCalendarAddANote')}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
      {open && (
        <NoteDialog
          fa={fa}
          date={selected}
          close={() => setOpen(false)}
          add={(note) => {
            save([...notes, note]);
            setSelected(note.date);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function Event({ color, time: label, title }: { color: string; time: string; title: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-3 calendar-border-${color}`}>
      <strong className="block text-sm">{title}</strong>
      <small className="mt-1 block text-muted">{label}</small>
    </div>
  );
}
function NoteDialog({
  fa,
  date,
  close,
  add,
}: {
  fa: boolean;
  date: string;
  close: () => void;
  add: (note: Note) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={close}>
      <form
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          add({
            id: crypto.randomUUID(),
            date: String(data.get('date')),
            time: String(data.get('time')),
            title: String(data.get('title')).trim(),
            color: String(data.get('color')) as Note['color'],
          });
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue">
              {translate(fa, 'schedulingteacherPlannerCalendarPersonalPlanning')}
            </p>
            <h3 className="mt-1 text-xl font-black">
              {translate(fa, 'schedulingteacherPlannerCalendarNewEventOrNote')}
            </h3>
          </div>
          <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label>
            <span className="mb-2 block text-sm font-bold">
              {translate(fa, 'schedulingteacherPlannerCalendarTitle')}
            </span>
            <input
              name="title"
              required
              maxLength={80}
              autoFocus
              className="input"
              placeholder={translate(fa, 'schedulingteacherPlannerCalendarEGPrepareSpeakingLesson')}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block text-sm font-bold">
                {translate(fa, 'schedulingteacherPlannerCalendarDate')}
              </span>
              <input name="date" type="date" required defaultValue={date} className="input latin" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">
                {translate(fa, 'schedulingteacherPlannerCalendarTime')}
              </span>
              <input name="time" type="time" required defaultValue="09:00" className="input latin" />
            </label>
          </div>
          <label>
            <span className="mb-2 block text-sm font-bold">
              {translate(fa, 'schedulingteacherPlannerCalendarColor')}
            </span>
            <select name="color" className="input">
              <option value="indigo">{translate(fa, 'schedulingteacherPlannerCalendarBlueWork')}</option>
              <option value="amber">{translate(fa, 'schedulingteacherPlannerCalendarYellowReminder')}</option>
              <option value="emerald">{translate(fa, 'schedulingteacherPlannerCalendarGreenPersonal')}</option>
            </select>
          </label>
          <button className="primary-button justify-center">
            <Plus size={18} />
            {translate(fa, 'schedulingteacherPlannerCalendarSaveToCalendar')}
          </button>
        </div>
      </form>
    </div>
  );
}
function startMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseKey(key: string) {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function time(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(value),
  );
}
