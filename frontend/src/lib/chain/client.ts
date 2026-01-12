/**
 * Labyrinth Legends - Linera GraphQL Client
 * Handles all blockchain interactions
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
  // PLAYER OPERATIONS
  // ============================================

  async getPlayer(owner: string) {
    const data = await this.query<{ player: any }>({
      query: LINERA_QUERIES.getPlayer,
      variables: { owner },
    });
    return data.player;
  }

  async registerPlayer(username: string, discordTag?: string) {
    return this.mutate({
      query: LINERA_MUTATIONS.registerPlayer,
      variables: { username, discordTag },
    });
  }

  async updateProfile(username?: string, discordTag?: string) {
    return this.mutate({
      query: LINERA_MUTATIONS.updateProfile,
      variables: { username, discordTag },
    });
  }

  // ============================================
  // TOURNAMENT OPERATIONS
  // ============================================

  async getTournaments(status?: string) {
    const data = await this.query<{ tournaments: any[] }>({
      query: LINERA_QUERIES.getTournaments,
      variables: { status },
    });
    return data.tournaments;
  }

  async getTournament(id: number) {
    const data = await this.query<{ tournament: any; tournamentLeaderboard: any[] }>({
      query: LINERA_QUERIES.getTournament,
      variables: { id },
    });
    return data;
  }

  async createTournament(params: {
    title: string;
    description: string;
    difficulty: string;
    mazeSeed: string;
    startTime: number;
    endTime: number;
    maxAttemptsPerPlayer?: number;
    xpRewardPool: number;
  }) {
    return this.mutate({
      query: LINERA_MUTATIONS.createTournament,
      variables: params,
    });
  }

  async joinTournament(tournamentId: number) {
    return this.mutate({
      query: LINERA_MUTATIONS.joinTournament,
      variables: { tournamentId },
    });
  }

  // ============================================
  // GAME RUN OPERATIONS
  // ============================================

  async submitRun(params: {
    mode: string;
    tournamentId?: number;
    difficulty: string;
    levelReached: number;
    timeMs: number;
    deaths: number;
    completed: boolean;
  }) {
    return this.mutate({
      query: LINERA_MUTATIONS.submitRun,
      variables: params,
    });
  }

  async getPlayerRuns(owner: string, limit = 50) {
    const data = await this.query<{ playerRuns: any[] }>({
      query: LINERA_QUERIES.getPlayerRuns,
      variables: { owner, limit },
    });
    return data.playerRuns;
  }

  // ============================================
  // LEADERBOARD OPERATIONS
  // ============================================

  async getPracticeLeaderboard(difficulty?: string, limit = 100) {
    const data = await this.query<{ practiceLeaderboard: any[] }>({
      query: LINERA_QUERIES.getPracticeLeaderboard,
      variables: { difficulty, limit },
    });
    return data.practiceLeaderboard;
  }

  // ============================================
  // STATS & MISC
  // ============================================

  async getStats() {
    const data = await this.query<{ stats: any }>({
      query: LINERA_QUERIES.getStats,
    });
    return data.stats;
  }

  async claimTournamentReward(tournamentId: number) {
    return this.mutate({
      query: LINERA_MUTATIONS.claimTournamentReward,
      variables: { tournamentId },
    });
  }

  // ============================================
  // UTILITY
  // ============================================

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
