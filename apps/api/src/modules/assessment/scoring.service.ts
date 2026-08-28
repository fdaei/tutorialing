import { Injectable } from '@nestjs/common';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
@Injectable()
export class ScoringService {
  /** Weighted percentage thresholds are intentionally centralized and can be
   * moved to managed settings later without changing the submission flow. */
  cefr(score: number): CefrLevel {
    if (score >= 90) return 'C2';
    if (score >= 75) return 'C1';
    if (score >= 60) return 'B2';
    if (score >= 45) return 'B1';
    if (score >= 25) return 'A2';
    return 'A1';
  }
  objective(correct: number, total: number) {
    if (!total) return 0;
    const raw = (correct / total) * 40;
    if (raw >= 39) return 9;
    if (raw >= 37) return 8.5;
    if (raw >= 35) return 8;
    if (raw >= 32) return 7.5;
    if (raw >= 30) return 7;
    if (raw >= 26) return 6.5;
    if (raw >= 23) return 6;
    if (raw >= 18) return 5.5;
    return 5;
  }
  async subjective(skill: string, text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const band = Math.min(7, Math.max(4, Math.round((4 + words / 140) * 2) / 2));
    return {
      band,
      criteria: { taskAchievement: band, coherence: band, lexicalResource: Math.max(4, band - 0.5), grammar: band },
      feedback: `Development scoring adapter; ${skill} requires examiner approval.`,
    };
  }
}
