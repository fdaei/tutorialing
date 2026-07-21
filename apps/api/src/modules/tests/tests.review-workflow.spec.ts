import { TestsService } from './tests.service';

describe('TestsService descriptive review workflow', () => {
  it('removes the final answer from pending and approves the attempt transactionally', async () => {
    const tx = {
      testAnswer: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'answer-1', attemptId: 'attempt-1', reviewStatus: 'IN_REVIEW', reviewerId: 'examiner-1',
          attempt: { id: 'attempt-1', userId: 'student-1' },
          question: { type: 'essay', section: { skill: 'writing' } },
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([{ finalScore: 7, question: { section: { skill: 'writing' } } }]),
      },
      examinerReview: { create: jest.fn() },
      testScore: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ finalBand: 7, autoBand: null }]),
      },
      testAttempt: { update: jest.fn().mockResolvedValue({ id: 'attempt-1', status: 'APPROVED' }) },
      notification: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new TestsService(db, {} as any);

    const result = await service.reviewAnswer('examiner-1', {
      answerId: 'answer-1', band: 7, criteria: { coherence: 7 }, feedbackFa: 'بازخورد فارسی', feedbackEn: 'English feedback', status: 'APPROVED',
    });

    expect(tx.testAnswer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'answer-1' }, data: expect.objectContaining({ reviewStatus: 'APPROVED', reviewerId: 'examiner-1', finalScore: 7 }),
    }));
    expect(tx.testAttempt.update).toHaveBeenCalledWith({ where: { id: 'attempt-1' }, data: { status: 'APPROVED', overallBand: 7 } });
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'student-1', type: 'TEST_RESULT_READY' }) }));
    expect(result).toEqual({ ok: true, finalized: true, overallBand: 7 });
  });

  it('keeps the attempt under review when another descriptive answer remains', async () => {
    const tx = {
      testAnswer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'answer-1', attemptId: 'attempt-1', reviewStatus: 'IN_REVIEW', reviewerId: 'examiner-1', attempt: { userId: 'student-1' }, question: { type: 'essay', section: { skill: 'writing' } } }),
        update: jest.fn(), count: jest.fn().mockResolvedValue(1),
      },
      examinerReview: { create: jest.fn() }, notification: { create: jest.fn() },
    };
    const service = new TestsService({ $transaction: jest.fn((callback) => callback(tx)) } as any, {} as any);
    await expect(service.reviewAnswer('examiner-1', { answerId: 'answer-1', band: 6.5, criteria: {}, feedbackFa: 'الف', feedbackEn: 'A', status: 'APPROVED' }))
      .resolves.toEqual({ ok: true, finalized: false, remaining: 1 });
  });
});

describe('TestsService revision resubmission', () => {
  it('returns only approved answers in the reviewed queue', async () => {
    const tx = {
      testAnswer: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const service = new TestsService({ $transaction: jest.fn((callback) => callback(tx)) } as any, {} as any);

    await service.reviewQueue('reviewed');

    expect(tx.testAnswer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ reviewStatus: 'APPROVED' }),
    }));
  });

  it('resubmits only a needs-revision answer and clears the previous review state', async () => {
    const tx = {
      testAnswer: { update: jest.fn() },
      testAttempt: { update: jest.fn() },
    };
    const db = {
      testAttempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1', testId: 'test-1', status: 'UNDER_REVIEW', expiresAt: new Date(0) }) },
      question: { findMany: jest.fn().mockResolvedValue([{ id: 'question-1', type: 'essay' }]) },
      testAnswer: { findMany: jest.fn().mockResolvedValue([{ questionId: 'question-1', reviewStatus: 'NEEDS_REVISION' }]) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new TestsService(db, {} as any);

    await service.save('student-1', 'attempt-1', [{ questionId: 'question-1', textValue: 'Revised answer', flagged: false }]);

    expect(tx.testAnswer.update).toHaveBeenCalledWith({
      where: { attemptId_questionId: { attemptId: 'attempt-1', questionId: 'question-1' } },
      data: expect.objectContaining({
        textValue: 'Revised answer', reviewStatus: 'PENDING', finalScore: null,
        feedbackFa: null, feedbackEn: null, reviewerId: null, reviewedAt: null,
      }),
    });
  });

  it('rejects editing an approved answer while the attempt is under review', async () => {
    const db = {
      testAttempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1', testId: 'test-1', status: 'UNDER_REVIEW', expiresAt: new Date(0) }) },
      question: { findMany: jest.fn().mockResolvedValue([{ id: 'question-1', type: 'essay' }]) },
      testAnswer: { findMany: jest.fn().mockResolvedValue([{ questionId: 'question-1', reviewStatus: 'APPROVED' }]) },
    } as any;
    const service = new TestsService(db, {} as any);

    await expect(service.save('student-1', 'attempt-1', [{ questionId: 'question-1', textValue: 'Changed answer', flagged: false }]))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'TEST_REVISION_NOT_ALLOWED' }) });
  });
});
