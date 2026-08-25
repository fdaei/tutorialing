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
      id: true,
      prompt: true,
      type: true,
      choices: true,
      audioFile: true,
      points: true,
      order: true,
    });
  });
});

describe('TestsService.resume ownership (SEC-210)', () => {
  const ATTEMPT = { id: 'attempt-1', userId: 'user-a', status: 'IN_PROGRESS' };

  /** Mirrors `resume()`'s real `where: {id, userId}` shape closely enough
   * that a different authenticated user genuinely gets no match. */
  function harness() {
    const findFirst = jest.fn().mockImplementation(({ where }: { where: { id: string; userId: string } }) =>
      Promise.resolve(where.id === ATTEMPT.id && where.userId === ATTEMPT.userId ? ATTEMPT : null),
    );
    const db = { testAttempt: { findFirst } };
    const svc = new TestsService(db as never, {} as never);
    return { svc, findFirst };
  }

  it('returns nothing to a different user requesting another user’s attempt', async () => {
    // `resume()` has no notFound()/requireValue() wrapper (unlike the
    // files/support/payments equivalents tested alongside this one) -- it
    // resolves the raw Prisma result, so a non-owner gets `null`/200 rather
    // than a thrown 404. Not a data leak either way: the assertion that
    // matters is that no attempt data crosses the ownership boundary. See
    // AUDIT/SEC-210-coverage-plan.md for why this is flagged as a
    // consistency follow-up rather than changed here.
    const { svc } = harness();
    await expect(svc.resume('user-b', ATTEMPT.id)).resolves.toBeFalsy();
  });

  it('still lets the owning user resume their own attempt', async () => {
    const { svc } = harness();
    await expect(svc.resume('user-a', ATTEMPT.id)).resolves.toMatchObject({ id: ATTEMPT.id });
  });
});
