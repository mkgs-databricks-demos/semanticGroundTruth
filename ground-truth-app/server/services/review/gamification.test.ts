// server/services/review/gamification.test.ts
// Session 06 · Wave 2 · Vitest unit tests (pure, no DB)

import { describe, it, expect } from 'vitest';
import { nextStreak, BADGES, earnedBadges } from './gamification';

describe('nextStreak', () => {
  it('returns continue for first-ever vote', () => {
    expect(nextStreak(null, '2026-10-21')).toEqual({
      streakDelta: 'continue',
    });
  });

  it('returns same_day for same date', () => {
    expect(nextStreak('2026-10-21', '2026-10-21')).toEqual({
      streakDelta: 'same_day',
    });
  });

  it('returns continue for consecutive days', () => {
    expect(nextStreak('2026-10-20', '2026-10-21')).toEqual({
      streakDelta: 'continue',
    });
  });

  it('returns reset for gap of 2+ days', () => {
    expect(nextStreak('2026-10-19', '2026-10-21')).toEqual({
      streakDelta: 'reset',
    });
  });

  it('returns reset for large gap', () => {
    expect(nextStreak('2026-01-01', '2026-10-21')).toEqual({
      streakDelta: 'reset',
    });
  });
});

describe('BADGES', () => {
  it('has expected thresholds', () => {
    expect(BADGES.first_vote).toBe(1);
    expect(BADGES.ten_votes).toBe(10);
    expect(BADGES.fifty_votes).toBe(50);
    expect(BADGES.hundred_votes).toBe(100);
    expect(BADGES.streak_7).toBe(7);
    expect(BADGES.streak_30).toBe(30);
  });
});

describe('earnedBadges', () => {
  it('returns first_vote for a new user with 1 vote', () => {
    expect(earnedBadges(1, 1, [])).toEqual(['first_vote']);
  });

  it('returns multiple badges at once', () => {
    expect(earnedBadges(50, 7, [])).toEqual([
      'first_vote',
      'ten_votes',
      'fifty_votes',
      'streak_7',
    ]);
  });

  it('does not return already-earned badges', () => {
    expect(
      earnedBadges(50, 7, ['first_vote', 'ten_votes']),
    ).toEqual(['fifty_votes', 'streak_7']);
  });

  it('returns empty when no new badges earned', () => {
    expect(earnedBadges(5, 3, ['first_vote'])).toEqual([]);
  });

  it('returns streak_30 badge', () => {
    expect(
      earnedBadges(100, 30, [
        'first_vote',
        'ten_votes',
        'fifty_votes',
        'hundred_votes',
        'streak_7',
      ]),
    ).toEqual(['streak_30']);
  });
});
