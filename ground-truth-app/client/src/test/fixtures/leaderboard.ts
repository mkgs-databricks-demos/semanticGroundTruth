// client/src/test/fixtures/leaderboard.ts — 7-day leaderboard (brief §1.1 "Leaderboard")
// Session 43 · Build 5 · wave 5-0

import type { LeaderboardEntry } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { IDS } from './ids';

function entry(
  rank: number,
  userId: string,
  displayName: string,
  totalVotes: number,
  split: [approvals: number, rejections: number, edits: number],
  skippedCount: number,
  currentStreakDays: number,
): LeaderboardEntry {
  const [approvals, rejections, edits] = split;
  return { userId, email: userId, displayName, totalVotes, approvals, rejections, edits, skippedCount, currentStreakDays, rank };
}

/** Ranks 1-5; Priya Raman (the current user) is rank 3. */
export const leaderboard: LeaderboardEntry[] = [
  entry(1, IDS.users.jordan, 'Jordan Lee', 412, [301, 62, 49], 21, 14),
  entry(2, IDS.users.ana, 'Ana Duarte', 297, [210, 51, 36], 9, 9),
  entry(3, IDS.users.priya, 'Priya Raman', 186, [131, 29, 26], 14, 6),
  entry(4, IDS.users.sam, 'Sam Okafor', 140, [98, 25, 17], 30, 2),
  entry(5, IDS.users.wei, 'Wei Chen', 88, [70, 10, 8], 4, 1),
];

export const leaderboardRoutes = {
  'GET /api/leaderboard': leaderboard,
} satisfies MockHandlers;
