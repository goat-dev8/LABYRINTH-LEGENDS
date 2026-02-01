/**
 * Labyrinth Legends - Linera Blockchain Service
 * Backend service for interacting with Linera chain
 * 
 * Application ID: 0672437a55d58878df5a14f5d63e23a4c73fd3f602616c519075112da89487ca
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// ============================================
// CONFIGURATION
// ============================================

const LINERA_CONFIG = {
  graphqlEndpoint: process.env.LINERA_GRAPHQL_ENDPOINT || 'https://linera-graphql-eu.staketab.org',
  faucetUrl: process.env.LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net',
  chainId: process.env.LINERA_CHAIN_ID || '5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36',
  appId: process.env.LINERA_APP_ID || '6421a8cb15976821a7d70465f07a3875da38ba33c3da6027e79a3af9e154c876',
  walletPath: process.env.LINERA_WALLET_PATH || `${process.env.HOME}/.config/linera/wallet.json`,
  keystorePath: process.env.LINERA_KEYSTORE_PATH || `${process.env.HOME}/.config/linera`,
  ownerAddress: process.env.LINERA_OWNER_ADDRESS || '',
  enabled: process.env.ENABLE_LINERA === 'true',
};

// ============================================
// TYPES
// ============================================

interface GameSession {
  id: number;
  owner: string;
  mode: 'Practice' | 'Tournament';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
  mazeSeed: string;
  startedAt: number;
  expiresAt: number;
  completed: boolean;
  currentLevel: number;
}

// ============================================
// GRAPHQL CLIENT
// ============================================

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const appEndpoint = `${LINERA_CONFIG.graphqlEndpoint}/chains/${LINERA_CONFIG.chainId}/applications/${LINERA_CONFIG.appId}`;
  
  const response = await fetch(appEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error('No data returned from Linera');
  }

  return json.data;
}

// ============================================
// LINERA CLI WRAPPER
// ============================================

/**
 * Execute a Linera CLI command
 */
async function lineraCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('linera', args, {
      env: {
        ...global.process.env,
        LINERA_WALLET: LINERA_CONFIG.walletPath,
      },
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Linera command failed: ${stderr || stdout}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================
// SERVICE CLASS
// ============================================

class LineraService {
  private enabled: boolean;

  constructor() {
    this.enabled = LINERA_CONFIG.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getConfig() {
    return {
      chainId: LINERA_CONFIG.chainId,
      appId: LINERA_CONFIG.appId,
      graphqlEndpoint: LINERA_CONFIG.graphqlEndpoint,
      enabled: this.enabled,
    };
  }

  // ============================================
  // PLAYER OPERATIONS
  // ============================================

  async getPlayer(owner: string) {
    const data = await graphqlQuery<{ player: any }>(`
      query GetPlayer($owner: String!) {
        player(owner: $owner) {
          owner
          username
          discordTag
          totalXp
          practiceRuns
          tournamentRuns
          bestPracticeTimeMs
          tournamentsPlayed
          tournamentsWon
          registeredAt
        }
      }
    `, { owner });
    return data.player;
  }

  async isPlayerRegistered(owner: string): Promise<boolean> {
    try {
      const data = await graphqlQuery<{ isRegistered: boolean }>(`
        query IsRegistered($owner: String!) {
          isRegistered(owner: $owner)
        }
      `, { owner });
      return data.isRegistered;
    } catch {
      return false;
    }
  }

  // ============================================
  // SESSION OPERATIONS (Anti-Cheat)
  // ============================================

  async getActiveSession(owner: string): Promise<GameSession | null> {
    try {
      const data = await graphqlQuery<{ activeSession: GameSession | null }>(`
        query GetActiveSession($owner: String!) {
          activeSession(owner: $owner) {
            id
            owner
            mode
            difficulty
            mazeSeed
            startedAt
            expiresAt
            completed
            currentLevel
          }
        }
      `, { owner });
      return data.activeSession;
    } catch {
      return null;
    }
  }

  async hasActiveSession(owner: string): Promise<boolean> {
    try {
      const data = await graphqlQuery<{ hasActiveSession: boolean }>(`
        query HasActiveSession($owner: String!) {
          hasActiveSession(owner: $owner)
        }
      `, { owner });
      return data.hasActiveSession;
    } catch {
      return false;
    }
  }

  async getSession(id: number): Promise<GameSession | null> {
    try {
      const data = await graphqlQuery<{ session: GameSession | null }>(`
        query GetSession($id: Int!) {
          session(id: $id) {
            id
            owner
            mode
            difficulty
            mazeSeed
            startedAt
            expiresAt
            completed
            currentLevel
          }
        }
      `, { id });
      return data.session;
    } catch {
      return null;
    }
  }

  // ============================================
  // TOURNAMENT OPERATIONS
  // ============================================

  async getTournaments(status?: string) {
    const data = await graphqlQuery<{ tournaments: any[] }>(`
      query GetTournaments($status: TournamentStatus) {
        tournaments(status: $status) {
          id
          title
          description
          difficulty
          mazeSeed
          startTime
          endTime
          status
          creator
          participantCount
          totalRuns
          xpRewardPool
        }
      }
    `, { status });
    return data.tournaments;
  }

  async getTournament(id: number) {
    const data = await graphqlQuery<{ tournament: any; tournamentLeaderboard: any[] }>(`
      query GetTournament($id: Int!) {
        tournament(id: $id) {
          id
          title
          description
          difficulty
          mazeSeed
          startTime
          endTime
          status
          creator
          participantCount
          totalRuns
          xpRewardPool
          maxAttemptsPerPlayer
        }
        tournamentLeaderboard(tournamentId: $id) {
          owner
          username
          bestTime
          bestLevel
          attempts
          rank
        }
      }
    `, { id });
    return data;
  }

  // ============================================
  // LEADERBOARD OPERATIONS
  // ============================================

  async getPracticeLeaderboard(difficulty?: string, limit = 100) {
    const data = await graphqlQuery<{ practiceLeaderboard: any[] }>(`
      query GetPracticeLeaderboard($difficulty: Difficulty, $limit: Int) {
        practiceLeaderboard(difficulty: $difficulty, limit: $limit) {
          owner
          username
          bestTime
          bestLevel
          gamesPlayed
          rank
        }
      }
    `, { difficulty, limit });
    return data.practiceLeaderboard;
  }

  // ============================================
  // STATS
  // ============================================

  async getStats() {
    const data = await graphqlQuery<{ stats: any }>(`
      query GetStats {
        stats {
          totalPlayers
          totalTournaments
          totalRuns
          activeTournaments
        }
      }
    `);
    return data.stats;
  }

  // ============================================
  // CHAIN STATUS
  // ============================================

  async getChainStatus() {
    try {
      const output = await lineraCommand(['wallet', 'show']);
      return {
        connected: true,
        status: output,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getBalance(chainId?: string) {
    try {
      const args = ['wallet', 'balance'];
      if (chainId) {
        args.push('--chain', chainId);
      }
      const output = await lineraCommand(args);
      return output;
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }
}

// Singleton instance
export const lineraService = new LineraService();
export default lineraService;
