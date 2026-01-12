/**
 * Labyrinth Legends - Type Definitions
 */

export type GameMode = 'Practice' | 'Tournament';
export type TournamentStatus = 'Upcoming' | 'Active' | 'Ended';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
export type Division = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Champion';

export interface Player {
  walletAddress: string;
  username: string;
  discordTag?: string;
  totalXp: number;
  practiceRuns: number;
  tournamentRuns: number;
  bestPracticeTimeMs?: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  registeredAt: Date;
  lastActive: Date;
  // Progression tracking
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate?: string;
  perfectRuns: number;
  totalDeaths: number;
  totalCoinsCollected: number;
  totalGemsCollected: number;
  // Ranked
  elo: number;
  division: Division;
  seasonXp: number;
  // Achievements
  achievementIds: string[];
}

export interface Tournament {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  mazeSeed: string;
  startTime: Date;
  endTime: Date;
  maxAttemptsPerPlayer?: number;
  xpRewardPool: number;
  status: TournamentStatus;
  createdAt: Date;
  creatorWallet: string;
  participantCount: number;
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
  createdAt: Date;
  // Enhanced tracking
  stagesCompleted: number;
  totalStages: number;
  coinsCollected: number;
  gemsCollected: number;
  isPerfectRun: boolean;
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
  joinedAt: Date;
}

export interface TournamentReward {
  tournamentId: number;
  walletAddress: string;
  rank: number;
  xpAmount: number;
  claimed: boolean;
}

export interface DiscordPlayer {
  walletAddress: string;
  username: string;
  discordTag: string;
  totalXpEarned: number;
  lastActive: Date;
}

// API Request/Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RegisterPlayerRequest {
  walletAddress: string;
  username: string;
  discordTag?: string;
  signature?: string;
}

export interface RegisterPlayerResponse {
  player: Player;
}

export interface SubmitRunRequest {
  walletAddress: string;
  username: string;
  mode: GameMode;
  tournamentId?: number;
  difficulty: Difficulty;
  levelReached: number;
  timeMs: number;
  deaths: number;
  completed: boolean;
  mazeSeed?: string;
  signature?: string;
  stagesCompleted?: number;
  coinsCollected?: number;
  gemsCollected?: number;
}

export interface SubmitRunResponse {
  run: GameRun;
  xpEarned: number;
  xpBreakdown: XpBreakdown;
  newLevel?: number;
  achievementsUnlocked?: string[];
}

export interface CreateTournamentRequest {
  title: string;
  description: string;
  difficulty: Difficulty;
  mazeSeed: string;
  startTime: string;
  endTime: string;
  maxAttemptsPerPlayer?: number;
  xpRewardPool: number;
  creatorWallet: string;
  signature?: string;
}

export interface CreateTournamentResponse {
  tournament: Tournament;
}

export interface JoinTournamentRequest {
  walletAddress: string;
  username: string;
  signature?: string;
}

export interface JoinTournamentResponse {
  participant: TournamentParticipant;
  tournamentId?: number;
  walletAddress?: string;
  mazeSeed?: string;
}

export interface GetLeaderboardRequest {
  type: 'practice' | 'tournament';
  tournamentId?: number;
  limit?: number;
}

export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface GetPlayerRequest {
  walletAddress: string;
}

export interface GetPlayerResponse {
  player: Player | null;
}

export interface GetTournamentRequest {
  tournamentId: number;
}

export interface GetTournamentResponse {
  tournament: Tournament | null;
  leaderboard?: LeaderboardEntry[];
}

export interface ClaimRewardRequest {
  walletAddress: string;
  tournamentId: number;
  signature?: string;
}

export interface ClaimRewardResponse {
  reward: TournamentReward;
}

export interface VerifySignatureRequest {
  message: string;
  signature: string;
  walletAddress: string;
}

export interface VerifySignatureResponse {
  valid: boolean;
}

// Socket.IO Events
export interface ServerToClientEvents {
  'run:submitted': (run: GameRun) => void;
  'runSubmitted': (data: { runId?: string; run?: GameRun; player?: Player; walletAddress?: string; username?: string; mode?: GameMode; timeMs?: number; xpEarned?: number }) => void;
  'leaderboard:updated': (data: { type: 'practice' | 'tournament'; tournamentId?: number; leaderboard: LeaderboardEntry[] }) => void;
  'leaderboardUpdate': (data: { type?: 'practice' | 'tournament'; tournamentId?: number; leaderboard: LeaderboardEntry[] }) => void;
  'tournament:updated': (tournament: Tournament) => void;
  'tournamentStatusChange': (data: { tournamentId: number; status: TournamentStatus }) => void;
  'tournamentCreated': (tournament: Tournament) => void;
  'tournamentJoined': (data: { tournamentId: number; walletAddress?: string; username?: string; participant?: TournamentParticipant }) => void;
  'player:joined': (data: { tournamentId: number; participant: TournamentParticipant }) => void;
  'playerRegistered': (data: { player: Player; walletAddress?: string; username?: string }) => void;
  'activityFeed': (data: unknown) => void;
}

export interface ClientToServerEvents {
  'subscribe:tournament': (tournamentId: number) => void;
  'unsubscribe:tournament': (tournamentId: number) => void;
  'subscribe:leaderboard': (type: 'practice' | 'tournament', tournamentId?: number) => void;
  'joinTournament': (tournamentId: number) => void;
  'leaveTournament': (tournamentId: number) => void;
  'identify': (walletAddress: string) => void;
  'requestActivity': () => void;
}
