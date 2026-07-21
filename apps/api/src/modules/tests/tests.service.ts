import { Injectable } from '@nestjs/common';
import { Prisma, type AnswerReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, conflict, notFound } from '../../common/errors';
import { ScoringService } from './scoring.service';

const OBJECTIVE_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false']);
const SUBJECTIVE_TYPES = new Set(['essay', 'recording', 'short_text']);
const AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];

@Injectable()
export class TestsService {
  constructor(private db: PrismaService, private scoring: ScoringService) {}

  list(languageId?: string) {
    return this.db.testDefinition.findMany({
      where: { published: true, ...(languageId ? { languageId } : {}) },
      select: {
        id: true, slug: true, languageId: true, level: true, titleFa: true, titleEn: true,
        descriptionFa: true, descriptionEn: true, durationMinutes: true,
        language: { select: { code: true, nameFa: true, nameEn: true, nativeName: true, flag: true, direction: true } },
        sections: { select: { skill: true, title: true, durationMinutes: true, order: true }, orderBy: { order: 'asc' } },
      },
      orderBy: [{ language: { order: 'asc' } }, { titleEn: 'asc' }],
    });
  }

  async start(userId: string, testId: string) {
    const test = await this.db.testDefinition.findFirst({ where: { id: testId, published: true }, include: { sections: { orderBy: { order: 'asc' } } } });
    if (!test) throw notFound('PUBLISHED_TEST_NOT_FOUND', 'آزمون منتشرشده پیدا نشد.', 'Published test was not found.');
    if (!test.sections.length) throw badRequest('TEST_HAS_NO_SECTIONS', 'این آزمون بخش معتبری ندارد و قابل شروع نیست.', 'This test has no valid sections and cannot be started.');
    return this.db.testAttempt.create({
      data: {
        userId, testId, expiresAt: new Date(Date.now() + test.durationMinutes * 60_000), currentSectionId: test.sections[0]!.id,
        sectionStates: { create: test.sections.map((section, index) => ({ sectionId: section.id, status: index === 0 ? 'available' : 'locked', remainingSeconds: section.durationMinutes * 60 })) },
      },
      include: { sectionStates: true, test: { select: { languageId: true, titleFa: true, titleEn: true } } },
    });
  }

