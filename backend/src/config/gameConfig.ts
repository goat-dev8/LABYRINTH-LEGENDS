/**
 * Labyrinth Legends - Game Configuration
 * Contains all game constants, XP formulas, and progression data
 */

import type { Difficulty, Division, XpBreakdown } from '../types.js';

// ═══════════════════════════════════════════════════════════════
// DIFFICULTY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface StageConfig {
  mazeSize: number;
  ballSpeed: number;
  parTimeSeconds: number;
  coinCount: number;
  gemCount: number;
}

export interface DifficultyConfig {
  name: Difficulty;
  baseXp: number;
  stageCount: number;
  stages: StageConfig[];
  minLevel: number;
}

// Base XP values MUST match contract (lib.rs Difficulty::base_xp)
// Easy=75, Medium=100, Hard=125, Nightmare=150
export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  Easy: {
    name: 'Easy',
    baseXp: 75,  // Matches contract
    stageCount: 3,
    minLevel: 1,
    stages: [
      { mazeSize: 5, ballSpeed: 12, parTimeSeconds: 30, coinCount: 5, gemCount: 0 },
      { mazeSize: 6, ballSpeed: 13, parTimeSeconds: 40, coinCount: 7, gemCount: 1 },
      { mazeSize: 7, ballSpeed: 14, parTimeSeconds: 50, coinCount: 10, gemCount: 1 },
    ],
  },
  Medium: {
    name: 'Medium',
    baseXp: 100,  // Matches contract
    stageCount: 4,
    minLevel: 6,
    stages: [
      { mazeSize: 8, ballSpeed: 16, parTimeSeconds: 45, coinCount: 8, gemCount: 1 },
      { mazeSize: 10, ballSpeed: 17, parTimeSeconds: 60, coinCount: 10, gemCount: 1 },
      { mazeSize: 12, ballSpeed: 18, parTimeSeconds: 75, coinCount: 12, gemCount: 2 },
      { mazeSize: 14, ballSpeed: 19, parTimeSeconds: 90, coinCount: 15, gemCount: 2 },
    ],
  },
  Hard: {
    name: 'Hard',
    baseXp: 125,  // Matches contract
    stageCount: 5,
    minLevel: 11,
    stages: [
      { mazeSize: 12, ballSpeed: 20, parTimeSeconds: 60, coinCount: 10, gemCount: 1 },
      { mazeSize: 14, ballSpeed: 21, parTimeSeconds: 75, coinCount: 12, gemCount: 2 },
      { mazeSize: 16, ballSpeed: 22, parTimeSeconds: 90, coinCount: 14, gemCount: 2 },
      { mazeSize: 18, ballSpeed: 23, parTimeSeconds: 105, coinCount: 16, gemCount: 3 },
      { mazeSize: 20, ballSpeed: 24, parTimeSeconds: 120, coinCount: 18, gemCount: 3 },
    ],
  },
  Nightmare: {
    name: 'Nightmare',
    baseXp: 150,  // Matches contract
    stageCount: 5,
    minLevel: 21,
    stages: [
      { mazeSize: 16, ballSpeed: 24, parTimeSeconds: 90, coinCount: 12, gemCount: 2 },
      { mazeSize: 18, ballSpeed: 25, parTimeSeconds: 105, coinCount: 14, gemCount: 2 },
      { mazeSize: 20, ballSpeed: 26, parTimeSeconds: 120, coinCount: 16, gemCount: 3 },
      { mazeSize: 22, ballSpeed: 27, parTimeSeconds: 135, coinCount: 18, gemCount: 3 },
      { mazeSize: 25, ballSpeed: 28, parTimeSeconds: 150, coinCount: 20, gemCount: 4 },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// LEVEL PROGRESSION
// ═══════════════════════════════════════════════════════════════

export const LEVEL_TITLES: Record<string, string> = {
  '1-5': 'Wanderer',
  '6-10': 'Pathfinder',
  '11-20': 'Maze Runner',
  '21-35': 'Labyrinth Master',
  '36-50': 'Champion',
  '51+': 'Legend',
};

// Balanced XP formula: 100 + (level * 100) per level
// Matches frontend calculation
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Sum of (100 + n*100) for n=1 to level-1 = 50*(level-1)*(level+2)
  return 50 * (level - 1) * (level + 2);
}

export function getLevelFromXp(totalXp: number): number {
  let level = 1;
  while (getXpForLevel(level + 1) <= totalXp) {
    level++;
    if (level > 100) break;
  }
  return level;
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
// XP CALCULATION
// ═══════════════════════════════════════════════════════════════

export interface GameResult {
  difficulty: Difficulty;
  stagesCompleted: number;
  totalStages: number;
  timeMs: number;
  deaths: number;
  coinsCollected: number;
  gemsCollected: number;
  isTournament: boolean;
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
  const coinBonus = result.coinsCollected * 10;
  const gemBonus = result.gemsCollected * 50;
  
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
  const levelMultiplier = 1 + (result.playerLevel * 0.01);
  
  // Calculate final XP
  const afterPenalty = subtotal - deathPenalty;
  const totalXp = Math.floor(afterPenalty * tournamentMultiplier * levelMultiplier);
  
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
    levelMultiplier,
    totalXp: Math.max(0, totalXp),
  };
}

// Simple XP calculation (backward compatibility)
export function calculateXpSimple(
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
    isTournament,
    isFirstClearToday: false,
    streakDays: 0,
    playerLevel,
  };
  
  return calculateXpBreakdown(result).totalXp;
}

