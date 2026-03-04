/**
 * Compatibility layer: transforms pawnote objects to pronotepy-compatible JSON format.
 */
import * as pronote from "@niicojs/pawnote";

// ── Grades ────────────────────────────────────────────────────────────────────

const GRADE_KIND_STRINGS: Record<number, string> = {
  1: "Absent",
  2: "Dispense",
  3: "NonNote",
  4: "Inapte",
  5: "NonRendu",
  6: "AbsentZero",
  7: "NonRenduZero",
  8: "Felicitations",
};

export function gradeValueToString(gv: pronote.GradeValue | undefined): string | null {
  if (!gv) return null;
  if (gv.kind !== 0) return GRADE_KIND_STRINGS[gv.kind] ?? null;
  return Number.isNaN(gv.points) ? null : String(gv.points);
}

export function toCompatGrade(grade: pronote.Grade, periodName: string): Record<string, unknown> {
  return {
    id: grade.id,
    grade: gradeValueToString(grade.value),
    out_of: gradeValueToString(grade.outOf),
    default_out_of: gradeValueToString(grade.defaultOutOf),
    date: grade.date,
    subject: grade.subject,
    period: periodName,
    average: gradeValueToString(grade.average),
    max: gradeValueToString(grade.max),
    min: gradeValueToString(grade.min),
    coefficient: String(grade.coefficient),
    comment: grade.comment,
    is_bonus: grade.isBonus,
    is_optionnal: grade.isOptional,
    is_out_of_20: grade.isOutOf20,
  };
}

// ── Lessons ───────────────────────────────────────────────────────────────────

export function toCompatLesson(lesson: pronote.TimetableClass): Record<string, unknown> {
  const base = {
    id: lesson.id,
    background_color: lesson.backgroundColor ?? null,
    start: lesson.startDate,
    end: lesson.endDate,
    num: lesson.blockPosition,
  };

  if ((lesson as pronote.TimetableClassLesson).is === "lesson") {
    const l = lesson as pronote.TimetableClassLesson;
    return {
      ...base,
      subject: l.subject ?? null,
      teacher_name: l.teacherNames[0] ?? null,
      teacher_names: l.teacherNames,
      classroom: l.classrooms[0] ?? null,
      classrooms: l.classrooms,
      group_name: l.groupNames[0] ?? null,
      group_names: l.groupNames,
      canceled: l.canceled,
      status: l.status ?? null,
      exempted: l.exempted,
      virtual_classrooms: l.virtualClassrooms,
      test: l.test,
      detention: false,
      outing: false,
      memo: null,
    };
  }

  if ((lesson as pronote.TimetableClassDetention).is === "detention") {
    const d = lesson as pronote.TimetableClassDetention;
    return {
      ...base,
      subject: null,
      teacher_name: null,
      teacher_names: [],
      classroom: null,
      classrooms: [],
      group_name: null,
      group_names: [],
      canceled: false,
      status: null,
      exempted: false,
      virtual_classrooms: [],
      test: false,
      detention: true,
      outing: false,
      memo: null,
    };
  }

  // activity / outing
  const a = lesson as pronote.TimetableClassActivity;
  return {
    ...base,
    subject: null,
    teacher_name: null,
    teacher_names: [],
    classroom: null,
    classrooms: [],
    group_name: null,
    group_names: [],
    canceled: false,
    status: a.title ?? null,
    exempted: false,
    virtual_classrooms: [],
    test: false,
    detention: false,
    outing: true,
    memo: null,
  };
}

// ── Homework ──────────────────────────────────────────────────────────────────

export function toCompatHomework(hw: pronote.Assignment): Record<string, unknown> {
  return {
    id: hw.id,
    subject: hw.subject,
    description: hw.description,
    background_color: hw.backgroundColor,
    done: hw.done,
    date: hw.deadline,
  };
}

// ── Absences ──────────────────────────────────────────────────────────────────

export function toCompatAbsence(a: pronote.NotebookAbsence): Record<string, unknown> {
  const totalMinutes = a.hoursMissed * 60 + a.minutesMissed;
  const hours = totalMinutes > 0
    ? `${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, "0")}`
    : null;
  return {
    id: a.id,
    from_date: a.startDate,
    to_date: a.endDate,
    justified: a.justified,
    hours,
    days: a.daysMissed,
    reasons: a.reason ? [a.reason] : [],
  };
}

// ── Delays ────────────────────────────────────────────────────────────────────

export function toCompatDelay(d: pronote.NotebookDelay): Record<string, unknown> {
  return {
    id: d.id,
    date: d.date,
    minutes: d.minutes,
    justified: d.justified,
    justification: d.justification ?? null,
    reasons: d.reason ? [d.reason] : [],
  };
}
