// server/services/review/gamification.ts — streak tracking and badge logic
// Session 06 · Wave 2 · No enum, no namespace, no default export

export interface StreakResult {
  streakDelta: 'same_day' | 'continue' | 'reset';
}

const MS_PER_DAY = 86_400_000;

/**
 * Determine how a vote today affects the user's streak.
 * Dates are UTC YYYY-MM-DD strings.
 */
export function nextStreak(
  lastVoteDate: string | null,
  today: string,
): StreakResult {
  if (!lastVoteDate) return { streakDelta: 'continue' };
  if (lastVoteDate === today) return { streakDelta: 'same_day' };

  const last = new Date(lastVoteDate + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  const diffDays = Math.round(
    (now.getTime() - last.getTime()) / MS_PER_DAY,
  );

  if (diffDays === 1) return { streakDelta: 'continue' };
  return { streakDelta: 'reset' };
}

export const BADGES = {
  first_vote: 1,
  ten_votes: 10,
  fifty_votes: 50,
  hundred_votes: 100,
  streak_7: 7,
  streak_30: 30,
} as const;

/**
 * Return the list of newly earned badges (not already in `existing`).
 */
export function earnedBadges(
  totalVotes: number,
  streakDays: number,
  existing: string[],
): string[] {
  const earned: string[] = [];
  const has = new Set(existing);

  if (totalVotes >= BADGES.first_vote && !has.has('first_vote')) {
    earned.push('first_vote');
  }
  if (totalVotes >= BADGES.ten_votes && !has.has('ten_votes')) {
    earned.push('ten_votes');
  }
  if (totalVotes >= BADGES.fifty_votes && !has.has('fifty_votes')) {
    earned.push('fifty_votes');
  }
  if (totalVotes >= BADGES.hundred_votes && !has.has('hundred_votes')) {
    earned.push('hundred_votes');
  }
  if (streakDays >= BADGES.streak_7 && !has.has('streak_7')) {
    earned.push('streak_7');
  }
  if (streakDays >= BADGES.streak_30 && !has.has('streak_30')) {
    earned.push('streak_30');
  }

  return earned;
}