  resume(userId: string, id: string) {
    return this.db.testAttempt.findFirst({
      where: { id, userId },
      include: {
        test: { include: { language: true, sections: { include: { passages: { include: { audioFile: true }, orderBy: { order: 'asc' } }, questions: { include: { audioFile: true }, orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } } },
        answers: true, sectionStates: true, scores: true,
      },
    });
  }

  async save(userId: string, id: string, answers: { questionId: string; value?: unknown; textValue?: string; fileId?: string; flagged?: boolean }[]) {
    const attempt = await this.db.testAttempt.findFirst({ where: { id, userId } });
    const isRevision = attempt?.status === 'UNDER_REVIEW';
    if (!attempt || (!isRevision && (attempt.status !== 'IN_PROGRESS' || attempt.expiresAt < new Date()))) {
      throw badRequest('TEST_ATTEMPT_CLOSED', 'این آزمون بسته یا منقضی شده و پاسخ جدید ذخیره نمی‌شود.', 'This test attempt is closed or expired and cannot accept new answers.');
    }
    if (!answers.length) throw badRequest('TEST_ANSWERS_EMPTY', 'حداقل یک پاسخ برای ذخیره ارسال کنید.', 'Send at least one answer to save.');
    const uniqueQuestionIds = [...new Set(answers.map((answer) => answer.questionId))];
    const questions = await this.db.question.findMany({ where: { id: { in: uniqueQuestionIds }, section: { testId: attempt.testId } } });
    if (questions.length !== uniqueQuestionIds.length) throw badRequest('TEST_QUESTION_UNKNOWN', 'حداقل یکی از سؤال‌ها متعلق به این آزمون نیست.', 'At least one question does not belong to this test.');
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    if (isRevision) {
      const existing = await this.db.testAnswer.findMany({ where: { attemptId: id, questionId: { in: uniqueQuestionIds } } });
      const existingMap = new Map(existing.map((answer) => [answer.questionId, answer]));
      const invalid = uniqueQuestionIds.find((questionId) => {
        const question = questionMap.get(questionId);
        const answer = existingMap.get(questionId);
        return !question || !SUBJECTIVE_TYPES.has(question.type) || answer?.reviewStatus !== 'NEEDS_REVISION';
      });
      if (invalid) {
        throw badRequest('TEST_REVISION_NOT_ALLOWED', 'فقط پاسخ‌های تشریحی که ارزیاب برای آن‌ها درخواست اصلاح ثبت کرده است قابل ویرایش هستند.', 'Only subjective answers explicitly marked as needing revision can be edited.', {
          answers: { fa: 'پاسخ‌های تأییدشده یا در حال بررسی را تغییر ندهید؛ فقط مورد «نیازمند اصلاح» را دوباره ارسال کنید.', en: 'Do not change approved or in-review answers; resubmit only answers marked “Needs revision”.' },
        });
      }
    }
    const fileIds = [...new Set(answers.flatMap((answer) => answer.fileId ? [answer.fileId] : []))];
    if (fileIds.length) {
      const files = await this.db.storedFile.findMany({ where: { id: { in: fileIds }, ownerId: userId, status: 'SAFE' } });
      if (files.length !== fileIds.length || files.some((file) => file.purpose !== 'speaking-answer' || !AUDIO_MIMES.includes(file.mimeType))) {
        throw badRequest('SPEAKING_AUDIO_INVALID', 'فایل صوتی پاسخ معتبر نیست.', 'The speaking response audio file is invalid.', {
          fileId: { fa: 'فایل باید MP3، WAV، M4A، OGG یا WebM، سالم و متعلق به همین کاربر باشد.', en: 'The file must be a safe MP3, WAV, M4A, OGG, or WebM owned by this user.' },
        });
      }
    }
    return this.db.$transaction(async (tx) => {
      for (const answer of answers) {
        const question = questionMap.get(answer.questionId)!;
        if (question.type === 'recording' && answer.fileId == null) continue;
        const values = { value: this.json(answer.value), textValue: answer.textValue, fileId: answer.fileId, flagged: answer.flagged };
        if (isRevision) {
          await tx.testAnswer.update({
            where: { attemptId_questionId: { attemptId: id, questionId: answer.questionId } },
            data: {
              ...values, reviewStatus: 'PENDING', finalScore: null, reviewCriteria: Prisma.DbNull,
              feedbackFa: null, feedbackEn: null, reviewerId: null, reviewedAt: null,
            },
          });
        } else {
          await tx.testAnswer.upsert({
            where: { attemptId_questionId: { attemptId: id, questionId: answer.questionId } },
            create: { attemptId: id, questionId: answer.questionId, ...values },
            update: values,
          });
        }
      }
      const savedAt = new Date();
      await tx.testAttempt.update({ where: { id }, data: { lastSavedAt: savedAt } });
      return { savedAt: savedAt.toISOString(), count: answers.length };
    });
  }

  async submitSection(userId: string, id: string, sectionId: string) {
    const attempt = await this.db.testAttempt.findFirst({
      where: { id, userId, status: 'IN_PROGRESS' },
      include: { test: { include: { sections: { orderBy: { order: 'asc' } } } }, answers: true, sectionStates: true },
    });
    if (!attempt || attempt.currentSectionId !== sectionId) throw badRequest('TEST_SECTION_NOT_ACTIVE', 'این بخش در حال حاضر فعال نیست.', 'This test section is not currently active.');
    const section = attempt.test.sections.find((row) => row.id === sectionId);
    if (!section) throw notFound('TEST_SECTION_NOT_FOUND', 'بخش آزمون پیدا نشد.', 'Test section was not found.');
    const questions = await this.db.question.findMany({ where: { sectionId } });
    const byQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const unanswered = questions.filter((question) => {
      const answer = byQuestion.get(question.id);
      if (!answer) return true;
      if (question.type === 'recording') return !answer.fileId;
      if (question.type === 'essay' || question.type === 'short_text') return !answer.textValue?.trim();
      return answer.value == null;
    });
    if (unanswered.length) throw badRequest('TEST_ANSWERS_INCOMPLETE', 'قبل از قفل‌کردن بخش به همه سؤال‌ها پاسخ دهید.', 'Answer every question before locking the section.', {
      answers: { fa: `${unanswered.length} سؤال بدون پاسخ باقی مانده است.`, en: `${unanswered.length} question(s) remain unanswered.` },
    });
    const next = attempt.test.sections.find((row) => row.order > section.order);
    await this.db.$transaction(async (tx) => {
      await tx.attemptSectionState.update({ where: { attemptId_sectionId: { attemptId: id, sectionId } }, data: { status: 'submitted', submittedAt: new Date(), remainingSeconds: 0 } });
      if (next) await tx.attemptSectionState.update({ where: { attemptId_sectionId: { attemptId: id, sectionId: next.id } }, data: { status: 'available', startedAt: new Date() } });
      await tx.testAttempt.update({ where: { id }, data: { currentSectionId: next?.id ?? sectionId } });
    });
    return { nextSectionId: next?.id ?? null, finished: !next };
  }

  async submit(userId: string, id: string) {
    const attempt = await this.db.testAttempt.findFirst({
      where: { id, userId },
      include: { answers: { include: { question: { include: { section: true } } } }, test: { include: { sections: true } }, sectionStates: true },
    });
    if (!attempt || attempt.status !== 'IN_PROGRESS') throw badRequest('TEST_ATTEMPT_NOT_SUBMITTABLE', 'این آزمون در وضعیت قابل ارسال نیست.', 'This attempt cannot be submitted in its current status.');
    if (attempt.sectionStates.some((state) => state.status !== 'submitted')) throw badRequest('TEST_SECTIONS_NOT_SUBMITTED', 'ابتدا همه بخش‌ها را ارسال و قفل کنید.', 'Submit and lock every section first.');
    const subjective = attempt.answers.filter((answer) => SUBJECTIVE_TYPES.has(answer.question.type));
    return this.db.$transaction(async (tx) => {
      for (const answer of attempt.answers) {
        if (OBJECTIVE_TYPES.has(answer.question.type)) {
          const correct = this.equalJson(answer.value, answer.question.answerKey);
          await tx.testAnswer.update({ where: { id: answer.id }, data: { autoScore: correct ? answer.question.points : 0, finalScore: correct ? answer.question.points : 0, reviewStatus: null } });
        } else {
          await tx.testAnswer.update({ where: { id: answer.id }, data: { reviewStatus: 'PENDING', finalScore: null, reviewerId: null, reviewedAt: null } });
        }
      }
      for (const section of attempt.test.sections) {
        const answers = attempt.answers.filter((answer) => answer.question.sectionId === section.id);
        if (!answers.length) continue;
        if (answers.every((answer) => OBJECTIVE_TYPES.has(answer.question.type))) {
          const correct = answers.filter((answer) => this.equalJson(answer.value, answer.question.answerKey)).length;
          const band = this.scoring.objective(correct, answers.length);
          await tx.testScore.upsert({ where: { attemptId_skill: { attemptId: id, skill: section.skill } }, create: { attemptId: id, skill: section.skill, autoBand: band, finalBand: band, approvedAt: new Date() }, update: { autoBand: band, finalBand: band, approvedAt: new Date() } });
        } else {
          const text = answers.map((answer) => answer.textValue ?? (answer.fileId ? `[audio:${answer.fileId}]` : '')).join('\n');
          const ai = await this.scoring.subjective(section.skill, text);
          await tx.testScore.upsert({ where: { attemptId_skill: { attemptId: id, skill: section.skill } }, create: { attemptId: id, skill: section.skill, aiBand: ai.band, criteria: ai.criteria, feedback: ai.feedback }, update: { aiBand: ai.band, criteria: ai.criteria, feedback: ai.feedback, finalBand: null, approvedAt: null } });
        }
      }
      const submittedAt = new Date();
      if (subjective.length) return tx.testAttempt.update({ where: { id }, data: { status: 'UNDER_REVIEW', submittedAt } });
      const scores = await tx.testScore.findMany({ where: { attemptId: id } });
      const bands = scores.flatMap((score) => score.finalBand == null ? [] : [score.finalBand]);
      const overallBand = bands.length ? this.roundBand(bands.reduce((sum, band) => sum + band, 0) / bands.length) : null;
      const completed = await tx.testAttempt.update({ where: { id }, data: { status: 'APPROVED', submittedAt, overallBand } });
      await this.resultNotification(tx, userId, id, overallBand);
      return completed;
    });
  }

  history(userId: string) {
    return this.db.testAttempt.findMany({
      where: { userId },
      include: { test: { select: { titleFa: true, titleEn: true, language: true, level: true } }, scores: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async claimAnswer(examinerId: string, answerId: string) {
    const answer = await this.db.testAnswer.findFirst({ where: { id: answerId, attempt: { status: 'UNDER_REVIEW' }, reviewStatus: { in: ['PENDING', 'IN_REVIEW'] } } });
    if (!answer) throw notFound('REVIEW_ANSWER_NOT_FOUND', 'پاسخ در صف بررسی پیدا نشد.', 'The answer was not found in the review queue.');
    if (answer.reviewStatus === 'IN_REVIEW' && answer.reviewerId && answer.reviewerId !== examinerId) throw conflict('ANSWER_ALREADY_CLAIMED', 'این پاسخ توسط ارزیاب دیگری در حال بررسی است.', 'Another examiner is already reviewing this answer.');
    return this.db.testAnswer.update({ where: { id: answerId }, data: { reviewStatus: 'IN_REVIEW', reviewerId: examinerId } });
  }

  async reviewAnswer(examinerId: string, data: { answerId: string; band: number; criteria: object; feedbackFa: string; feedbackEn: string; status: 'APPROVED' | 'NEEDS_REVISION' }) {
    if (!data.feedbackFa.trim() || !data.feedbackEn.trim()) throw badRequest('REVIEW_FEEDBACK_REQUIRED', 'بازخورد فارسی و انگلیسی هر دو الزامی هستند.', 'Both Persian and English feedback are required.');
    return this.db.$transaction(async (tx) => {
      const answer = await tx.testAnswer.findFirst({
        where: { id: data.answerId, attempt: { status: 'UNDER_REVIEW' } },
        include: { attempt: true, question: { include: { section: true } } },
      });
      if (!answer || !SUBJECTIVE_TYPES.has(answer.question.type)) throw notFound('REVIEW_ANSWER_NOT_FOUND', 'پاسخ تشریحی قابل بررسی پیدا نشد.', 'A reviewable subjective answer was not found.');
      if (answer.reviewStatus === 'IN_REVIEW' && answer.reviewerId && answer.reviewerId !== examinerId) throw conflict('ANSWER_ALREADY_CLAIMED', 'این پاسخ توسط ارزیاب دیگری در حال بررسی است.', 'Another examiner is already reviewing this answer.');
      const reviewedAt = new Date();
      await tx.examinerReview.create({
        data: {
          attemptId: answer.attemptId, answerId: answer.id, examinerId, skill: answer.question.section.skill,
          band: data.band, criteria: data.criteria, feedback: data.feedbackEn, feedbackFa: data.feedbackFa.trim(), feedbackEn: data.feedbackEn.trim(),
          status: data.status, approved: data.status === 'APPROVED', reviewedAt,
        },
      });
      await tx.testAnswer.update({
        where: { id: answer.id },
        data: {
          finalScore: data.band, reviewStatus: data.status, reviewCriteria: data.criteria,
          feedbackFa: data.feedbackFa.trim(), feedbackEn: data.feedbackEn.trim(), reviewerId: examinerId, reviewedAt,
        },
      });
      if (data.status === 'NEEDS_REVISION') {
        await tx.notification.create({
          data: {
            userId: answer.attempt.userId, type: 'TEST_ANSWER_NEEDS_REVISION',
            titleFa: 'پاسخ آزمون نیازمند اصلاح است', titleEn: 'Test answer needs revision',
            bodyFa: 'ارزیاب برای یکی از پاسخ‌های شما درخواست اصلاح ثبت کرده است.',
            bodyEn: 'An examiner requested a revision for one of your answers.',
            data: { attemptId: answer.attemptId, answerId: answer.id, href: `/test/session?attempt=${answer.attemptId}` },
          },
        });
        return { ok: true, finalized: false, status: 'NEEDS_REVISION' };
      }
      const pending = await tx.testAnswer.count({ where: { attemptId: answer.attemptId, question: { type: { in: [...SUBJECTIVE_TYPES] } }, reviewStatus: { not: 'APPROVED' } } });
      if (pending) return { ok: true, finalized: false, remaining: pending };
      const subjectiveAnswers = await tx.testAnswer.findMany({ where: { attemptId: answer.attemptId, question: { type: { in: [...SUBJECTIVE_TYPES] } } }, include: { question: { include: { section: true } } } });
      for (const skill of new Set(subjectiveAnswers.map((row) => row.question.section.skill))) {
        const rows = subjectiveAnswers.filter((row) => row.question.section.skill === skill && row.finalScore != null);
        const band = rows.length ? this.roundBand(rows.reduce((sum, row) => sum + (row.finalScore ?? 0), 0) / rows.length) : 0;
        await tx.testScore.upsert({ where: { attemptId_skill: { attemptId: answer.attemptId, skill } }, create: { attemptId: answer.attemptId, skill, finalBand: band, approvedById: examinerId, approvedAt: reviewedAt }, update: { finalBand: band, approvedById: examinerId, approvedAt: reviewedAt } });
      }
      const scores = await tx.testScore.findMany({ where: { attemptId: answer.attemptId } });
      const bands = scores.flatMap((score) => (score.finalBand ?? score.autoBand) == null ? [] : [score.finalBand ?? score.autoBand!]);
      const overallBand = bands.length ? this.roundBand(bands.reduce((sum, band) => sum + band, 0) / bands.length) : null;
      await tx.testAttempt.update({ where: { id: answer.attemptId }, data: { status: 'APPROVED', overallBand } });
      await this.resultNotification(tx, answer.attempt.userId, answer.attemptId, overallBand);
      return { ok: true, finalized: true, overallBand };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  reviewQueue(status: 'pending' | 'in_review' | 'reviewed' | 'needs_revision' = 'pending', page = 1, pageSize = 20) {
    const reviewStatus: AnswerReviewStatus | { in: AnswerReviewStatus[] } = status === 'pending' ? 'PENDING' : status === 'in_review' ? 'IN_REVIEW' : status === 'needs_revision' ? 'NEEDS_REVISION' : 'APPROVED';
    const where: Prisma.TestAnswerWhereInput = { attempt: { status: { in: ['UNDER_REVIEW', 'APPROVED'] } }, question: { type: { in: [...SUBJECTIVE_TYPES] } }, reviewStatus };
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize));
    const take = Math.min(100, Math.max(1, pageSize));
    return this.db.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.testAnswer.findMany({
          where,
          include: {
            file: true, reviewer: { select: { id: true, name: true } },
            question: { include: { section: true } },
            attempt: { include: { user: { select: { name: true, phone: true } }, test: { select: { titleFa: true, titleEn: true, language: true } } } },
          },
          orderBy: [{ reviewedAt: 'desc' }, { attempt: { submittedAt: 'asc' } }], skip, take,
        }),
        tx.testAnswer.count({ where }),
      ]);
      return { items, pagination: { page: Math.max(1, page), pageSize: take, total, pages: Math.ceil(total / take) } };
    });
  }

  private record(data: unknown) { if (!data || typeof data !== 'object' || Array.isArray(data)) throw badRequest('REQUEST_BODY_INVALID', 'بدنه درخواست باید یک شیء معتبر باشد.', 'Request body must be an object.'); return data as Record<string, unknown>; }
  private requiredString(value: unknown, label: string, max = 3000) { if (typeof value !== 'string' || !value.trim()) throw badRequest('FIELD_REQUIRED', `فیلد ${label} الزامی است.`, `${label} is required.`, { [label]: { fa: 'این فیلد را تکمیل کنید.', en: 'Complete this field.' } }); const out = value.trim(); if (out.length > max) throw badRequest('FIELD_TOO_LONG', `فیلد ${label} بیش از حد طولانی است.`, `${label} is too long.`); return out; }
  private positiveInt(value: unknown, label: string) { const out = Number(value); if (!Number.isInteger(out) || out < 1) throw badRequest('POSITIVE_INTEGER_REQUIRED', `${label} باید عدد صحیح مثبت باشد.`, `${label} must be a positive integer.`); return out; }
  private localized(value: unknown, label: string) { const row = this.record(value); return { fa: this.requiredString(row.fa, `${label}.fa`), en: this.requiredString(row.en, `${label}.en`) }; }

  private definitionData(input: unknown, partial = false) {
    const data = this.record(input), out: Record<string, unknown> = {};
    for (const key of ['slug', 'titleFa', 'titleEn', 'descriptionFa', 'descriptionEn'] as const) {
      if (data[key] !== undefined) out[key] = this.requiredString(data[key], key, key.startsWith('description') ? 4000 : 160);
      else if (!partial) throw badRequest('TEST_FIELD_REQUIRED', `فیلد ${key} الزامی است.`, `${key} is required.`);
    }
    if (data.languageId !== undefined) out.language = { connect: { id: this.requiredString(data.languageId, 'languageId', 100) } };
    else if (!partial) throw badRequest('TEST_LANGUAGE_REQUIRED', 'قبل از ساخت آزمون، زبان آموزشی را انتخاب کنید.', 'Select the educational language before creating the test.', { languageId: { fa: 'زبان آزمون الزامی است.', en: 'Test language is required.' } });
    if (data.level !== undefined) out.level = data.level ? this.requiredString(data.level, 'level', 40) : null;
    if (data.durationMinutes !== undefined) out.durationMinutes = this.positiveInt(data.durationMinutes, 'durationMinutes');
    else if (!partial) throw badRequest('TEST_DURATION_REQUIRED', 'مدت آزمون الزامی است.', 'Test duration is required.');
    if (data.published !== undefined) out.published = Boolean(data.published);
    return out;
  }

  private sectionData(input: unknown, partial = false) {
    const data = this.record(input), out: Record<string, unknown> = {};
    if (data.skill !== undefined) out.skill = this.requiredString(data.skill, 'skill', 40).toLowerCase(); else if (!partial) throw badRequest('TEST_SKILL_REQUIRED', 'مهارت یا نوع بخش را وارد کنید.', 'Enter the section skill or type.');
    if (data.title !== undefined) out.title = this.requiredString(data.title, 'title', 120); else if (!partial) throw badRequest('TEST_SECTION_TITLE_REQUIRED', 'عنوان بخش الزامی است.', 'Section title is required.');
    if (data.instructions !== undefined) out.instructions = this.localized(data.instructions, 'instructions'); else if (!partial) throw badRequest('TEST_INSTRUCTIONS_REQUIRED', 'راهنمای فارسی و انگلیسی بخش الزامی است.', 'Persian and English section instructions are required.');
    if (data.durationMinutes !== undefined) out.durationMinutes = this.positiveInt(data.durationMinutes, 'durationMinutes'); else if (!partial) throw badRequest('TEST_SECTION_DURATION_REQUIRED', 'مدت بخش الزامی است.', 'Section duration is required.');
    if (data.order !== undefined) out.order = this.positiveInt(data.order, 'order'); else if (!partial) throw badRequest('TEST_SECTION_ORDER_REQUIRED', 'ترتیب بخش الزامی است.', 'Section order is required.');
    if (data.lockAfterSubmit !== undefined) out.lockAfterSubmit = Boolean(data.lockAfterSubmit);
    return out;
  }

  private questionData(input: unknown, partial = false) {
    const data = this.record(input), out: Record<string, unknown> = {};
    if (data.prompt !== undefined) out.prompt = this.localized(data.prompt, 'prompt'); else if (!partial) throw badRequest('QUESTION_PROMPT_REQUIRED', 'متن فارسی و انگلیسی سؤال الزامی است.', 'Persian and English question prompts are required.');
    let type: string | undefined;
    if (data.type !== undefined) { type = this.requiredString(data.type, 'type', 40); if (![...OBJECTIVE_TYPES, ...SUBJECTIVE_TYPES].includes(type)) throw badRequest('QUESTION_TYPE_INVALID', 'نوع سؤال معتبر نیست.', 'Question type is invalid.'); out.type = type; }
    else if (!partial) throw badRequest('QUESTION_TYPE_REQUIRED', 'نوع سؤال را انتخاب کنید.', 'Select a question type.');
    let choices: { fa: string[]; en: string[] } | undefined;
    if (data.choices !== undefined) { if (data.choices === null) out.choices = Prisma.JsonNull; else { choices = this.localizedChoices(data.choices); out.choices = choices; } }
    if (type === 'true_false' && !choices) { choices = { fa: ['درست', 'نادرست'], en: ['True', 'False'] }; out.choices = choices; }
    if (type && ['single_choice', 'multiple_choice'].includes(type) && !choices) throw badRequest('QUESTION_CHOICES_REQUIRED', 'برای سؤال گزینه‌ای، گزینه‌های فارسی و انگلیسی را به‌صورت بصری اضافه کنید.', 'Add Persian and English options for an objective question.');
    if (data.answerKey !== undefined) out.answerKey = data.answerKey === null ? Prisma.JsonNull : this.json(data.answerKey);
    else if (type && OBJECTIVE_TYPES.has(type) && !partial) throw badRequest('QUESTION_ANSWER_KEY_REQUIRED', 'پاسخ صحیح را از میان گزینه‌ها انتخاب کنید.', 'Select the correct answer from the options.');
    if (type && choices && data.answerKey !== undefined) { const keys = Array.isArray(data.answerKey) ? data.answerKey : [data.answerKey]; if (!keys.length || keys.some((key) => !Number.isInteger(key) || Number(key) < 0 || Number(key) >= choices!.fa.length)) throw badRequest('QUESTION_ANSWER_KEY_INVALID', 'پاسخ صحیح باید یکی از گزینه‌های ساخته‌شده باشد.', 'The correct answer must be one of the created options.'); }
    if (data.scoringRule !== undefined) out.scoringRule = data.scoringRule === null ? Prisma.JsonNull : this.record(data.scoringRule);
    if (data.passageId !== undefined) out.passageId = data.passageId || null;
    if (data.audioFileId !== undefined) out.audioFileId = data.audioFileId || null;
    if (data.points !== undefined) { const points = Number(data.points); if (!Number.isFinite(points) || points <= 0) throw badRequest('QUESTION_POINTS_INVALID', 'امتیاز سؤال باید عددی بیشتر از صفر باشد.', 'Question points must be greater than zero.'); out.points = points; }
    if (data.order !== undefined) out.order = this.positiveInt(data.order, 'order'); else if (!partial) throw badRequest('QUESTION_ORDER_REQUIRED', 'ترتیب سؤال الزامی است.', 'Question order is required.');
    return out;
  }

  private localizedChoices(value: unknown) { const data = this.record(value); if (!Array.isArray(data.fa) || !Array.isArray(data.en) || data.fa.length !== data.en.length || !data.fa.length) throw badRequest('QUESTION_CHOICES_INVALID', 'تعداد گزینه‌های فارسی و انگلیسی باید برابر و بیشتر از صفر باشد.', 'Persian and English choices must have the same non-zero length.'); return { fa: data.fa.map((value, index) => this.requiredString(value, `choices.fa.${index}`, 500)), en: data.en.map((value, index) => this.requiredString(value, `choices.en.${index}`, 500)) }; }

  async createDefinition(data: unknown) { await this.ensureLanguage(this.record(data).languageId); return this.db.testDefinition.create({ data: this.definitionData(data) as Prisma.TestDefinitionCreateInput, include: { language: true } }); }
  async createSimpleDefinition(input: unknown) {
    const data = this.record(input); await this.ensureLanguage(data.languageId);
    const titleFa = this.requiredString(data.titleFa, 'titleFa', 160), titleEn = this.requiredString(data.titleEn, 'titleEn', 160), durationMinutes = data.durationMinutes === undefined ? 164 : this.positiveInt(data.durationMinutes, 'durationMinutes');
    const base = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'placement-test', slug = `${base}-${Date.now().toString(36)}`;
    const languageId = this.requiredString(data.languageId, 'languageId', 100);
    const sections = [
      { skill: 'listening', title: 'Listening', instructions: { fa: 'به فایل صوتی گوش کنید و به سؤال‌ها پاسخ دهید.', en: 'Listen to the audio and answer the questions.' }, durationMinutes: 30, order: 1 },
      { skill: 'reading', title: 'Reading', instructions: { fa: 'متن را بخوانید و به سؤال‌ها پاسخ دهید.', en: 'Read the text and answer the questions.' }, durationMinutes: 60, order: 2 },
      { skill: 'writing', title: 'Writing', instructions: { fa: 'پاسخ خود را بنویسید.', en: 'Write your answer.' }, durationMinutes: 60, order: 3 },
      { skill: 'speaking', title: 'Speaking', instructions: { fa: 'پاسخ خود را ضبط کنید.', en: 'Record your answer.' }, durationMinutes: 14, order: 4 },
    ];
    return this.db.testDefinition.create({ data: { slug, languageId, level: data.level ? String(data.level) : null, titleFa, titleEn, descriptionFa: 'آزمون تعیین سطح چهار مهارت', descriptionEn: 'Four-skill placement assessment', durationMinutes, published: false, sections: { create: sections } }, include: { sections: true, language: true } });
  }
  adminList() { return this.db.testDefinition.findMany({ include: { language: true, sections: { include: { passages: { include: { audioFile: true } }, questions: { include: { audioFile: true } } }, orderBy: { order: 'asc' } } }, orderBy: { updatedAt: 'desc' } }); }
  async updateDefinition(id: string, data: unknown) {
    const raw = this.record(data); if (raw.languageId !== undefined) await this.ensureLanguage(raw.languageId);
    const update = this.definitionData(data, true);
    if (update.published === true) {
      const test = await this.db.testDefinition.findUnique({ where: { id }, include: { sections: { include: { questions: true } } } });
      if (!test) throw notFound('TEST_NOT_FOUND', 'آزمون پیدا نشد.', 'Test was not found.');
      if (!test.sections.length || test.sections.some((section) => !section.questions.length)) throw badRequest('TEST_PUBLISH_QUESTIONS_REQUIRED', 'آزمون قبل از انتشار باید حداقل یک سؤال معتبر در هر بخش داشته باشد.', 'Before publishing, every section must contain at least one valid question.', { published: { fa: 'برای بخش‌های خالی سؤال اضافه کنید و دوباره انتشار را بزنید.', en: 'Add a question to every empty section and publish again.' } });
      const invalid = test.sections.flatMap((section) => section.questions).some((question) => !question.prompt || (OBJECTIVE_TYPES.has(question.type) && question.answerKey == null));
      if (invalid) throw badRequest('TEST_PUBLISH_INVALID_QUESTION', 'حداقل یک سؤال متن یا پاسخ صحیح معتبر ندارد.', 'At least one question is missing a valid prompt or correct answer.');
    }
    return this.db.testDefinition.update({ where: { id }, data: update, include: { language: true } });
  }
  async deleteDefinition(id: string) { const attempts = await this.db.testAttempt.count({ where: { testId: id } }); if (attempts) throw conflict('TEST_HAS_ATTEMPTS', 'آزمونی که پاسخ ثبت‌شده دارد قابل حذف نیست؛ آن را از انتشار خارج کنید.', 'A test with attempts cannot be deleted; unpublish it instead.'); await this.db.testDefinition.delete({ where: { id } }); return { ok: true }; }
  addSection(testId: string, data: unknown) { return this.db.testSection.create({ data: { ...this.sectionData(data), testId } as Prisma.TestSectionUncheckedCreateInput }); }
  updateSection(id: string, data: unknown) { return this.db.testSection.update({ where: { id }, data: this.sectionData(data, true) }); }
  async deleteSection(id: string) { const answers = await this.db.testAnswer.count({ where: { question: { sectionId: id } } }); if (answers) throw conflict('TEST_SECTION_HAS_ANSWERS', 'بخشی که پاسخ ثبت‌شده دارد قابل حذف نیست.', 'A section with submitted answers cannot be deleted.'); await this.db.testSection.delete({ where: { id } }); return { ok: true }; }
  async addQuestion(sectionId: string, data: unknown) { await this.validateQuestionRelations(sectionId, this.record(data)); return this.db.question.create({ data: { ...this.questionData(data), sectionId } as Prisma.QuestionUncheckedCreateInput }); }
  async updateQuestion(id: string, data: unknown) { const question = await this.db.question.findUnique({ where: { id } }); if (!question) throw notFound('QUESTION_NOT_FOUND', 'سؤال پیدا نشد.', 'Question was not found.'); await this.validateQuestionRelations(question.sectionId, this.record(data)); return this.db.question.update({ where: { id }, data: this.questionData(data, true) }); }
  async deleteQuestion(id: string) { const answers = await this.db.testAnswer.count({ where: { questionId: id } }); if (answers) throw conflict('QUESTION_HAS_ANSWERS', 'سؤالی که پاسخ ثبت‌شده دارد قابل حذف نیست.', 'A question with submitted answers cannot be deleted.'); await this.db.question.delete({ where: { id } }); return { ok: true }; }
  async reorderQuestions(sectionId: string, questionIds: string[]) {
    const rows = await this.db.question.findMany({ where: { sectionId }, select: { id: true } });
    if (rows.length !== questionIds.length || new Set(questionIds).size !== rows.length || rows.some((row) => !questionIds.includes(row.id))) throw badRequest('QUESTION_REORDER_INVALID', 'فهرست ترتیب سؤال‌ها کامل یا معتبر نیست.', 'The question reorder list is incomplete or invalid.');
    return this.db.$transaction(async (tx) => { for (let index = 0; index < questionIds.length; index += 1) await tx.question.update({ where: { id: questionIds[index] }, data: { order: -(index + 1) } }); for (let index = 0; index < questionIds.length; index += 1) await tx.question.update({ where: { id: questionIds[index] }, data: { order: index + 1 } }); return tx.question.findMany({ where: { sectionId }, orderBy: { order: 'asc' } }); });
  }
  async addPassage(sectionId: string, data: unknown) { const raw = this.record(data); await this.validateAudio(raw.audioFileId); return this.db.passage.create({ data: { sectionId, title: this.requiredString(raw.title, 'title', 200), content: this.localized(raw.content, 'content'), order: this.positiveInt(raw.order, 'order'), audioFileId: raw.audioFileId ? String(raw.audioFileId) : null } }); }
  async updatePassage(id: string, data: unknown) { const raw = this.record(data); if (raw.audioFileId !== undefined) await this.validateAudio(raw.audioFileId); const update: Prisma.PassageUpdateInput = {}; if (raw.title !== undefined) update.title = this.requiredString(raw.title, 'title', 200); if (raw.content !== undefined) update.content = this.localized(raw.content, 'content'); if (raw.order !== undefined) update.order = this.positiveInt(raw.order, 'order'); if (raw.audioFileId !== undefined) update.audioFile = raw.audioFileId ? { connect: { id: String(raw.audioFileId) } } : { disconnect: true }; return this.db.passage.update({ where: { id }, data: update }); }
  async deletePassage(id: string) { const linked = await this.db.question.count({ where: { passageId: id } }); if (linked) throw conflict('PASSAGE_HAS_QUESTIONS', 'ابتدا اتصال سؤال‌ها به این متن را حذف کنید.', 'Disconnect questions from this passage before deleting it.'); await this.db.passage.delete({ where: { id } }); return { ok: true }; }
  async importQuestions(sectionId: string, rows: unknown[]) { if (!Array.isArray(rows) || !rows.length) throw badRequest('QUESTION_IMPORT_EMPTY', 'فایل ورود سؤال خالی است.', 'Question import is empty.'); await this.db.testSection.findUniqueOrThrow({ where: { id: sectionId } }); const parsed = rows.map((row) => this.questionData(row) as unknown as Prisma.QuestionUncheckedCreateWithoutSectionInput); const orders = parsed.map((row) => row.order); if (new Set(orders).size !== orders.length) throw badRequest('QUESTION_IMPORT_DUPLICATE_ORDER', 'ترتیب سؤال‌ها در فایل تکراری است.', 'Question order values are duplicated in the import.'); const existing = await this.db.question.count({ where: { sectionId, order: { in: orders } } }); if (existing) throw conflict('QUESTION_IMPORT_ORDER_EXISTS', 'یک یا چند شماره ترتیب از قبل در این بخش وجود دارد.', 'One or more order values already exist in this section.'); return this.db.$transaction(async (tx) => { const questions = []; for (const row of parsed) questions.push(await tx.question.create({ data: { ...row, sectionId } })); return { created: questions.length, skipped: 0, failed: 0, questions }; }); }

  private async ensureLanguage(languageId: unknown) { const id = this.requiredString(languageId, 'languageId', 100); const language = await this.db.language.findFirst({ where: { id, active: true } }); if (!language) throw badRequest('TEST_LANGUAGE_INVALID', 'زبان آموزشی انتخاب‌شده فعال یا معتبر نیست.', 'The selected educational language is invalid or inactive.'); }
  private async validateAudio(fileId: unknown) { if (!fileId) return; const file = await this.db.storedFile.findFirst({ where: { id: String(fileId), status: 'SAFE', mimeType: { in: AUDIO_MIMES }, size: { lte: 50 * 1024 * 1024 } } }); if (!file) throw badRequest('TEST_AUDIO_INVALID', 'فایل صوتی باید MP3، WAV، M4A، OGG یا WebM و کمتر از حجم مجاز باشد.', 'Audio must be MP3, WAV, M4A, OGG, or WebM and below the size limit.'); }
  private async validateQuestionRelations(sectionId: string, data: Record<string, unknown>) { if (data.passageId) { const passage = await this.db.passage.count({ where: { id: String(data.passageId), sectionId } }); if (!passage) throw badRequest('QUESTION_PASSAGE_INVALID', 'متن Reading انتخاب‌شده متعلق به این بخش نیست.', 'The selected reading passage does not belong to this section.'); } if (data.audioFileId) await this.validateAudio(data.audioFileId); }
  private async resultNotification(tx: Prisma.TransactionClient, userId: string, attemptId: string, overallBand: number | null) { await tx.notification.create({ data: { userId, type: 'TEST_RESULT_READY', titleFa: 'نتیجه آزمون آماده است', titleEn: 'Your test result is ready', bodyFa: overallBand == null ? 'بررسی آزمون شما تکمیل شد.' : `بررسی آزمون شما تکمیل شد. نمره نهایی: ${overallBand}`, bodyEn: overallBand == null ? 'Your test review is complete.' : `Your test review is complete. Final score: ${overallBand}`, data: { attemptId, overallBand, href: `/dashboard/tests/${attemptId}` } } }); }
  private json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined { return value === undefined ? undefined : value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue; }
  private equalJson(a: unknown, b: unknown) { const normalize = (value: unknown): unknown => Array.isArray(value) ? [...value].sort() : value; return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }
  private roundBand(value: number) { return Math.round(value * 2) / 2; }
}
