/**
 * Labyrinth Legends - Linera Blockchain Configuration
 * Tournament-First Architecture - All scoring on-chain
 */

// ============================================
// CHAIN CONFIGURATION
// ============================================

export const LINERA_CONFIG = {
  // Network configuration
  network: 'conway-testnet',
  
  // GraphQL Endpoints
  graphqlEndpoint: import.meta.env.VITE_LINERA_GRAPHQL_ENDPOINT || 'https://linera-graphql-eu.staketab.org',
  faucetUrl: import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net',
  
  // Deployed Chain ID
  chainId: import.meta.env.VITE_LINERA_CHAIN_ID || '5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36',
  
  // Deployed Application ID
  appId: import.meta.env.VITE_LINERA_APP_ID || '6421a8cb15976821a7d70465f07a3875da38ba33c3da6027e79a3af9e154c876',
  
  // Full application endpoint
  get appEndpoint() {
    return `${this.graphqlEndpoint}/chains/${this.chainId}/applications/${this.appId}`;
  },
  
  // Feature flag
  enabled: import.meta.env.VITE_ENABLE_LINERA === 'true',
} as const;

// ============================================
// GRAPHQL QUERIES - Tournament First
// ============================================

export const LINERA_QUERIES = {
  // ===== TOURNAMENT QUERIES =====
  
  // Get active tournament (the one currently accepting runs)
  getActiveTournament: `
    query GetActiveTournament {
      activeTournament {
        id
        title
        description
        mazeSeed
        difficulty
        startTime
        endTime
        status
        participantCount
        totalRuns
        xpRewardPool
      }
    }
  `,
  
  // Get tournament by ID
  getTournament: `
    query GetTournament($id: Int!) {
      tournament(id: $id) {
        id
        title
        description
        mazeSeed
        difficulty
        startTime
        endTime
        status
        participantCount
        totalRuns
        xpRewardPool
      }
    }
  `,
  
  // Get all tournaments (optionally filtered by status)
  getTournaments: `
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
        participantCount
        totalRuns
        xpRewardPool
      }
    }
  `,
  
  // ===== LEADERBOARD QUERIES =====
  
  // Get tournament leaderboard (sorted by best time)
  getLeaderboard: `
    query GetLeaderboard($tournamentId: Int!, $limit: Int) {
      leaderboard(tournamentId: $tournamentId, limit: $limit) {
        walletAddress
        username
        bestTimeMs
        totalRuns
        totalXpEarned
        rank
      }
    }
  `,
  
  // Get player's rank in a tournament
  getPlayerRank: `
    query GetPlayerRank($tournamentId: Int!, $owner: String!) {
      playerRank(tournamentId: $tournamentId, owner: $owner)
    }
  `,
  
  // ===== PLAYER QUERIES =====
  
  // Get player by wallet address
  getPlayer: `
    query GetPlayer($owner: String!) {
      player(owner: $owner) {
        walletAddress
        username
        totalXp
        totalRuns
        tournamentsPlayed
        registeredAt
      }
    }
  `,
  
  // Get player by username
  getPlayerByUsername: `
    query GetPlayerByUsername($username: String!) {
      playerByUsername(username: $username) {
        walletAddress
        username
        totalXp
        totalRuns
        tournamentsPlayed
        registeredAt
      }
    }
  `,
  
  // Check if player is registered
  isRegistered: `
    query IsRegistered($owner: String!) {
      isRegistered(owner: $owner)
    }
  `,
  
  // Get player's tournament stats
  getTournamentPlayer: `
    query GetTournamentPlayer($tournamentId: Int!, $owner: String!) {
      tournamentPlayer(tournamentId: $tournamentId, owner: $owner) {
        walletAddress
        bestTimeMs
        totalRuns
        totalXpEarned
        firstPlayedAt
        lastPlayedAt
      }
    }
  `,
  
  // ===== RUN QUERIES =====
  
  // Get recent runs (activity feed)
  getRecentRuns: `
    query GetRecentRuns($limit: Int) {
      recentRuns(limit: $limit) {
        id
        walletAddress
        username
        tournamentId
        timeMs
        score
        coins
        deaths
        completed
        xpEarned
        timestamp
      }
    }
  `,
  
  // Get single run by ID
  getRun: `
    query GetRun($id: Int!) {
      run(id: $id) {
        id
        walletAddress
        username
        tournamentId
        timeMs
        score
        coins
        deaths
        completed
        xpEarned
        timestamp
      }
    }
  `,
  
  // ===== REWARD QUERIES =====
  
  // Get player's reward for a tournament
  getReward: `
    query GetReward($tournamentId: Int!, $owner: String!) {
      reward(tournamentId: $tournamentId, owner: $owner) {
        tournamentId
        walletAddress
        rank
        xpAmount
        claimed
      }
    }
  `,
  
  // Get all rewards for a player
  getPlayerRewards: `
    query GetPlayerRewards($owner: String!) {
      playerRewards(owner: $owner) {
        tournamentId
        rank
        xpAmount
        claimed
      }
    }
  `,
  
  // ===== STATS =====
  
  // Get platform stats
  getStats: `
    query GetStats {
      stats {
        totalPlayers
        totalTournaments
        totalRuns
        activeTournamentId
      }
    }
  `,
};

// ============================================
// GRAPHQL MUTATIONS - Tournament First
// ============================================

export const LINERA_MUTATIONS = {
  // ===== PLAYER OPERATIONS =====
  
  // Register a new player
  // walletAddress: [u8; 20] as array of integers
  registerPlayer: `
    mutation RegisterPlayer($walletAddress: [Int!]!, $username: String!) {
      registerPlayer(walletAddress: $walletAddress, username: $username)
    }
  `,
  
  // ===== GAME RUN OPERATIONS =====
  
  // Submit a game run to the active tournament
  // This is the MAIN operation - auto-registers player if needed
  submitRun: `
    mutation SubmitRun(
      $tournamentId: Int!
      $timeMs: Int!
      $score: Int!
      $coins: Int!
      $deaths: Int!
      $completed: Boolean!
    ) {
      submitRun(
        tournamentId: $tournamentId
        timeMs: $timeMs
        score: $score
        coins: $coins
        deaths: $deaths
        completed: $completed
      )
    }
  `,
  
  // ===== TOURNAMENT ADMIN OPERATIONS =====
  
  // Create a new tournament (admin only)
  createTournament: `
    mutation CreateTournament(
      $title: String!
      $description: String!
      $mazeSeed: String!
      $difficulty: Difficulty!
      $durationDays: Int!
      $xpRewardPool: Int!
    ) {
      createTournament(
        title: $title
        description: $description
        mazeSeed: $mazeSeed
        difficulty: $difficulty
        durationDays: $durationDays
        xpRewardPool: $xpRewardPool
      )
    }
  `,
  
  // End a tournament (admin only)
  endTournament: `
    mutation EndTournament($tournamentId: Int!) {
      endTournament(tournamentId: $tournamentId)
    }
  `,
  
  // ===== REWARD OPERATIONS =====
  
  // Claim tournament reward
  claimReward: `
    mutation ClaimReward($tournamentId: Int!) {
      claimReward(tournamentId: $tournamentId)
    }
  `,
  
  // ===== BOOTSTRAP OPERATION =====
  
  // Bootstrap tournament #1 if it doesn't exist
  // Safe to call multiple times - idempotent
  bootstrapTournament: `
    mutation BootstrapTournament {
      bootstrapTournament
    }
  `,
};

export default LINERA_CONFIG;
