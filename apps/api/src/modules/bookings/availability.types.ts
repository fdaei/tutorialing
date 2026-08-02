/**
 * Domain types for teacher availability (weekly rules, per-day exceptions,
 * blocked periods and the bookable slots derived from them).
 *
 * These are the service-layer contracts: the controller maps request DTOs onto
 * them, so the services stay decoupled from class-validator DTO classes.
 */

/** A lesson is either a one-off trial or a regular paid session. */
export type SlotType = 'trial' | 'regular';

/** One weekly recurring availability range, as accepted by `setRules`. */
export type AvailabilityRuleInput = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes from local midnight, inclusive. */
  startMinute: number;
  /** Minutes from local midnight, exclusive. */
  endMinute: number;
  /** IANA timezone the minute offsets are expressed in. */
  timezone: string;
  /** Lesson length in minutes; defaults to 60 when omitted. */
  lessonDuration?: number;
  /** Gap between back-to-back lessons in minutes; defaults to 0 when omitted. */
  breakMinutes?: number;
};

/** An availability rule after defaults have been applied by validation. */
export type NormalizedAvailabilityRule = AvailabilityRuleInput & {
  lessonDuration: number;
  breakMinutes: number;
};

/** A single-day exception that overrides the weekly rules. */
export type AvailabilityOverrideInput = {
  /** Calendar day, `YYYY-MM-DD` (any ISO date string is truncated to the day). */
  date: string;
  /** `false` marks the whole day unavailable; `true` requires a time range. */
  available: boolean;
  startMinute?: number;
  endMinute?: number;
  reason?: string;
};

/** An absolute interval the teacher is unavailable for. */
export type BlockedPeriodInput = {
  /** ISO-8601 instant. */
  startsAt: string;
  /** ISO-8601 instant, must be after `startsAt`. */
  endsAt: string;
  reason?: string;
};

/** Same as {@link BlockedPeriodInput}, but staff must name the teacher. */
export type AdminBlockedPeriodInput = BlockedPeriodInput & { teacherId?: string };

/** A bookable slot returned by the public availability endpoint. */
export type AvailabilitySlot = {
  /** ISO-8601 instant. */
  startsAt: string;
  /** ISO-8601 instant. */
  endsAt: string;
  /** Teacher-local calendar day the slot belongs to, `YYYY-MM-DD`. */
  date: string;
  /** IANA timezone `date` is expressed in. */
  timezone: string;
  type: SlotType;
};
