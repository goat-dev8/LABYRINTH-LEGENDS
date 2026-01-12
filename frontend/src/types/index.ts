// API Types matching backend
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
export type GameMode = 'Practice' | 'Tournament';
export type TournamentStatus = 'Upcoming' | 'Active' | 'Ended';
export type Division = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Champion';

export interface Player {
  walletAddress: string;
  username: string;
  discordTag?: string;
  totalXp: number;
  practiceRuns: number;
  tournamentRuns: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  bestPracticeTimeMs?: number;
  registeredAt: string;
  lastActive: string;
  // New progression fields
  currentStreak?: number;
  longestStreak?: number;
  lastPlayedDate?: string;
  perfectRuns?: number;
  totalDeaths?: number;
  totalCoinsCollected?: number;
  totalGemsCollected?: number;
  // Ranked fields
  elo?: number;
  division?: Division;
  seasonXp?: number;
  // Achievements
  achievementIds?: string[];
}

export interface Tournament {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  mazeSeed: string;
  startTime: string;
  endTime: string;
  status: TournamentStatus;
  maxAttemptsPerPlayer?: number;
  xpRewardPool: number;
  creatorWallet: string;
  participantCount: number;
  createdAt: string;
}

export interface GameRun {
  id: string;
  walletAddress: string;
  username: string;
  mode: GameMode;
  tournamentId?: number;
  difficulty: Difficulty;
  levelReached: number;
  timeMs: number;
  deaths: number;
  completed: boolean;
  xpEarned: number;
  mazeSeed?: string;
  createdAt: string;
  // New tracking fields
  stagesCompleted?: number;
  totalStages?: number;
  coinsCollected?: number;
  gemsCollected?: number;
  isPerfectRun?: boolean;
  xpBreakdown?: XpBreakdown;
}

export interface XpBreakdown {
  baseXp: number;
  completionBonus: number;
  speedBonus: number;
  perfectBonus: number;
  coinBonus: number;
  gemBonus: number;
  streakBonus: number;
  firstClearBonus: number;
  deathPenalty: number;
  tournamentMultiplier: number;
  dailyChallengeMultiplier: number;
  levelMultiplier: number;
  totalXp: number;
}

export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  username: string;
  bestTimeMs: number;
  totalRuns: number;
  totalXp: number;
}

export interface TournamentParticipant {
  walletAddress: string;
  username: string;
  attemptsUsed: number;
  bestTimeMs?: number;
  bestRunId?: string;
  joinedAt: string;
}

export interface TournamentReward {
  tournamentId: number;
  walletAddress: string;
  rank: number;
  xpAmount: number;
  claimed: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Socket.IO Event types
export interface RunSubmittedEvent {
  runId: string;
  walletAddress: string;
  username: string;
  mode: GameMode;
  timeMs: number;
  xpEarned: number;
}

export interface LeaderboardUpdateEvent {
  tournamentId?: number;
  leaderboard: LeaderboardEntry[];
}

export interface TournamentStatusChangeEvent {
  tournamentId: number;
  status: TournamentStatus;
}

export interface PlayerRegisteredEvent {
  walletAddress: string;
  username: string;
}

export interface TournamentJoinedEvent {
  tournamentId: number;
  walletAddress: string;
  username: string;
}

// Challenge System
export interface DailyChallengeProgress {
  challengeId: string;
  currentValue: number;
  targetValue: number;
  completed: boolean;
  completedAt?: string;
}

export interface PlayerChallenges {
  walletAddress: string;
  date: string;
  challenges: DailyChallengeProgress[];
  totalXpEarned: number;
}

// Achievement System
export interface PlayerAchievement {
  achievementId: string;
  unlockedAt: string;
  xpRewarded: number;
}

// Season System
export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PlayerSeasonStats {
  seasonId: number;
  walletAddress: string;
  startElo: number;
  currentElo: number;
  peakElo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  seasonXp: number;
  division: Division;
}
