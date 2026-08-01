import { TestsService } from './tests.service';

describe('TestsService.resume (SEC-002)', () => {
  it('never asks Prisma for Question.answerKey or Question.scoringRule', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const db = { testAttempt: { findFirst } };
    const svc = new TestsService(db as never, {} as never);

    await svc.resume('user-1', 'attempt-1');

    expect(findFirst).toHaveBeenCalledTimes(1);
    const args = findFirst.mock.calls[0][0];
    const questionsClause = args.include.test.include.sections.include.questions;

    // The grading-answer-key fields must never appear anywhere in this
    // relation's query shape -- neither via a blanket `include` (which would
    // pull every scalar column) nor explicitly selected.
    expect(questionsClause.include).toBeUndefined();
    expect(questionsClause.select).toBeDefined();
    expect(questionsClause.select.answerKey).toBeUndefined();
    expect(questionsClause.select.scoringRule).toBeUndefined();

    // Fields the student-facing UI legitimately needs must still be present.
    expect(questionsClause.select).toMatchObject({
      id: true, prompt: true, type: true, choices: true, audioFile: true, points: true, order: true,
    });
  });
});
