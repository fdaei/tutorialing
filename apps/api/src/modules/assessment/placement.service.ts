import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { badRequest, notFound } from '../../common';
import { ScoringService, type CefrLevel, type PlacementSectionScores } from './scoring.service';

const OBJECTIVE_TYPES = ['single_choice', 'multiple_choice', 'true_false'];

@Injectable()
export class PlacementService {
  constructor(private db: PrismaService, private scoring: ScoringService) {}

  async tests(languageId?: string) {
    const definitions = await this.db.testDefinition.findMany({
      where: {
        published: true,
        isPlacement: true,
        ...(languageId ? { languageId } : {}),
        sections: { some: { questions: { some: {} } } },
      },
      select: { id: true, slug: true, titleFa: true, titleEn: true, descriptionFa: true, descriptionEn: true, durationMinutes: true, language: { select: { id: true, code: true, nameFa: true, nameEn: true, nativeName: true, flag: true } }, sections: { select: { questions: { select: { type: true } } } } },
    });
    return definitions.filter((test) => test.sections.flatMap((section) => section.questions).every((question) => OBJECTIVE_TYPES.includes(question.type))).map(({ sections: _sections, ...test }) => test);
  }

  async questions(testId: string) {
    const test = await this.db.testDefinition.findFirst({
      where: { id: testId, published: true, isPlacement: true },
      select: { id: true, titleFa: true, titleEn: true, durationMinutes: true, sections: { orderBy: { order: 'asc' }, select: { id: true, skill: true, title: true, questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, type: true, choices: true, points: true, order: true } } } } },
    });
    if (!test) throw notFound('PLACEMENT_TEST_NOT_FOUND');
    const questions = test.sections.flatMap((section) => section.questions.map((question) => question));
    if (!questions.length || questions.some((question) => !OBJECTIVE_TYPES.includes(question.type))) throw badRequest('PLACEMENT_TEST_NOT_AUTOGRADABLE');
    return { ...test, sections: undefined, questions };
  }

  async submit(userId: string | null, testId: string, submitted: { questionId: string; value: unknown }[]) {
    const test = await this.db.testDefinition.findFirst({
      where: { id: testId, published: true, isPlacement: true },
      include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } },
    });
    if (!test) throw notFound('PLACEMENT_TEST_NOT_FOUND');
    const questions = test.sections.flatMap((section) => section.questions);
    if (!questions.length || questions.some((question) => !OBJECTIVE_TYPES.includes(question.type))) throw badRequest('PLACEMENT_TEST_NOT_AUTOGRADABLE');
    const answers = new Map(submitted.map((answer) => [answer.questionId, answer.value]));
    if (answers.size !== questions.length || questions.some((question) => !answers.has(question.id))) throw badRequest('PLACEMENT_ANSWERS_INCOMPLETE');
    const graded = questions.map((question) => ({
      question,
      correct: this.equal(answers.get(question.id), question.answerKey),
      weight: Math.max(0.1, question.points),
    }));
    const correctAnswers = graded.filter((answer) => answer.correct).length;
    const earned = graded.reduce((sum, answer) => sum + (answer.correct ? answer.weight : 0), 0);
    const possible = graded.reduce((sum, answer) => sum + answer.weight, 0);
    const score = Math.round((earned / possible) * 100);
    const sectionScores = this.sectionScores(test.sections, graded);
    const isStudentPlacement = sectionScores !== null;
    const level = isStudentPlacement ? this.scoring.placementLevel(sectionScores) : this.scoring.cefr(score);
    const borderline = isStudentPlacement ? this.scoring.placementBorderline(sectionScores) : false;
    const saved = await this.db.placementResult.create({
      data: {
        userId,
        testId,
        score,
        level,
        correctAnswers,
        totalQuestions: questions.length,
        ...(isStudentPlacement ? { sectionScores: sectionScores as Prisma.InputJsonValue, borderline } : {}),
      },
    });
    return { ...saved, ...this.profile(level), ...(isStudentPlacement ? { sectionScores, borderline } : {}), authenticated: Boolean(userId) };
  }

  history(userId: string) {
    return this.db.placementResult.findMany({ where: { userId }, include: { test: { select: { titleFa: true, titleEn: true, language: true } } }, orderBy: { completedAt: 'desc' } });
  }

  private equal(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
  private sectionScores(
    sections: Array<{ order: number; questions: Array<{ id: string }> }>,
    graded: Array<{ question: { id: string }; correct: boolean }>,
  ): PlacementSectionScores | null {
    if (sections.length !== 5 || sections.some((section) => section.questions.length !== 6)) return null;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
    return sections.reduce((scores, section, index) => {
      const questionIds = new Set(section.questions.map((question) => question.id));
      scores[levels[index]!] = graded.filter((answer) => questionIds.has(answer.question.id) && answer.correct).length;
      return scores;
    }, {} as PlacementSectionScores);
  }
  private profile(level: CefrLevel) {
    const profiles: Record<CefrLevel, { titleFa: string; titleEn: string; description: string; strengths: string[]; focus: string[] }> = {
      A1: { titleFa: 'مقدماتی', titleEn: 'Beginner', description: 'می‌توانید عبارت‌های بسیار ساده و آشنا را درک و استفاده کنید.', strengths: ['معرفی خود', 'پرسش‌های بسیار ساده'], focus: ['واژگان پایه', 'شنیدن جمله‌های کوتاه'] },
      A2: { titleFa: 'پایه', titleEn: 'Elementary', description: 'می‌توانید در موقعیت‌های روزمره ساده ارتباط برقرار کنید.', strengths: ['خرید و مسیر پرسیدن', 'گفت‌وگوهای کوتاه'], focus: ['روان‌گویی', 'زمان‌های پرکاربرد'] },
      B1: { titleFa: 'متوسط', titleEn: 'Intermediate', description: 'می‌توانید مکالمات روزمره را مدیریت و متون عمومی را درک کنید.', strengths: ['شرح تجربه‌ها', 'درک نکات اصلی'], focus: ['دایره واژگان', 'Listening و ساختارهای پیشرفته‌تر'] },
      B2: { titleFa: 'متوسط رو به بالا', titleEn: 'Upper intermediate', description: 'می‌توانید با روانی خوب تعامل کنید و متن‌های نسبتاً پیچیده را بفهمید.', strengths: ['بحث و استدلال', 'تعامل روان'], focus: ['دقت دستوری', 'واژگان تخصصی'] },
      C1: { titleFa: 'پیشرفته', titleEn: 'Advanced', description: 'می‌توانید زبان را منعطف و مؤثر در محیط تحصیلی و کاری به کار ببرید.', strengths: ['بیان دقیق', 'درک متن پیچیده'], focus: ['ظرافت‌های معنایی', 'سبک و لحن'] },
      C2: { titleFa: 'تسلط', titleEn: 'Proficient', description: 'تقریباً هر آنچه می‌خوانید یا می‌شنوید را با دقت درک می‌کنید.', strengths: ['بیان طبیعی و دقیق', 'درک کامل'], focus: ['حفظ مهارت', 'کاربردهای بسیار تخصصی'] },
    };
    return profiles[level];
  }
}
