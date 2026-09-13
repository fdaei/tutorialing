import { ScoringService } from './scoring.service';
describe('ScoringService', () => {
  it.each([[0, 'A1'], [25, 'A2'], [45, 'B1'], [60, 'B2'], [75, 'C1'], [90, 'C2']])(
    'maps weighted percentage %s to CEFR %s',
    (score, level) => expect(new ScoringService().cefr(score as number)).toBe(level),
  );
  const service = new ScoringService();
  it('maps objective raw scores to IELTS bands deterministically', () => {
    expect(service.objective(40, 40)).toBe(9);
    expect(service.objective(30, 40)).toBe(7);
    expect(service.objective(0, 40)).toBe(5);
  });
  it('marks subjective adapter output for examiner approval', async () => {
    const score = await service.subjective('writing', 'word '.repeat(260));
    expect(score.band).toBeGreaterThanOrEqual(4);
    expect(score.feedback).toContain('examiner approval');
  });
  it('uses the highest consecutively passed student-placement section', () => {
    expect(service.placementLevel({ A1: 6, A2: 5, B1: 4, B2: 3, C1: 6 })).toBe('B1');
    expect(service.placementLevel({ A1: 3, A2: 6, B1: 6, B2: 6, C1: 6 })).toBe('A1');
    expect(service.placementLevel({ A1: 6, A2: 6, B1: 6, B2: 6, C1: 4 })).toBe('C1');
  });
  it('flags a non-consecutive result that merits manual review', () => {
    expect(service.placementBorderline({ A1: 6, A2: 3, B1: 5, B2: 6, C1: 2 })).toBe(true);
    expect(service.placementBorderline({ A1: 6, A2: 3, B1: 4, B2: 6, C1: 2 })).toBe(false);
  });
});
