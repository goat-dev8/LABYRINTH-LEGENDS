// Game Configuration - Professional Competitive Settings
// This file contains all game constants, XP formulas, and progression data

import type { Difficulty } from '../types';

// ═══════════════════════════════════════════════════════════════
// LEVEL & PROGRESSION SYSTEM
// ═══════════════════════════════════════════════════════════════

export const LEVEL_TITLES: Record<string, string> = {
  '1-5': 'Wanderer',
  '6-10': 'Pathfinder',
  '11-20': 'Maze Runner',
  '21-35': 'Labyrinth Master',
  '36-50': 'Champion',
  '51+': 'Legend',
};

export const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ['Easy mode'],
  6: ['Medium mode'],
  11: ['Hard mode'],
  21: ['Nightmare mode'],
  36: ['Elite tournaments'],
  51: ['Legendary skins'],
};

// XP required to reach each level (cumulative)
// Balanced formula: 100 + (level * 100) XP per level
// With ~75-300 XP per run, this means 2-4 runs for early levels
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Sum of (100 + n*100) for n=1 to level-1
  // = 100*(level-1) + 100*(1+2+...+(level-1))
  // = 100*(level-1) + 100*(level-1)*level/2
  // = 100*(level-1)*(1 + level/2)
  // = 50*(level-1)*(level+2)
  return 50 * (level - 1) * (level + 2);
}

export function getLevelFromXp(totalXp: number): number {
  // Reverse the formula to get level from XP
  let level = 1;
  while (getXpForLevel(level + 1) <= totalXp) {
    level++;
    if (level > 100) break; // Cap at level 100
  }
  return level;
}

export function getLevelProgress(totalXp: number): { level: number; currentXp: number; requiredXp: number; percentage: number } {
  const level = getLevelFromXp(totalXp);
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const currentXp = totalXp - currentLevelXp;
  const requiredXp = nextLevelXp - currentLevelXp;
  const percentage = Math.min(100, Math.floor((currentXp / requiredXp) * 100));
  
  return { level, currentXp, requiredXp, percentage };
}

export function getLevelTitle(level: number): string {
  if (level >= 51) return LEVEL_TITLES['51+'];
  if (level >= 36) return LEVEL_TITLES['36-50'];
  if (level >= 21) return LEVEL_TITLES['21-35'];
  if (level >= 11) return LEVEL_TITLES['11-20'];
  if (level >= 6) return LEVEL_TITLES['6-10'];
  return LEVEL_TITLES['1-5'];
}

// ═══════════════════════════════════════════════════════════════
// DIFFICULTY & STAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface StageConfig {
  mazeSize: number;
  ballSpeed: number;
  parTimeSeconds: number;
  coinCount: number;
  gemCount: number;
  hasSpikes: boolean;
  hasMovingWalls: boolean;
  hasDarkness: boolean;
}

export interface DifficultyConfig {
  name: Difficulty;
  baseXp: number;
  stageCount: number;
  stages: StageConfig[];
  minLevel: number;
  description: string;
}

