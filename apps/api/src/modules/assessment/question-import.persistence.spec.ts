import { TestsService } from './tests.service';

describe('TestsService bulk question import', () => {
  it('persists a validated batch with one create statement and preserves order', async () => {
    const createManyAndReturn = jest.fn().mockResolvedValue([
      { id: 'q2', order: 2 },
      { id: 'q1', order: 1 },
    ]);
    const db = {
      testSection: { findUniqueOrThrow: jest.fn() },
      question: { count: jest.fn().mockResolvedValue(0), createManyAndReturn },
    };
    const service = new TestsService(db as never, {} as never);
    const rows = [
      { prompt: { fa: 'پرسش یک', en: 'Question one' }, type: 'short_text', points: 1, order: 1 },
      { prompt: { fa: 'پرسش دو', en: 'Question two' }, type: 'short_text', points: 1, order: 2 },
    ];

    const result = await service.importQuestions('section-1', rows);

    expect(createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(result.questions.map((question) => question.id)).toEqual(['q1', 'q2']);
  });

  it('rejects oversized imports before touching the database', async () => {
    const db = { testSection: { findUniqueOrThrow: jest.fn() }, question: { count: jest.fn() } };
    const service = new TestsService(db as never, {} as never);

    await expect(service.importQuestions('section-1', Array.from({ length: 501 }, () => ({})))).rejects.toMatchObject({
      response: { code: 'QUESTION_IMPORT_LIMIT_EXCEEDED' },
    });
    expect(db.testSection.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