// ═══════════════════════════════════════════════════════════════
// DIVISIONS & RANKING
// ═══════════════════════════════════════════════════════════════

export interface DivisionConfig {
  name: Division;
  minElo: number;
  maxElo: number;
  seasonReward: number;
  icon: string;
}

export const DIVISIONS: DivisionConfig[] = [
  { name: 'Bronze', minElo: 0, maxElo: 499, seasonReward: 500, icon: '🥉' },
  { name: 'Silver', minElo: 500, maxElo: 999, seasonReward: 2000, icon: '⚪' },
  { name: 'Gold', minElo: 1000, maxElo: 1499, seasonReward: 5000, icon: '🥇' },
  { name: 'Platinum', minElo: 1500, maxElo: 1999, seasonReward: 10000, icon: '💠' },
  { name: 'Diamond', minElo: 2000, maxElo: 2499, seasonReward: 25000, icon: '💎' },
  { name: 'Champion', minElo: 2500, maxElo: Infinity, seasonReward: 50000, icon: '👑' },
];

export function getDivisionFromElo(elo: number): Division {
  const division = DIVISIONS.find(d => elo >= d.minElo && elo <= d.maxElo);
  return division?.name || 'Bronze';
}

// ═══════════════════════════════════════════════════════════════
// STREAK MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export function updateStreak(lastPlayedDate: string | undefined, currentStreak: number): { newStreak: number; isFirstClearToday: boolean } {
  const today = new Date().toISOString().split('T')[0];
  
  if (!lastPlayedDate) {
    return { newStreak: 1, isFirstClearToday: true };
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (lastPlayedDate === today) {
    // Already played today, streak continues but no first clear bonus
    return { newStreak: currentStreak, isFirstClearToday: false };
  } else if (lastPlayedDate === yesterdayStr) {
    // Played yesterday, streak continues
    return { newStreak: currentStreak + 1, isFirstClearToday: true };
  } else {
    // Streak broken, start fresh
    return { newStreak: 1, isFirstClearToday: true };
  }
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════

export interface Achievement {
  id: string;
  title: string;
  xpReward: number;
  checkUnlock: (player: any, run?: any) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    xpReward: 100,
    checkUnlock: (player) => player.practiceRuns + player.tournamentRuns >= 1,
  },
  {
    id: 'speed_runner',
    title: 'Speed Runner',
    xpReward: 500,
    checkUnlock: (_, run) => run?.completed && run?.difficulty === 'Easy' && run?.timeMs < 30000,
  },
  {
    id: 'untouchable',
    title: 'Untouchable',
    xpReward: 2000,
    checkUnlock: (_, run) => run?.completed && run?.difficulty === 'Hard' && run?.deaths === 0,
  },
  {
    id: 'nightmare_conqueror',
    title: 'Nightmare Conqueror',
    xpReward: 2000,
    checkUnlock: (_, run) => run?.completed && run?.difficulty === 'Nightmare',
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    xpReward: 10000,
    checkUnlock: (player) => player.perfectRuns >= 100,
  },
  {
    id: 'level_10',
    title: 'Pathfinder',
    xpReward: 100,
    checkUnlock: (player) => getLevelFromXp(player.totalXp) >= 10,
  },
  {
    id: 'level_25',
    title: 'Maze Runner',
    xpReward: 500,
    checkUnlock: (player) => getLevelFromXp(player.totalXp) >= 25,
  },
  {
    id: 'level_50',
    title: 'Champion',
    xpReward: 2000,
    checkUnlock: (player) => getLevelFromXp(player.totalXp) >= 50,
  },
  {
    id: 'xp_millionaire',
    title: 'XP Millionaire',
    xpReward: 10000,
    checkUnlock: (player) => player.totalXp >= 1000000,
  },
  {
    id: 'week_warrior',
    title: 'Week Warrior',
    xpReward: 100,
    checkUnlock: (player) => player.longestStreak >= 7,
  },
  {
    id: 'month_master',
    title: 'Month Master',
    xpReward: 500,
    checkUnlock: (player) => player.longestStreak >= 30,
  },
  {
    id: 'first_blood',
    title: 'First Blood',
    xpReward: 500,
    checkUnlock: (player) => player.tournamentsWon >= 1,
  },
  {
    id: 'tournament_veteran',
    title: 'Tournament Veteran',
    xpReward: 2000,
    checkUnlock: (player) => player.tournamentsPlayed >= 50,
  },
];