// Base XP values MUST match contract (lib.rs Difficulty::base_xp)
// Easy=75, Medium=100, Hard=125, Nightmare=150
export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  Easy: {
    name: 'Easy',
    baseXp: 75,  // Matches contract: Easy => 75
    stageCount: 3,
    minLevel: 1,
    description: 'Perfect for beginners. Small mazes, no hazards.',
    stages: [
      { mazeSize: 5, ballSpeed: 12, parTimeSeconds: 30, coinCount: 5, gemCount: 0, hasSpikes: false, hasMovingWalls: false, hasDarkness: false },
      { mazeSize: 6, ballSpeed: 13, parTimeSeconds: 40, coinCount: 7, gemCount: 1, hasSpikes: false, hasMovingWalls: false, hasDarkness: false },
      { mazeSize: 7, ballSpeed: 14, parTimeSeconds: 50, coinCount: 10, gemCount: 1, hasSpikes: false, hasMovingWalls: false, hasDarkness: false },
    ],
  },
  Medium: {
    name: 'Medium',
    baseXp: 100,  // Matches contract: Medium => 100
    stageCount: 4,
    minLevel: 6,
    description: 'A fair challenge. Larger mazes with basic hazards.',
    stages: [
      { mazeSize: 8, ballSpeed: 16, parTimeSeconds: 45, coinCount: 8, gemCount: 1, hasSpikes: true, hasMovingWalls: false, hasDarkness: false },
      { mazeSize: 10, ballSpeed: 17, parTimeSeconds: 60, coinCount: 10, gemCount: 1, hasSpikes: true, hasMovingWalls: false, hasDarkness: false },
      { mazeSize: 12, ballSpeed: 18, parTimeSeconds: 75, coinCount: 12, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: false },
      { mazeSize: 14, ballSpeed: 19, parTimeSeconds: 90, coinCount: 15, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: false },
    ],
  },
  Hard: {
    name: 'Hard',
    baseXp: 125,  // Matches contract: Hard => 125
    stageCount: 5,
    minLevel: 11,
    description: 'For experienced players. Complex mazes with multiple hazards.',
    stages: [
      { mazeSize: 12, ballSpeed: 20, parTimeSeconds: 60, coinCount: 10, gemCount: 1, hasSpikes: true, hasMovingWalls: true, hasDarkness: false },
      { mazeSize: 14, ballSpeed: 21, parTimeSeconds: 75, coinCount: 12, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 16, ballSpeed: 22, parTimeSeconds: 90, coinCount: 14, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 18, ballSpeed: 23, parTimeSeconds: 105, coinCount: 16, gemCount: 3, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 20, ballSpeed: 24, parTimeSeconds: 120, coinCount: 18, gemCount: 3, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
    ],
  },
  Nightmare: {
    name: 'Nightmare',
    baseXp: 150,  // Matches contract: Nightmare => 150
    stageCount: 5,
    minLevel: 21,
    description: 'The ultimate test. Massive mazes with deadly hazards.',
    stages: [
      { mazeSize: 16, ballSpeed: 24, parTimeSeconds: 90, coinCount: 12, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 18, ballSpeed: 25, parTimeSeconds: 105, coinCount: 14, gemCount: 2, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 20, ballSpeed: 26, parTimeSeconds: 120, coinCount: 16, gemCount: 3, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 22, ballSpeed: 27, parTimeSeconds: 135, coinCount: 18, gemCount: 3, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
      { mazeSize: 25, ballSpeed: 28, parTimeSeconds: 150, coinCount: 20, gemCount: 4, hasSpikes: true, hasMovingWalls: true, hasDarkness: true },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// XP CALCULATION SYSTEM
// ═══════════════════════════════════════════════════════════════

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

export interface GameResult {
  difficulty: Difficulty;
  stagesCompleted: number;
  totalStages: number;
  timeMs: number;
  deaths: number;
  coinsCollected: number;
  gemsCollected: number;
  totalCoins: number;
  totalGems: number;
  isTournament: boolean;
  isDailyChallenge: boolean;
  isFirstClearToday: boolean;
  streakDays: number;
  playerLevel: number;
}

export function calculateXpBreakdown(result: GameResult): XpBreakdown {
  const config = DIFFICULTY_CONFIG[result.difficulty];
  const completed = result.stagesCompleted === result.totalStages;
  const timeSecs = result.timeMs / 1000;
  
  // Calculate total par time for completed stages
  const parTime = config.stages
    .slice(0, result.stagesCompleted)
    .reduce((sum, s) => sum + s.parTimeSeconds, 0);
  
  // Base XP (scaled by stages completed)
  const stageMultiplier = result.stagesCompleted / result.totalStages;
  const baseXp = Math.floor(config.baseXp * stageMultiplier);
  
  // Completion Bonus: +100% of base if all stages completed
  const completionBonus = completed ? config.baseXp : 0;
  
  // Speed Bonus: Up to +100% of base for beating par time
  let speedBonus = 0;
  if (completed && timeSecs < parTime) {
    const speedRatio = Math.min(1, (parTime - timeSecs) / parTime);
    speedBonus = Math.floor(config.baseXp * speedRatio);
  }
  
  // Perfect Run Bonus: +50% for 0 deaths
  const perfectBonus = result.deaths === 0 ? Math.floor(config.baseXp * 0.5) : 0;
  
  // Collectible Bonuses
  const coinBonus = result.coinsCollected * 10; // 10 XP per coin
  const gemBonus = result.gemsCollected * 50;   // 50 XP per gem
  
  // Streak Bonus: +5% per streak day, max +50%
  const streakPercent = Math.min(50, result.streakDays * 5);
  const streakBonus = Math.floor(config.baseXp * (streakPercent / 100));
  
  // First Clear of Day Bonus: +25%
  const firstClearBonus = result.isFirstClearToday ? Math.floor(config.baseXp * 0.25) : 0;
  
  // Death Penalty: -10% per death, max -50%
  const deathPenaltyPercent = Math.min(50, result.deaths * 10);
  const subtotal = baseXp + completionBonus + speedBonus + perfectBonus + coinBonus + gemBonus + streakBonus + firstClearBonus;
  const deathPenalty = Math.floor(subtotal * (deathPenaltyPercent / 100));
  
  // Multipliers
  const tournamentMultiplier = result.isTournament ? 1.5 : 1;
  const dailyChallengeMultiplier = result.isDailyChallenge ? 2.0 : 1;
  const levelMultiplier = 1 + (result.playerLevel * 0.01); // +1% per level
  
  // Calculate final XP
  const afterPenalty = subtotal - deathPenalty;
  const totalXp = Math.floor(afterPenalty * tournamentMultiplier * dailyChallengeMultiplier * levelMultiplier);
  
  return {
    baseXp,
    completionBonus,
    speedBonus,
    perfectBonus,
    coinBonus,
    gemBonus,
    streakBonus,
    firstClearBonus,
    deathPenalty,
    tournamentMultiplier,
    dailyChallengeMultiplier,
    levelMultiplier,
    totalXp: Math.max(0, totalXp),
  };
}

// Simple XP calculation (for backward compatibility)
export function calculateXp(
  difficulty: Difficulty,
  timeMs: number,
  deaths: number,
  completed: boolean,
  isTournament: boolean = false,
  playerLevel: number = 1
): number {
  const config = DIFFICULTY_CONFIG[difficulty];
  const result: GameResult = {
    difficulty,
    stagesCompleted: completed ? config.stageCount : 0,
    totalStages: config.stageCount,
    timeMs,
    deaths,
    coinsCollected: 0,
    gemsCollected: 0,
    totalCoins: 0,
    totalGems: 0,
    isTournament,
    isDailyChallenge: false,
    isFirstClearToday: false,
    streakDays: 0,
    playerLevel,
  };
  
  return calculateXpBreakdown(result).totalXp;
}

// ═══════════════════════════════════════════════════════════════
// DAILY CHALLENGES
// ═══════════════════════════════════════════════════════════════

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: ChallengeRequirement;
  xpReward: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface ChallengeRequirement {
  type: 'complete_time' | 'complete_deathless' | 'complete_count' | 'earn_xp' | 'collect_coins' | 'complete_difficulty';
  value: number;
  difficulty?: Difficulty;
}

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Complete any maze under 60 seconds',
    icon: '⚡',
    requirement: { type: 'complete_time', value: 60000 },
    xpReward: 500,
    difficulty: 'Medium',
  },
  {
    id: 'deathless',
    title: 'Untouchable',
    description: 'Complete a maze without dying',
    icon: '🛡️',
    requirement: { type: 'complete_deathless', value: 1 },
    xpReward: 400,
    difficulty: 'Easy',
  },
  {
    id: 'triple_threat',
    title: 'Triple Threat',
    description: 'Complete 3 mazes today',
    icon: '🎯',
    requirement: { type: 'complete_count', value: 3 },
    xpReward: 600,
    difficulty: 'Medium',
  },
  {
    id: 'xp_hunter',
    title: 'XP Hunter',
    description: 'Earn 1,000 XP today',
    icon: '⭐',
    requirement: { type: 'earn_xp', value: 1000 },
    xpReward: 300,
    difficulty: 'Easy',
  },
  {
    id: 'hard_worker',
    title: 'Hard Worker',
    description: 'Complete a Hard maze',
    icon: '💪',
    requirement: { type: 'complete_difficulty', value: 1, difficulty: 'Hard' },
    xpReward: 800,
    difficulty: 'Hard',
  },
  {
    id: 'coin_collector',
    title: 'Coin Collector',
    description: 'Collect 50 coins in a single day',
    icon: '🪙',
    requirement: { type: 'collect_coins', value: 50 },
    xpReward: 400,
    difficulty: 'Medium',
  },
];

// Get today's challenges (3 random, weighted by time)
export function getTodaysChallenges(): DailyChallenge[] {
  const today = new Date().toISOString().split('T')[0];
  const seed = hashCode(today);
  const shuffled = [...DAILY_CHALLENGES].sort(() => seededRandom(seed) - 0.5);
  return shuffled.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════

export type AchievementTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  xpReward: number;
  requirement: {
    type: string;
    value: number;
  };
  category: 'gameplay' | 'progression' | 'competition' | 'dedication';
}

export const ACHIEVEMENTS: Achievement[] = [
  // Gameplay
  { id: 'first_steps', title: 'First Steps', description: 'Complete your first maze', icon: '👣', tier: 'Bronze', xpReward: 100, requirement: { type: 'total_completions', value: 1 }, category: 'gameplay' },
  { id: 'speed_runner', title: 'Speed Runner', description: 'Complete Easy in under 30 seconds', icon: '🏃', tier: 'Silver', xpReward: 500, requirement: { type: 'easy_under_30s', value: 1 }, category: 'gameplay' },
  { id: 'untouchable', title: 'Untouchable', description: 'Complete Hard without dying', icon: '🛡️', tier: 'Gold', xpReward: 2000, requirement: { type: 'hard_deathless', value: 1 }, category: 'gameplay' },
  { id: 'nightmare_conqueror', title: 'Nightmare Conqueror', description: 'Complete Nightmare mode', icon: '😈', tier: 'Gold', xpReward: 2000, requirement: { type: 'nightmare_complete', value: 1 }, category: 'gameplay' },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Achieve 100 perfect runs (0 deaths)', icon: '💎', tier: 'Platinum', xpReward: 10000, requirement: { type: 'perfect_runs', value: 100 }, category: 'gameplay' },
  
  // Progression
  { id: 'level_10', title: 'Pathfinder', description: 'Reach level 10', icon: '📈', tier: 'Bronze', xpReward: 100, requirement: { type: 'level', value: 10 }, category: 'progression' },
  { id: 'level_25', title: 'Maze Runner', description: 'Reach level 25', icon: '🏅', tier: 'Silver', xpReward: 500, requirement: { type: 'level', value: 25 }, category: 'progression' },
  { id: 'level_50', title: 'Champion', description: 'Reach level 50', icon: '👑', tier: 'Gold', xpReward: 2000, requirement: { type: 'level', value: 50 }, category: 'progression' },
  { id: 'xp_millionaire', title: 'XP Millionaire', description: 'Earn 1,000,000 total XP', icon: '💰', tier: 'Platinum', xpReward: 10000, requirement: { type: 'total_xp', value: 1000000 }, category: 'progression' },
  
  // Competition
  { id: 'first_blood', title: 'First Blood', description: 'Win your first tournament', icon: '🏆', tier: 'Silver', xpReward: 500, requirement: { type: 'tournament_wins', value: 1 }, category: 'competition' },
  { id: 'tournament_veteran', title: 'Tournament Veteran', description: 'Participate in 50 tournaments', icon: '⚔️', tier: 'Gold', xpReward: 2000, requirement: { type: 'tournaments_played', value: 50 }, category: 'competition' },
  { id: 'leaderboard_star', title: 'Leaderboard Star', description: 'Reach top 10 on the leaderboard', icon: '⭐', tier: 'Gold', xpReward: 2000, requirement: { type: 'leaderboard_rank', value: 10 }, category: 'competition' },
  
  // Dedication
  { id: 'week_warrior', title: 'Week Warrior', description: '7-day login streak', icon: '📅', tier: 'Bronze', xpReward: 100, requirement: { type: 'streak_days', value: 7 }, category: 'dedication' },
  { id: 'month_master', title: 'Month Master', description: '30-day login streak', icon: '🗓️', tier: 'Silver', xpReward: 500, requirement: { type: 'streak_days', value: 30 }, category: 'dedication' },
  { id: 'collector', title: 'Collector', description: 'Collect all coins in a single run', icon: '🪙', tier: 'Silver', xpReward: 500, requirement: { type: 'all_coins_run', value: 1 }, category: 'dedication' },
];

export const ACHIEVEMENT_TIER_COLORS: Record<AchievementTier, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#E5E4E2',
};

// ═══════════════════════════════════════════════════════════════
// RANKED SEASONS
// ═══════════════════════════════════════════════════════════════

export type Division = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Champion';

export interface DivisionConfig {
  name: Division;
  minElo: number;
  maxElo: number;
  icon: string;
  color: string;
  seasonReward: number;
}

export const DIVISIONS: DivisionConfig[] = [
  { name: 'Bronze', minElo: 0, maxElo: 499, icon: '🥉', color: '#CD7F32', seasonReward: 500 },
  { name: 'Silver', minElo: 500, maxElo: 999, icon: '🥈', color: '#C0C0C0', seasonReward: 2000 },
  { name: 'Gold', minElo: 1000, maxElo: 1499, icon: '🥇', color: '#FFD700', seasonReward: 5000 },
  { name: 'Platinum', minElo: 1500, maxElo: 1999, icon: '💎', color: '#E5E4E2', seasonReward: 10000 },
  { name: 'Diamond', minElo: 2000, maxElo: 2499, icon: '💠', color: '#B9F2FF', seasonReward: 25000 },
  { name: 'Champion', minElo: 2500, maxElo: Infinity, icon: '👑', color: '#FF6B6B', seasonReward: 50000 },
];

export function getDivisionFromElo(elo: number): DivisionConfig {
  return DIVISIONS.find(d => elo >= d.minElo && elo <= d.maxElo) || DIVISIONS[0];
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Format time for display
export function formatTimeDisplay(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
}

// Format XP for display
export function formatXpDisplay(xp: number): string {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
}
