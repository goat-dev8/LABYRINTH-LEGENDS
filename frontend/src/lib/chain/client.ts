/**
 * Labyrinth Legends - Linera GraphQL Client
 * Tournament-First Architecture - All scoring on-chain
 */

import { LINERA_CONFIG, LINERA_QUERIES, LINERA_MUTATIONS } from './config';

// ============================================
// TYPES
// ============================================

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface LineraOperation {
  query: string;
  variables?: Record<string, unknown>;
}

export interface Tournament {
  id: number;
  title: string;
  description: string;
  mazeSeed: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
  startTime: number;
  endTime: number;
  status: 'Active' | 'Ended';
  participantCount: number;
  totalRuns: number;
  xpRewardPool: number;
}

export interface LeaderboardEntry {
  walletAddress: string;
  username: string;
  bestTimeMs: number;
  totalRuns: number;
  totalXpEarned: number;
  rank: number;
}

export interface Player {
  walletAddress: string;
  username: string;
  totalXp: number;
  totalRuns: number;
  tournamentsPlayed: number;
  registeredAt: number;
}

export interface GameRun {
  id: number;
  walletAddress: string;
  username: string;
  tournamentId: number;
  timeMs: number;
  score: number;
  coins: number;
  deaths: number;
  completed: boolean;
  xpEarned: number;
  timestamp: number;
}

export interface TournamentReward {
  tournamentId: number;
  walletAddress?: string;
  rank: number;
  xpAmount: number;
  claimed: boolean;
}

export interface Stats {
  totalPlayers: number;
  totalTournaments: number;
  totalRuns: number;
  activeTournamentId: number | null;
}

// ============================================
// GRAPHQL CLIENT
// ============================================

class LineraClient {
  private appEndpoint: string;
  private enabled: boolean;

  constructor() {
    this.appEndpoint = LINERA_CONFIG.appEndpoint;
    this.enabled = LINERA_CONFIG.enabled;
  }

  /**
   * Execute a GraphQL query against the application
   */
  async query<T>(operation: LineraOperation): Promise<T> {
    if (!this.enabled) {
      throw new Error('Linera integration is disabled');
    }

    const response = await fetch(this.appEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: operation.query,
        variables: operation.variables || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const json: GraphQLResponse<T> = await response.json();

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message);
    }

    if (!json.data) {
      throw new Error('No data returned from Linera');
    }

