import { PlacementService } from './placement.service';
import { ScoringService } from './scoring.service';

describe('PlacementService immediate scoring', () => {
  const questions = [
    { id: 'easy', type: 'single_choice', answerKey: 0, points: 1 },
    { id: 'hard', type: 'single_choice', answerKey: 2, points: 3 },
  ];

  function harness() {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'result-1', completedAt: new Date(), ...data }));
    const db = {
      testDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'test-1', published: true, sections: [{ questions }] }) },
      placementResult: { create },
    };
    return { service: new PlacementService(db as never, new ScoringService()), create };
  }

  it('weights difficult questions and persists an authenticated result', async () => {
    const { service, create } = harness();
    const result = await service.submit('user-1', 'test-1', [
      { questionId: 'easy', value: 1 },
      { questionId: 'hard', value: 2 },
    ]);
    expect(result).toMatchObject({ score: 75, level: 'C1', correctAnswers: 1, totalQuestions: 2, authenticated: true });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-1', score: 75, level: 'C1' }) });
  });

  it('persists guest results without inventing a user', async () => {
    const { service, create } = harness();
    await service.submit(null, 'test-1', [
      { questionId: 'easy', value: 0 },
      { questionId: 'hard', value: 2 },
    ]);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: null, score: 100, level: 'C2' }) });
  });

  it('rejects incomplete answer sets instead of calculating a misleading result', async () => {
    const { service } = harness();
    await expect(service.submit(null, 'test-1', [{ questionId: 'easy', value: 0 }])).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLACEMENT_ANSWERS_INCOMPLETE' }),
    });
  });
});
