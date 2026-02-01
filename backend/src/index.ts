/**
 * Labyrinth Legends - Express + Socket.IO Backend Server
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE: Backend is a CACHE/FALLBACK layer only
 * 
 * The Linera smart contract is the SINGLE SOURCE OF TRUTH for:
 *   - Tournament timing (start/end)
 *   - Valid run submission window
 *   - Final leaderboard rankings
 *   - XP reward calculation and distribution
 * 
 * Backend responsibilities:
 *   - Fast reads (cache blockchain data for UI responsiveness)
 *   - Username lookups (convenience, not authoritative)
 *   - Fallback when blockchain connection fails
 *   - WebSocket real-time updates
 * 
 * Backend NEVER:
 *   - Determines tournament winners
 *   - Calculates final XP rewards
 *   - Validates tournament timing (contract enforces this)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyMessage } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

import { db, calculateXP } from './db/memory.js';
import type {
  Player,
  Tournament,
  GameRun,
  LeaderboardEntry,
  Difficulty,
  GameMode,
  TournamentStatus,
  ServerToClientEvents,
  ClientToServerEvents,
  ApiResponse,
  RegisterPlayerRequest,
  RegisterPlayerResponse,
  SubmitRunRequest,
  SubmitRunResponse,
  JoinTournamentRequest,
  JoinTournamentResponse,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  GetPlayerRequest,
  GetPlayerResponse,
  GetTournamentRequest,
  GetTournamentResponse,
  CreateTournamentRequest,
  CreateTournamentResponse,
  ClaimRewardRequest,
  ClaimRewardResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
} from './types.js';

dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const isDev = process.env.NODE_ENV !== 'production';

// In development, allow all localhost origins
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000',
  'https://labyrinth-legends.vercel.app',
];
const LINERA_GRAPHQL_ENDPOINT =
  process.env.LINERA_GRAPHQL_ENDPOINT ||
  'https://linera-graphql-eu.staketab.org';

// Initialize Express
const app: ReturnType<typeof express> = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: isDev ? '*' : CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: !isDev,
  },
});

// CORS Middleware - MUST be before other middleware
// Handle preflight OPTIONS requests explicitly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // In development, allow all origins
  if (isDev) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && CORS_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ===== Helper Functions =====

function response<T>(data: T, success = true, error?: string): ApiResponse<T> {
  return { success, data, error };
}

function errorResponse(error: string): ApiResponse<null> {
  return { success: false, data: null, error };
}

// Signature verification using personal_sign standard
async function verifyPersonalSign(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// Update tournament statuses periodically
function updateTournamentStatuses() {
  const now = new Date();
  const tournaments = db.getAllTournaments();

  for (const tournament of tournaments) {
    let newStatus: TournamentStatus | null = null;

    if (tournament.status === 'Upcoming' && now >= tournament.startTime) {
      newStatus = 'Active';
    } else if (
      (tournament.status === 'Upcoming' || tournament.status === 'Active') &&
      now >= tournament.endTime
    ) {
      newStatus = 'Ended';

      // Distribute rewards when tournament ends
      db.distributeTournamentRewards(tournament.id);
    }

    if (newStatus && newStatus !== tournament.status) {
      db.updateTournamentStatus(tournament.id, newStatus);

      // Emit tournament status change
      io.emit('tournamentStatusChange', {
        tournamentId: tournament.id,
        status: newStatus,
      });

      console.log(`📢 Tournament ${tournament.id} status changed to ${newStatus}`);
    }
  }
}

// Run tournament status update every minute
setInterval(updateTournamentStatuses, 60000);

// ===== REST API Routes =====

// Health check
app.get('/health', (req, res) => {
  res.json(response({ status: 'ok', timestamp: new Date().toISOString() }));
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json(response(db.getStats()));
});

// Rebuild leaderboard (useful for fixing data)
app.post('/api/admin/rebuild-leaderboard', (req, res) => {
  db.rebuildLeaderboard();
  const leaderboard = db.getPracticeLeaderboard(100);
  res.json(response({ 
    message: 'Leaderboard rebuilt', 
    playerCount: leaderboard.length,
    leaderboard 
  }));
});

// ===== Player Routes =====

// Get player by wallet
app.get('/api/players/:wallet', (req, res) => {
  const { wallet } = req.params;
  const player = db.getPlayer(wallet);

  if (!player) {
    return res.status(404).json(errorResponse('Player not found'));
  }

  const playerResponse: GetPlayerResponse = { player };
  res.json(response(playerResponse));
});

// Register player
app.post('/api/players/register', async (req, res) => {
  try {
    const body = req.body as RegisterPlayerRequest;
    const { walletAddress, username, signature, discordTag } = body;

    if (!walletAddress || !username || !signature) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    // Verify signature
    const message = `Register for Labyrinth Legends with username: ${username}`;
    const isValid = await verifyPersonalSign(message, signature, walletAddress);

    if (!isValid) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    // Check if already registered
    if (db.getPlayer(walletAddress)) {
      return res.status(400).json(errorResponse('Player already registered'));
    }

    // Check username uniqueness
    if (db.getPlayerByUsername(username)) {
      return res.status(400).json(errorResponse('Username already taken'));
    }

    const player = db.createPlayer({
      walletAddress,
      username,
      discordTag,
    });

    // Emit new player event
    io.emit('playerRegistered', {
      player,
      walletAddress: player.walletAddress,
      username: player.username,
    });

    const registerResponse: RegisterPlayerResponse = { player };
    res.status(201).json(response(registerResponse));
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json(errorResponse('Registration failed'));
  }
});

// Sync player from blockchain (like Linera-Arcade does)
// This creates/updates a player in the backend database from blockchain data
app.post('/api/players/sync', (req, res) => {
  try {
    const { wallet_address, username, chain_id } = req.body;
    
    if (!wallet_address || !username) {
      return res.status(400).json(errorResponse('Missing wallet_address or username'));
    }
    
    const normalizedWallet = wallet_address.toLowerCase();
    
    // Check if player exists
    let player = db.getPlayer(normalizedWallet);
    
    if (player) {
      // Update existing player (just update username if different)
      if (player.username !== username) {
        // Update the player in the database
        player = db.updatePlayer(normalizedWallet, { username });
      }
      console.log(`✅ Synced existing player: ${username} (${normalizedWallet})`);
    } else {
      // Create new player (no signature required for sync)
      player = db.createPlayer({
        walletAddress: normalizedWallet,
        username,
        discordTag: undefined,
      });
      console.log(`✅ Created player from sync: ${username} (${normalizedWallet})`);
      
      // Add to leaderboard immediately
      db.updatePracticeLeaderboard(normalizedWallet);
      
      // Emit new player event
      io.emit('playerRegistered', {
        player,
        walletAddress: player.walletAddress,
        username: player.username,
      });
    }
    
    res.json(response({ player, synced: true }));
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json(errorResponse('Sync failed'));
  }
});

// Submit score/XP (like Linera-Arcade - syncs blockchain score to backend)
// This is called after blockchain mutation succeeds
app.post('/api/scores', (req, res) => {
  try {
    const { wallet_address, game_type, score, xp_earned, time_ms, level_reached, deaths, bonus_data, chain_id } = req.body;
    
    if (!wallet_address || xp_earned === undefined) {
      return res.status(400).json(errorResponse('Missing wallet_address or xp_earned'));
    }
    
    const normalizedWallet = wallet_address.toLowerCase();
    
    // Get or create player
    let player = db.getPlayer(normalizedWallet);
    
    if (!player) {
      // Auto-create player if not exists (they registered on blockchain)
      player = db.createPlayer({
        walletAddress: normalizedWallet,
        username: `Player_${normalizedWallet.slice(0, 6)}`,
        discordTag: undefined,
      });
      console.log(`📝 Auto-created player for score: ${normalizedWallet}`);
    }
    
    // Update player XP and practice runs
    const xpToAdd = Math.max(0, parseInt(xp_earned) || 0);
    const timeMs = parseInt(time_ms) || 0;
    
    // Track best time (only if we have a valid time)
    const updateData: any = {
      totalXp: (player.totalXp || 0) + xpToAdd,
      practiceRuns: (player.practiceRuns || 0) + 1,
      lastActive: new Date(),
    };
    
    // Update best time if this is better (or first run)
    if (timeMs > 0) {
      if (!player.bestPracticeTimeMs || timeMs < player.bestPracticeTimeMs) {
        updateData.bestPracticeTimeMs = timeMs;
        console.log(`🏆 New best time for ${player.username}: ${timeMs}ms`);
      }
    }
    
    player = db.updatePlayer(normalizedWallet, updateData);
    
    // IMPORTANT: Update leaderboard after score sync!
    db.updatePracticeLeaderboard(normalizedWallet);
    
    console.log(`✅ Score synced: ${player?.username} +${xpToAdd} XP (total: ${player?.totalXp}, best: ${player?.bestPracticeTimeMs}ms)`);
    
    // Emit score event
    io.emit('runSubmitted', {
      runId: Date.now().toString(),
      walletAddress: normalizedWallet,
      username: player?.username || 'Unknown',
      mode: 'Practice',
      timeMs: 0,
      xpEarned: xpToAdd,
    });
    
    res.json(response({ 
      success: true, 
      player,
      xpAdded: xpToAdd,
    }));
  } catch (error) {
    console.error('Score sync error:', error);
    res.status(500).json(errorResponse('Score sync failed'));
  }
});

// Get player runs
app.get('/api/players/:wallet/runs', (req, res) => {
  const { wallet } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  const runs = db.getPlayerRuns(wallet, limit);
  res.json(response({ runs }));
});

// ===== Tournament Routes =====
// NOTE: These are CACHE endpoints. The smart contract is the source of truth.
// These endpoints provide fast reads and fallback when blockchain is unavailable.

// Get all tournaments (CACHE - read from local DB, synced from blockchain)
app.get('/api/tournaments', (req, res) => {
  const status = req.query.status as TournamentStatus | undefined;
  let tournaments: Tournament[];

  if (status) {
    tournaments = db.getTournamentsByStatus(status);
  } else {
    tournaments = db.getAllTournaments();
  }

  res.json(response({ tournaments }));
});

// Get tournament by ID (CACHE)
app.get('/api/tournaments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const tournament = db.getTournament(id);

  if (!tournament) {
    return res.status(404).json(errorResponse('Tournament not found'));
  }

  const leaderboard = db.getTournamentLeaderboard(id);
  const tournamentResponse: GetTournamentResponse = { tournament, leaderboard };
  res.json(response(tournamentResponse));
});

// Create tournament (CACHE SYNC ONLY - actual creation should happen on blockchain)
// This endpoint is for syncing blockchain tournament data to the cache
app.post('/api/tournaments', async (req, res) => {
  try {
    const body = req.body as CreateTournamentRequest;
    const {
      title,
      description,
      difficulty,
      startTime,
      endTime,
      maxAttemptsPerPlayer,
      xpRewardPool,
      creatorWallet,
      signature,
    } = body;

    if (!title || !difficulty || !startTime || !endTime || !creatorWallet || !signature) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    // Verify signature
    const message = `Create tournament: ${title}`;
    const isValid = await verifyPersonalSign(message, signature, creatorWallet);

    if (!isValid) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    // Generate deterministic maze seed
    const mazeSeed = `tournament-${uuidv4()}`;

    const tournament = db.createTournament({
      title,
      description: description || '',
      difficulty,
      mazeSeed,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      maxAttemptsPerPlayer,
      xpRewardPool: xpRewardPool || 1000,
      creatorWallet,
    });

    // Emit tournament created event
    io.emit('tournamentCreated', tournament);

    const createResponse: CreateTournamentResponse = { tournament };
    res.status(201).json(response(createResponse));
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json(errorResponse('Failed to create tournament'));
  }
});

// Join tournament (CACHE SYNC - actual join happens on-chain via SubmitRun)
// The smart contract auto-registers participants on their first SubmitRun
app.post('/api/tournaments/:id/join', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const body = req.body as JoinTournamentRequest;
    const { walletAddress, signature } = body;

    if (!walletAddress || !signature) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    const tournament = db.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json(errorResponse('Tournament not found'));
    }

    // Verify signature
    const message = `Join tournament: ${tournament.title}`;
    const isValid = await verifyPersonalSign(message, signature, walletAddress);

    if (!isValid) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    // Get player
    const player = db.getPlayer(walletAddress);
    if (!player) {
      return res.status(400).json(errorResponse('Player not registered'));
    }

    const participant = db.joinTournament(tournamentId, walletAddress, player.username);

    // Emit join event
    io.emit('tournamentJoined', {
      tournamentId,
      walletAddress,
      username: player.username,
    });

    const joinResponse: JoinTournamentResponse = {
      tournamentId,
      participant,
      mazeSeed: tournament.mazeSeed,
    };
    res.json(response(joinResponse));
  } catch (error: any) {
    console.error('Join tournament error:', error);
    res.status(400).json(errorResponse(error.message || 'Failed to join tournament'));
  }
});

// Get tournament leaderboard (CACHE - blockchain is authoritative)
app.get('/api/tournaments/:id/leaderboard', (req, res) => {
  const tournamentId = parseInt(req.params.id);
  const leaderboard = db.getTournamentLeaderboard(tournamentId);
  res.json(response({ leaderboard }));
});

// Claim tournament reward (DEPRECATED - use blockchain claimReward mutation)
// This endpoint is kept for backwards compatibility but rewards are distributed on-chain
app.post('/api/tournaments/:id/claim', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const body = req.body as ClaimRewardRequest;
    const { walletAddress, signature } = body;

    if (!walletAddress || !signature) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    // Verify signature
    const message = `Claim reward for tournament ${tournamentId}`;
    const isValid = await verifyPersonalSign(message, signature, walletAddress);

    if (!isValid) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    const reward = db.getTournamentReward(tournamentId, walletAddress);
    if (!reward) {
      return res.status(404).json(errorResponse('No reward found'));
    }

    if (reward.claimed) {
      return res.status(400).json(errorResponse('Reward already claimed'));
    }

    const claimedReward = db.claimReward(tournamentId, walletAddress);

    const claimResponse: ClaimRewardResponse = { reward: claimedReward! };
    res.json(response(claimResponse));
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json(errorResponse('Failed to claim reward'));
  }
});

// ===== Game Run Routes =====
// NOTE: Runs should be submitted to blockchain via SubmitRun mutation.
// This endpoint syncs run data from blockchain to the cache.

// Submit run (DEPRECATED for tournament mode - use blockchain SubmitRun)
// This endpoint remains for practice mode and backwards compatibility
app.post('/api/runs', async (req, res) => {
  try {
    const body = req.body as SubmitRunRequest;
    const {
      walletAddress,
      signature,
      mode,
      tournamentId,
      difficulty,
      levelReached,
      timeMs,
      deaths,
      completed,
      mazeSeed,
    } = body;

    if (!walletAddress || !signature || !mode || !difficulty) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    // Verify signature
    const message = `Submit run: ${mode} ${difficulty} ${timeMs}ms`;
    const isValid = await verifyPersonalSign(message, signature, walletAddress);

    if (!isValid) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    // Get player
    const player = db.getPlayer(walletAddress);
    if (!player) {
      return res.status(400).json(errorResponse('Player not registered'));
    }

    const run = db.submitRun({
      walletAddress,
      username: player.username,
      mode,
      tournamentId,
      difficulty,
      levelReached,
      timeMs,
      deaths,
      completed,
      mazeSeed,
    });

    // Emit run submitted event
    io.emit('runSubmitted', {
      runId: run.id,
      walletAddress: run.walletAddress,
      username: run.username,
      mode: run.mode,
      timeMs: run.timeMs,
      xpEarned: run.xpEarned,
    });

    // If tournament run, update leaderboard broadcast
    if (mode === 'Tournament' && tournamentId) {
      const leaderboard = db.getTournamentLeaderboard(tournamentId);
      io.emit('leaderboardUpdate', {
        type: 'tournament' as const,
        tournamentId,
        leaderboard,
      });
    }

    const submitResponse: SubmitRunResponse = { 
      run,
      xpEarned: run.xpEarned,
      xpBreakdown: run.xpBreakdown || {
        baseXp: 0, completionBonus: 0, speedBonus: 0, perfectBonus: 0,
        coinBonus: 0, gemBonus: 0, streakBonus: 0, firstClearBonus: 0,
        deathPenalty: 0, tournamentMultiplier: 1, levelMultiplier: 1, totalXp: run.xpEarned
      }
    };
    res.json(response(submitResponse));
  } catch (error: any) {
    console.error('Submit run error:', error);
    res.status(400).json(errorResponse(error.message || 'Failed to submit run'));
  }
});

// Get recent runs
app.get('/api/runs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const runs = db.getRecentRuns(limit);
  res.json(response({ runs }));
});

// ===== Leaderboard Routes =====

// Get practice leaderboard
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const leaderboard = db.getPracticeLeaderboard(limit);
  const leaderboardResponse: GetLeaderboardResponse = { leaderboard };
  res.json(response(leaderboardResponse));
});

// ===== Progression & Achievements Routes =====

// Get player achievements
app.get('/api/players/:wallet/achievements', (req, res) => {
  const { wallet } = req.params;
  const player = db.getPlayer(wallet);

  if (!player) {
    return res.status(404).json(errorResponse('Player not found'));
  }

  // Import achievements config
  import('./config/gameConfig.js').then(({ ACHIEVEMENTS, getLevelFromXp, getLevelTitle }) => {
    const unlockedAchievements = ACHIEVEMENTS.filter(a => 
      player.achievementIds?.includes(a.id)
    ).map(a => ({
      ...a,
      unlockedAt: player.lastActive, // We don't track individual unlock times
    }));

    const lockedAchievements = ACHIEVEMENTS.filter(a => 
      !player.achievementIds?.includes(a.id)
    );

    const level = getLevelFromXp(player.totalXp);

    res.json(response({
      level,
      totalXp: player.totalXp,
      unlockedCount: unlockedAchievements.length,
      totalCount: ACHIEVEMENTS.length,
      unlocked: unlockedAchievements,
      locked: lockedAchievements,
    }));
  });
});

// Get player streak info
app.get('/api/players/:wallet/streak', (req, res) => {
  const { wallet } = req.params;
  const player = db.getPlayer(wallet);

  if (!player) {
    return res.status(404).json(errorResponse('Player not found'));
  }

  const today = new Date().toISOString().split('T')[0];
  const isActiveToday = player.lastPlayedDate === today;

  res.json(response({
    currentStreak: player.currentStreak || 0,
    longestStreak: player.longestStreak || 0,
    lastPlayedDate: player.lastPlayedDate,
    isActiveToday,
    streakBonus: Math.min(50, (player.currentStreak || 0) * 5), // 5% per day, max 50%
  }));
});

// Get player stats summary
app.get('/api/players/:wallet/stats', (req, res) => {
  const { wallet } = req.params;
  const player = db.getPlayer(wallet);

  if (!player) {
    return res.status(404).json(errorResponse('Player not found'));
  }

  import('./config/gameConfig.js').then(({ getLevelFromXp, getXpForLevel, getDivisionFromElo, DIVISIONS }) => {
    const level = getLevelFromXp(player.totalXp);
    const currentLevelXp = getXpForLevel(level);
    const nextLevelXp = getXpForLevel(level + 1);
    const xpProgress = player.totalXp - currentLevelXp;
    const xpRequired = nextLevelXp - currentLevelXp;

    const division = getDivisionFromElo(player.elo || 1000);
    const divisionConfig = DIVISIONS.find(d => d.name === division);

    res.json(response({
      // Level progress
      level,
      totalXp: player.totalXp,
      xpProgress,
      xpRequired,
      xpPercentage: Math.floor((xpProgress / xpRequired) * 100),

      // Gameplay stats
      totalRuns: player.practiceRuns + player.tournamentRuns,
      practiceRuns: player.practiceRuns,
      tournamentRuns: player.tournamentRuns,
      perfectRuns: player.perfectRuns || 0,
      totalDeaths: player.totalDeaths || 0,
      totalCoinsCollected: player.totalCoinsCollected || 0,
      totalGemsCollected: player.totalGemsCollected || 0,
      bestPracticeTimeMs: player.bestPracticeTimeMs,

      // Streaks
      currentStreak: player.currentStreak || 0,
      longestStreak: player.longestStreak || 0,

      // Tournaments
      tournamentsPlayed: player.tournamentsPlayed,
      tournamentsWon: player.tournamentsWon,
      winRate: player.tournamentsPlayed > 0 
        ? Math.floor((player.tournamentsWon / player.tournamentsPlayed) * 100)
        : 0,

      // Ranked
      elo: player.elo || 1000,
      division,
      divisionIcon: divisionConfig?.icon || '🥉',
      seasonXp: player.seasonXp || 0,

      // Achievements
      achievementCount: player.achievementIds?.length || 0,
    }));
  });
});

// Get daily challenges
app.get('/api/challenges/daily', (req, res) => {
  import('./config/gameConfig.js').then(({ getTodaysChallenges }) => {
    const challenges = getTodaysChallenges();
    res.json(response({ 
      date: new Date().toISOString().split('T')[0],
      challenges 
    }));
  });
});

// Get player's challenge progress
app.get('/api/players/:wallet/challenges', (req, res) => {
  const { wallet } = req.params;
  const player = db.getPlayer(wallet);

  if (!player) {
    return res.status(404).json(errorResponse('Player not found'));
  }

  // For now, return placeholder progress (would need additional DB tracking)
  import('./config/gameConfig.js').then(({ getTodaysChallenges }) => {
    const challenges = getTodaysChallenges();
    const today = new Date().toISOString().split('T')[0];
    
    res.json(response({
      date: today,
      challenges: challenges.map(c => ({
        ...c,
        currentValue: 0, // Would need proper tracking
        completed: false,
      })),
    }));
  });
});

// Get game configuration (for frontend)
app.get('/api/config/game', (req, res) => {
  import('./config/gameConfig.js').then(({ 
    DIFFICULTY_CONFIG, 
    DIVISIONS, 
    ACHIEVEMENTS 
  }) => {
    res.json(response({
      difficulties: DIFFICULTY_CONFIG,
      divisions: DIVISIONS,
      achievementCount: ACHIEVEMENTS.length,
    }));
  });
});

// ===== Signature Verification Route =====

app.post('/api/verify', async (req, res) => {
  try {
    const body = req.body as VerifySignatureRequest;
    const { message, signature, walletAddress } = body;

    if (!message || !signature || !walletAddress) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    const isValid = await verifyPersonalSign(message, signature, walletAddress);

    const verifyResponse: VerifySignatureResponse = { valid: isValid };
    res.json(response(verifyResponse));
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json(errorResponse('Verification failed'));
  }
});

// ===== Discord XP Route =====

app.get('/api/discord/xp/:discordTag', (req, res) => {
  const { discordTag } = req.params;
  const xp = db.getXpByDiscordTag(decodeURIComponent(discordTag));
  res.json(response({ discordTag, xp }));
});

// ===== Socket.IO Event Handlers =====

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join room for specific tournament updates
  socket.on('joinTournament', (tournamentId) => {
    socket.join(`tournament:${tournamentId}`);
    console.log(`Socket ${socket.id} joined tournament:${tournamentId}`);
  });

  // Leave tournament room
  socket.on('leaveTournament', (tournamentId) => {
    socket.leave(`tournament:${tournamentId}`);
    console.log(`Socket ${socket.id} left tournament:${tournamentId}`);
  });

  // Player identity
  socket.on('identify', (walletAddress) => {
    socket.data.walletAddress = walletAddress.toLowerCase();
    socket.join(`player:${walletAddress.toLowerCase()}`);
    console.log(`Socket ${socket.id} identified as ${walletAddress}`);
  });

  // Request live activity feed
  socket.on('requestActivity', () => {
    const recentRuns = db.getRecentRuns(10);
    socket.emit('activityFeed', recentRuns);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ===== Error Handling =====

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json(errorResponse('Internal server error'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json(errorResponse('Not found'));
});

// ===== Start Server =====

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎮  LABYRINTH LEGENDS Backend Server                        ║
║                                                               ║
║   Port: ${PORT}                                                 ║
║   Env: ${process.env.NODE_ENV || 'development'}                               ║
║                                                               ║
║   Endpoints:                                                  ║
║     GET  /health              - Health check                  ║
║     GET  /api/stats           - Server statistics             ║
║     GET  /api/players/:wallet - Get player profile            ║
║     POST /api/players/register - Register new player          ║
║     GET  /api/tournaments     - List tournaments              ║
║     GET  /api/tournaments/:id - Tournament details            ║
║     POST /api/tournaments     - Create tournament             ║
║     POST /api/tournaments/:id/join - Join tournament          ║
║     POST /api/runs            - Submit game run               ║
║     GET  /api/leaderboard     - Practice leaderboard          ║
║                                                               ║
║   Socket.IO Events:                                           ║
║     playerRegistered, tournamentCreated, runSubmitted,        ║
║     leaderboardUpdate, tournamentStatusChange                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Run initial tournament status update
  updateTournamentStatuses();
});

export { app, io, httpServer };