    return json.data;
  }

  /**
   * Execute a mutation (schedules an operation)
   */
  async mutate<T>(operation: LineraOperation): Promise<T> {
    return this.query<T>(operation);
  }

  // ============================================
  // TOURNAMENT OPERATIONS
  // ============================================

  /**
   * Get the currently active tournament
   */
  async getActiveTournament(): Promise<Tournament | null> {
    const data = await this.query<{ activeTournament: Tournament | null }>({
      query: LINERA_QUERIES.getActiveTournament,
    });
    return data.activeTournament;
  }

  /**
   * Get tournament by ID
   */
  async getTournament(id: number): Promise<Tournament | null> {
    const data = await this.query<{ tournament: Tournament | null }>({
      query: LINERA_QUERIES.getTournament,
      variables: { id },
    });
    return data.tournament;
  }

  /**
   * Get all tournaments (optionally filtered by status)
   */
  async getTournaments(status?: 'Active' | 'Ended'): Promise<Tournament[]> {
    const data = await this.query<{ tournaments: Tournament[] }>({
      query: LINERA_QUERIES.getTournaments,
      variables: { status },
    });
    return data.tournaments || [];
  }

  // ============================================
  // LEADERBOARD OPERATIONS
  // ============================================

  /**
   * Get tournament leaderboard
   */
  async getLeaderboard(tournamentId: number, limit = 100): Promise<LeaderboardEntry[]> {
    const data = await this.query<{ leaderboard: LeaderboardEntry[] }>({
      query: LINERA_QUERIES.getLeaderboard,
      variables: { tournamentId, limit },
    });
    return data.leaderboard || [];
  }

  /**
   * Get player's rank in a tournament
   */
  async getPlayerRank(tournamentId: number, owner: string): Promise<number | null> {
    const data = await this.query<{ playerRank: number | null }>({
      query: LINERA_QUERIES.getPlayerRank,
      variables: { tournamentId, owner },
    });
    return data.playerRank;
  }

  // ============================================
  // PLAYER OPERATIONS
  // ============================================

  /**
   * Get player by wallet address
   */
  async getPlayer(owner: string): Promise<Player | null> {
    const data = await this.query<{ player: Player | null }>({
      query: LINERA_QUERIES.getPlayer,
      variables: { owner },
    });
    return data.player;
  }

  /**
   * Check if player is registered
   */
  async isRegistered(owner: string): Promise<boolean> {
    const data = await this.query<{ isRegistered: boolean }>({
      query: LINERA_QUERIES.isRegistered,
      variables: { owner },
    });
    return data.isRegistered;
  }

  /**
   * Register a new player
   * walletAddress should be a hex string (0x... or raw hex)
   */
  async registerPlayer(walletAddress: string, username: string) {
    // Convert hex string to array of integers
    const hex = walletAddress.toLowerCase().replace('0x', '');
    const walletArray: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      walletArray.push(parseInt(hex.substr(i, 2), 16));
    }
    
    return this.mutate({
      query: LINERA_MUTATIONS.registerPlayer,
      variables: { walletAddress: walletArray, username },
    });
  }

  // ============================================
  // GAME RUN OPERATIONS
  // ============================================

  /**
   * Submit a game run to a tournament
   * This is the PRIMARY operation for gameplay
   */
  async submitRun(params: {
    tournamentId: number;
    timeMs: number;
    score: number;
    coins: number;
    deaths: number;
    completed: boolean;
  }) {
    return this.mutate({
      query: LINERA_MUTATIONS.submitRun,
      variables: params,
    });
  }

  /**
   * Get recent runs (activity feed)
   */
  async getRecentRuns(limit = 20): Promise<GameRun[]> {
    const data = await this.query<{ recentRuns: GameRun[] }>({
      query: LINERA_QUERIES.getRecentRuns,
      variables: { limit },
    });
    return data.recentRuns || [];
  }

  // ============================================
  // REWARD OPERATIONS
  // ============================================

  /**
   * Get player's reward for a tournament
   */
  async getReward(tournamentId: number, owner: string): Promise<TournamentReward | null> {
    const data = await this.query<{ reward: TournamentReward | null }>({
      query: LINERA_QUERIES.getReward,
      variables: { tournamentId, owner },
    });
    return data.reward;
  }

  /**
   * Get all rewards for a player
   */
  async getPlayerRewards(owner: string): Promise<TournamentReward[]> {
    const data = await this.query<{ playerRewards: TournamentReward[] }>({
      query: LINERA_QUERIES.getPlayerRewards,
      variables: { owner },
    });
    return data.playerRewards || [];
  }

  /**
   * Claim tournament reward
   */
  async claimReward(tournamentId: number) {
    return this.mutate({
      query: LINERA_MUTATIONS.claimReward,
      variables: { tournamentId },
    });
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  /**
   * Create a new tournament (admin)
   */
  async createTournament(params: {
    title: string;
    description: string;
    mazeSeed: string;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
    durationDays: number;
    xpRewardPool: number;
  }) {
    return this.mutate({
      query: LINERA_MUTATIONS.createTournament,
      variables: params,
    });
  }

  /**
   * End a tournament (admin)
   */
  async endTournament(tournamentId: number) {
    return this.mutate({
      query: LINERA_MUTATIONS.endTournament,
      variables: { tournamentId },
    });
  }

  // ============================================
  // STATS & UTILITY
  // ============================================

  /**
   * Get platform stats
   */
  async getStats(): Promise<Stats> {
    const data = await this.query<{ stats: Stats }>({
      query: LINERA_QUERIES.getStats,
    });
    return data.stats;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getChainId(): string {
    return LINERA_CONFIG.chainId;
  }

  getAppId(): string {
    return LINERA_CONFIG.appId;
  }
}

// Singleton instance
export const lineraClient = new LineraClient();
export default lineraClient;