export function checkAchievements(player: any, run?: any): string[] {
  const newUnlocks: string[] = [];
  
  for (const achievement of ACHIEVEMENTS) {
    if (!player.achievementIds?.includes(achievement.id)) {
      if (achievement.checkUnlock(player, run)) {
        newUnlocks.push(achievement.id);
      }
    }
  }
  
  return newUnlocks;
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// ═══════════════════════════════════════════════════════════════
// DAILY CHALLENGES
// ═══════════════════════════════════════════════════════════════

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  requirement: {
    type: string;
    value: number;
    difficulty?: Difficulty;
  };
}

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Complete any maze under 60 seconds',
    icon: '⚡',
    xpReward: 500,
    requirement: { type: 'complete_time', value: 60000 },
  },
  {
    id: 'deathless',
    title: 'Untouchable',
    description: 'Complete a maze without dying',
    icon: '🛡️',
    xpReward: 400,
    requirement: { type: 'complete_deathless', value: 1 },
  },
  {
    id: 'triple_threat',
    title: 'Triple Threat',
    description: 'Complete 3 mazes today',
    icon: '🎯',
    xpReward: 600,
    requirement: { type: 'complete_count', value: 3 },
  },
  {
    id: 'xp_hunter',
    title: 'XP Hunter',
    description: 'Earn 1,000 XP today',
    icon: '⭐',
    xpReward: 300,
    requirement: { type: 'earn_xp', value: 1000 },
  },
  {
    id: 'hard_worker',
    title: 'Hard Worker',
    description: 'Complete a Hard maze',
    icon: '💪',
    xpReward: 800,
    requirement: { type: 'complete_difficulty', value: 1, difficulty: 'Hard' },
  },
  {
    id: 'nightmare_challenge',
    title: 'Nightmare Challenge',
    description: 'Complete a Nightmare maze',
    icon: '😈',
    xpReward: 1500,
    requirement: { type: 'complete_difficulty', value: 1, difficulty: 'Nightmare' },
  },
];

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
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getTodaysChallenges(): DailyChallenge[] {
  const today = new Date().toISOString().split('T')[0];
  const seed = hashCode(today);
  
  // Shuffle challenges deterministically based on date
  const shuffled = [...DAILY_CHALLENGES].sort((a, b) => {
    const seedA = hashCode(today + a.id);
    const seedB = hashCode(today + b.id);
    return seededRandom(seedA) - seededRandom(seedB);
  });
  
  // Return first 3 challenges
  return shuffled.slice(0, 3);
}
