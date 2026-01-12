/**
 * Labyrinth Legends - In-Memory Database with JSON Persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type {
  Player,
  Tournament,
  GameRun,
  LeaderboardEntry,
  TournamentParticipant,
  TournamentReward,
  DiscordPlayer,
  Difficulty,
  GameMode,
  TournamentStatus,
} from '../types.js';

import {
  calculateXpBreakdown,
  DIFFICULTY_CONFIG,
  getLevelFromXp,
  updateStreak,
  checkAchievements,
  getAchievementById,
  type GameResult,
} from '../config/gameConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent storage path
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

// In-memory stores
let players = new Map<string, Player>();
let tournaments = new Map<number, Tournament>();
let runs = new Map<string, GameRun>();
let tournamentParticipants = new Map<string, TournamentParticipant>(); // key: `${tournamentId}:${wallet}`
let tournamentRewards = new Map<string, TournamentReward>(); // key: `${tournamentId}:${wallet}`
let practiceLeaderboard: LeaderboardEntry[] = [];
let tournamentLeaderboards = new Map<number, LeaderboardEntry[]>();
let discordPlayers = new Map<string, DiscordPlayer>();

// Counters
let nextTournamentId = 1;

// ===== Persistence =====

interface DatabaseSnapshot {
  players: [string, Player][];
  tournaments: [number, Tournament][];
  runs: [string, GameRun][];
  tournamentParticipants: [string, TournamentParticipant][];
  tournamentRewards: [string, TournamentReward][];
  practiceLeaderboard: LeaderboardEntry[];
  tournamentLeaderboards: [number, LeaderboardEntry[]][];
  discordPlayers: [string, DiscordPlayer][];
  nextTournamentId: number;
}

function saveData(): void {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const snapshot: DatabaseSnapshot = {
      players: Array.from(players.entries()),
      tournaments: Array.from(tournaments.entries()),
      runs: Array.from(runs.entries()),
      tournamentParticipants: Array.from(tournamentParticipants.entries()),
      tournamentRewards: Array.from(tournamentRewards.entries()),
      practiceLeaderboard,
      tournamentLeaderboards: Array.from(tournamentLeaderboards.entries()),
      discordPlayers: Array.from(discordPlayers.entries()),
      nextTournamentId,
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2));
    console.log('💾 Database saved');
  } catch (error) {
    console.error('❌ Failed to save database:', error);
  }
}

function loadData(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('📁 No existing database found, starting fresh');
      return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as DatabaseSnapshot;

    // Restore maps with date conversion
    players = new Map(
      data.players.map(([k, v]) => [
        k,
        { ...v, registeredAt: new Date(v.registeredAt), lastActive: new Date(v.lastActive) },
      ])
    );

    tournaments = new Map(
      data.tournaments.map(([k, v]) => [
        k,
        {
          ...v,
          startTime: new Date(v.startTime),
          endTime: new Date(v.endTime),
          createdAt: new Date(v.createdAt),
        },
      ])
    );

    runs = new Map(
      data.runs.map(([k, v]) => [k, { ...v, createdAt: new Date(v.createdAt) }])
    );

    tournamentParticipants = new Map(
      data.tournamentParticipants.map(([k, v]) => [
        k,
        { ...v, joinedAt: new Date(v.joinedAt) },
      ])
    );

    tournamentRewards = new Map(data.tournamentRewards);
    practiceLeaderboard = data.practiceLeaderboard || [];
    tournamentLeaderboards = new Map(data.tournamentLeaderboards || []);

    discordPlayers = new Map(
      (data.discordPlayers || []).map(([k, v]) => [
        k,
        { ...v, lastActive: new Date(v.lastActive) },
      ])
    );

    nextTournamentId = data.nextTournamentId || 1;

    console.log('✅ Database loaded:', {
      players: players.size,
      tournaments: tournaments.size,
      runs: runs.size,
    });

    // Rebuild leaderboard from all players with XP
    rebuildPracticeLeaderboard();
  } catch (error) {
    console.error('❌ Failed to load database:', error);
  }
}

// Rebuild leaderboard from all players who have XP
function rebuildPracticeLeaderboard(): void {
  practiceLeaderboard = [];
  
  for (const player of players.values()) {
    if (player.totalXp > 0 || player.practiceRuns > 0) {
      practiceLeaderboard.push({
        rank: 0,
        walletAddress: player.walletAddress,
        username: player.username,
        bestTimeMs: player.bestPracticeTimeMs || 0,
        totalRuns: player.practiceRuns,
        totalXp: player.totalXp,
      });
    }
  }
  
  // Sort by XP (highest first)
  practiceLeaderboard.sort((a, b) => b.totalXp - a.totalXp);
  practiceLeaderboard = practiceLeaderboard.slice(0, 100);
  practiceLeaderboard.forEach((e, i) => (e.rank = i + 1));
  
  console.log(`🏆 Leaderboard rebuilt with ${practiceLeaderboard.length} players`);
}

// Load on startup
loadData();

// Auto-save every 30 seconds
setInterval(saveData, 30000);

// Save on exit
process.on('SIGINT', () => {
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveData();
  process.exit(0);
});

// ===== XP Calculation =====

const DIFFICULTY_BASE_XP: Record<Difficulty, number> = {
  Easy: 100,
  Medium: 200,
  Hard: 400,
  Nightmare: 800,
};

export function calculateXP(
  difficulty: Difficulty,
  timeMs: number,
  deaths: number,
  completed: boolean,
  isTournament: boolean
): number {
  const baseXp = DIFFICULTY_BASE_XP[difficulty];
  const completionBonus = completed ? baseXp : 0;

  // Time bonus (max 2x base for under 2 minutes)
  const timeSecs = timeMs / 1000;
  const timeBonus =
    completed && timeSecs < 120 ? Math.floor((baseXp * (120 - timeSecs)) / 120) : 0;

  // Death penalty (-10% per death, min 50%)
  const deathPenalty = Math.min(deaths * 10, 50);
  const deathMultiplier = (100 - deathPenalty) / 100;

  // Tournament bonus (+50%)
  const tournamentMultiplier = isTournament ? 1.5 : 1;

  return Math.floor((baseXp + completionBonus + timeBonus) * deathMultiplier * tournamentMultiplier);
}

// ===== Database Operations =====

export const db = {
  // ===== Players =====
  
  getPlayer(walletAddress: string): Player | undefined {
    return players.get(walletAddress.toLowerCase());
  },

  getPlayerByUsername(username: string): Player | undefined {
    for (const player of players.values()) {
      if (player.username.toLowerCase() === username.toLowerCase()) {
        return player;
      }
    }
    return undefined;
  },

  createPlayer(data: {
    walletAddress: string;
    username: string;
    discordTag?: string;
  }): Player {
    const wallet = data.walletAddress.toLowerCase();

    if (players.has(wallet)) {
      throw new Error('Player already registered');
    }

    // Check username uniqueness
    if (this.getPlayerByUsername(data.username)) {
      throw new Error('Username already taken');
    }

    const player: Player = {
      walletAddress: wallet,
      username: data.username,
      discordTag: data.discordTag,
      totalXp: 0,
      practiceRuns: 0,
      tournamentRuns: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      registeredAt: new Date(),
      lastActive: new Date(),
      // Progression tracking
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedDate: undefined,
      perfectRuns: 0,
      totalDeaths: 0,
      totalCoinsCollected: 0,
      totalGemsCollected: 0,
      // Ranked
      elo: 1000, // Starting ELO
      division: 'Silver',
      seasonXp: 0,
      // Achievements
      achievementIds: [],
    };

    players.set(wallet, player);

    // Link Discord if provided
    if (data.discordTag) {
      discordPlayers.set(wallet, {
        walletAddress: wallet,
        username: data.username,
        discordTag: data.discordTag,
        totalXpEarned: 0,
        lastActive: new Date(),
      });
    }

    saveData();
    return player;
  },

  updatePlayer(walletAddress: string, updates: Partial<Player>): Player | undefined {
    const wallet = walletAddress.toLowerCase();
    const player = players.get(wallet);
    if (!player) return undefined;

    const updated = { ...player, ...updates, lastActive: new Date() };
    players.set(wallet, updated);
    saveData();
    return updated;
  },

  getAllPlayers(): Player[] {
    return Array.from(players.values());
  },

  // ===== Tournaments =====

  getTournament(id: number): Tournament | undefined {
    return tournaments.get(id);
  },

  getAllTournaments(): Tournament[] {
    return Array.from(tournaments.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  getTournamentsByStatus(status: TournamentStatus): Tournament[] {
    return this.getAllTournaments().filter((t) => t.status === status);
  },

  createTournament(data: {
    title: string;
    description: string;
    difficulty: Difficulty;
    mazeSeed: string;
    startTime: Date;
    endTime: Date;
    maxAttemptsPerPlayer?: number;
    xpRewardPool: number;
    creatorWallet: string;
  }): Tournament {
    const id = nextTournamentId++;

    // Determine initial status
    const now = new Date();
    let status: TournamentStatus = 'Upcoming';
    if (now >= data.startTime && now < data.endTime) {
      status = 'Active';
    } else if (now >= data.endTime) {
      status = 'Ended';
    }

    const tournament: Tournament = {
      id,
      ...data,
      status,
      createdAt: new Date(),
      participantCount: 0,
    };

    tournaments.set(id, tournament);
    tournamentLeaderboards.set(id, []);
    saveData();

    return tournament;
  },

  updateTournamentStatus(id: number, status: TournamentStatus): Tournament | undefined {
    const tournament = tournaments.get(id);
    if (!tournament) return undefined;

    tournament.status = status;
    tournaments.set(id, tournament);
    saveData();

    return tournament;
  },

  // ===== Tournament Participants =====

  getParticipant(tournamentId: number, walletAddress: string): TournamentParticipant | undefined {
    const key = `${tournamentId}:${walletAddress.toLowerCase()}`;
    return tournamentParticipants.get(key);
  },

  getTournamentParticipants(tournamentId: number): TournamentParticipant[] {
    const participants: TournamentParticipant[] = [];
    for (const [key, participant] of tournamentParticipants) {
      if (key.startsWith(`${tournamentId}:`)) {
        participants.push(participant);
      }
    }
    return participants;
  },

  joinTournament(tournamentId: number, walletAddress: string, username: string): TournamentParticipant {
    const wallet = walletAddress.toLowerCase();
    const key = `${tournamentId}:${wallet}`;

    if (tournamentParticipants.has(key)) {
      throw new Error('Already joined this tournament');
    }

    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status === 'Ended') {
      throw new Error('Tournament has ended');
    }

    const participant: TournamentParticipant = {
      walletAddress: wallet,
      username,
      attemptsUsed: 0,
      joinedAt: new Date(),
    };

    tournamentParticipants.set(key, participant);

    // Update tournament participant count
    tournament.participantCount++;
    tournaments.set(tournamentId, tournament);

    // Update player tournaments played
    const player = players.get(wallet);
    if (player) {
      player.tournamentsPlayed++;
      players.set(wallet, player);
    }

    saveData();
    return participant;
  },

  // ===== Game Runs =====

  getRun(id: string): GameRun | undefined {
    return runs.get(id);
  },

  getRecentRuns(limit: number = 20): GameRun[] {
    return Array.from(runs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  },

  getPlayerRuns(walletAddress: string, limit: number = 50): GameRun[] {
    const wallet = walletAddress.toLowerCase();
    return Array.from(runs.values())
      .filter((r) => r.walletAddress === wallet)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  },

  getTournamentRuns(tournamentId: number): GameRun[] {
    return Array.from(runs.values())
      .filter((r) => r.tournamentId === tournamentId)
      .sort((a, b) => a.timeMs - b.timeMs);
  },

  submitRun(data: {
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
    stagesCompleted?: number;
    coinsCollected?: number;
    gemsCollected?: number;
  }): GameRun {
    const wallet = data.walletAddress.toLowerCase();
    const isTournament = data.mode === 'Tournament';
    const config = DIFFICULTY_CONFIG[data.difficulty];

    // Validate tournament run
    if (isTournament && data.tournamentId) {
      const tournament = tournaments.get(data.tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.status !== 'Active') {
        throw new Error('Tournament is not active');
      }

      const key = `${data.tournamentId}:${wallet}`;
      const participant = tournamentParticipants.get(key);
      if (!participant) {
        throw new Error('Not joined this tournament');
      }

      if (tournament.maxAttemptsPerPlayer && participant.attemptsUsed >= tournament.maxAttemptsPerPlayer) {
        throw new Error('Maximum attempts reached');
      }
    }

    // Get player for streak and level calculation
    const player = players.get(wallet);
    const playerLevel = player ? getLevelFromXp(player.totalXp) : 1;
    
    // Update streak
    const streakInfo = player 
      ? updateStreak(player.lastPlayedDate, player.currentStreak)
      : { newStreak: 1, isFirstClearToday: true };

    // Calculate stages
    const stagesCompleted = data.stagesCompleted ?? (data.completed ? config.stageCount : 0);
    const totalStages = config.stageCount;
    const coinsCollected = data.coinsCollected ?? 0;
    const gemsCollected = data.gemsCollected ?? 0;
    const isPerfectRun = data.deaths === 0 && data.completed;

    // Build game result for XP calculation
    const gameResult: GameResult = {
      difficulty: data.difficulty,
      stagesCompleted,
      totalStages,
      timeMs: data.timeMs,
      deaths: data.deaths,
      coinsCollected,
      gemsCollected,
      isTournament,
      isFirstClearToday: streakInfo.isFirstClearToday,
      streakDays: streakInfo.newStreak,
      playerLevel,
    };

    // Calculate XP with detailed breakdown
    const xpBreakdown = calculateXpBreakdown(gameResult);
    const xpEarned = xpBreakdown.totalXp;

    const run: GameRun = {
      id: uuidv4(),
      walletAddress: wallet,
      username: data.username,
      mode: data.mode,
      tournamentId: data.tournamentId,
      difficulty: data.difficulty,
      levelReached: data.levelReached,
      timeMs: data.timeMs,
      deaths: data.deaths,
      completed: data.completed,
      xpEarned,
      mazeSeed: data.mazeSeed,
      createdAt: new Date(),
      // Enhanced tracking
      stagesCompleted,
      totalStages,
      coinsCollected,
      gemsCollected,
      isPerfectRun,
      xpBreakdown,
    };

    runs.set(run.id, run);

    // Update player stats
    if (player) {
      const today = new Date().toISOString().split('T')[0];
      
      player.totalXp += xpEarned;
      player.lastActive = new Date();
      player.lastPlayedDate = today;
      player.currentStreak = streakInfo.newStreak;
      player.longestStreak = Math.max(player.longestStreak || 0, streakInfo.newStreak);
      player.totalDeaths = (player.totalDeaths || 0) + data.deaths;
      player.totalCoinsCollected = (player.totalCoinsCollected || 0) + coinsCollected;
      player.totalGemsCollected = (player.totalGemsCollected || 0) + gemsCollected;

      if (isPerfectRun) {
        player.perfectRuns = (player.perfectRuns || 0) + 1;
      }

      if (isTournament) {
        player.tournamentRuns++;
      } else {
        player.practiceRuns++;
        if (data.completed) {
          if (!player.bestPracticeTimeMs || data.timeMs < player.bestPracticeTimeMs) {
            player.bestPracticeTimeMs = data.timeMs;
          }
        }
      }

      // Check for new achievements
      const newAchievements = checkAchievements(player, run);
      if (newAchievements.length > 0) {
        player.achievementIds = [...(player.achievementIds || []), ...newAchievements];
        
        // Award achievement XP
        for (const achId of newAchievements) {
          const achievement = getAchievementById(achId);
          if (achievement) {
            player.totalXp += achievement.xpReward;
            console.log(`🏆 Achievement unlocked: ${achievement.title} (+${achievement.xpReward} XP)`);
          }
        }
      }

      players.set(wallet, player);

      // Update Discord XP
      const discord = discordPlayers.get(wallet);
      if (discord) {
        discord.totalXpEarned += xpEarned;
        discord.lastActive = new Date();
        discordPlayers.set(wallet, discord);
      }
    }

    // Update tournament participant
    if (isTournament && data.tournamentId) {
      const key = `${data.tournamentId}:${wallet}`;
      const participant = tournamentParticipants.get(key);
      if (participant) {
        participant.attemptsUsed++;
        if (data.completed) {
          if (!participant.bestTimeMs || data.timeMs < participant.bestTimeMs) {
            participant.bestTimeMs = data.timeMs;
            participant.bestRunId = run.id;
          }
        }
        tournamentParticipants.set(key, participant);
      }

      // Update tournament leaderboard
      this.updateTournamentLeaderboard(data.tournamentId);
    } else {
      // Update practice leaderboard
      this.updatePracticeLeaderboard(wallet);
    }

    saveData();
    return run;
  },

  // ===== Leaderboards =====

  getPracticeLeaderboard(limit: number = 100): LeaderboardEntry[] {
    return practiceLeaderboard.slice(0, limit);
  },

  getTournamentLeaderboard(tournamentId: number): LeaderboardEntry[] {
    return tournamentLeaderboards.get(tournamentId) || [];
  },

  updatePracticeLeaderboard(walletAddress: string): void {
    const wallet = walletAddress.toLowerCase();
    const player = players.get(wallet);
    if (!player) return;

    // Find or create entry - add all players with XP, not just those who completed
    let entry = practiceLeaderboard.find((e) => e.walletAddress === wallet);

    if (entry) {
      entry.bestTimeMs = player.bestPracticeTimeMs || 0; // 0 means not completed
      entry.totalRuns = player.practiceRuns;
      entry.totalXp = player.totalXp;
    } else {
      entry = {
        rank: 0,
        walletAddress: wallet,
        username: player.username,
        bestTimeMs: player.bestPracticeTimeMs || 0, // 0 means not completed
        totalRuns: player.practiceRuns,
        totalXp: player.totalXp,
      };
      practiceLeaderboard.push(entry);
    }

    // Sort by XP (highest first) - this shows most active players
    // Players with completion times will also have high XP from completions
    practiceLeaderboard.sort((a, b) => b.totalXp - a.totalXp);
    practiceLeaderboard = practiceLeaderboard.slice(0, 100);
    practiceLeaderboard.forEach((e, i) => (e.rank = i + 1));
  },

  updateTournamentLeaderboard(tournamentId: number): void {
    const participants = this.getTournamentParticipants(tournamentId);
    const completedParticipants = participants.filter((p) => p.bestTimeMs !== undefined);

    const leaderboard: LeaderboardEntry[] = completedParticipants
      .map((p) => {
        const player = players.get(p.walletAddress);
        return {
          rank: 0,
          walletAddress: p.walletAddress,
          username: p.username,
          bestTimeMs: p.bestTimeMs!,
          totalRuns: p.attemptsUsed,
          totalXp: player?.totalXp || 0,
        };
      })
      .sort((a, b) => a.bestTimeMs - b.bestTimeMs);

    leaderboard.forEach((e, i) => (e.rank = i + 1));
    tournamentLeaderboards.set(tournamentId, leaderboard);
  },

  // ===== Tournament Rewards =====

  distributeTournamentRewards(tournamentId: number): TournamentReward[] {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) return [];

    const leaderboard = tournamentLeaderboards.get(tournamentId) || [];
    const pool = tournament.xpRewardPool;
    const rewards: TournamentReward[] = [];

    // Distribution: 30% 1st, 20% 2nd, 10% 3rd, 40% shared among 4-10
    const distribution = [0.3, 0.2, 0.1];

    leaderboard.slice(0, 10).forEach((entry, i) => {
      let xpAmount: number;

      if (i < 3) {
        xpAmount = Math.floor(pool * distribution[i]);
      } else {
        xpAmount = Math.floor((pool * 0.4) / 7);
      }

      const reward: TournamentReward = {
        tournamentId,
        walletAddress: entry.walletAddress,
        rank: entry.rank,
        xpAmount,
        claimed: false,
      };

      const key = `${tournamentId}:${entry.walletAddress}`;
      tournamentRewards.set(key, reward);
      rewards.push(reward);

      // Add XP to player
      const player = players.get(entry.walletAddress);
      if (player) {
        player.totalXp += xpAmount;
        if (entry.rank === 1) {
          player.tournamentsWon++;
        }
        players.set(entry.walletAddress, player);
      }
    });

    saveData();
    return rewards;
  },

  getTournamentReward(tournamentId: number, walletAddress: string): TournamentReward | undefined {
    const key = `${tournamentId}:${walletAddress.toLowerCase()}`;
    return tournamentRewards.get(key);
  },

  claimReward(tournamentId: number, walletAddress: string): TournamentReward | undefined {
    const key = `${tournamentId}:${walletAddress.toLowerCase()}`;
    const reward = tournamentRewards.get(key);
    if (!reward || reward.claimed) return undefined;

    reward.claimed = true;
    tournamentRewards.set(key, reward);
    saveData();

    return reward;
  },

  // ===== Discord =====

  getDiscordPlayer(walletAddress: string): DiscordPlayer | undefined {
    return discordPlayers.get(walletAddress.toLowerCase());
  },

  getDiscordPlayerByTag(discordTag: string): DiscordPlayer | undefined {
    for (const player of discordPlayers.values()) {
      if (player.discordTag === discordTag) {
        return player;
      }
    }
    return undefined;
  },

  getXpByDiscordTag(discordTag: string): number {
    const player = this.getDiscordPlayerByTag(discordTag);
    return player?.totalXpEarned || 0;
  },

  // ===== Stats =====

  getStats() {
    const activeTournaments = Array.from(tournaments.values()).filter(
      (t) => t.status === 'Active'
    ).length;

    return {
      totalPlayers: players.size,
      totalTournaments: tournaments.size,
      totalRuns: runs.size,
      activeTournaments,
    };
  },

  // Rebuild leaderboard from all players
  rebuildLeaderboard(): void {
    rebuildPracticeLeaderboard();
    saveData();
  },
};

export default db;
