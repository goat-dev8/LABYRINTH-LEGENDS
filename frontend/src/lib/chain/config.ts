/**
 * Labyrinth Legends - Linera Blockchain Configuration
 * Auto-generated with deployed chain and application IDs
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
  appId: import.meta.env.VITE_LINERA_APP_ID || '14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a',
  
  // Full application endpoint
  get appEndpoint() {
    return `${this.graphqlEndpoint}/chains/${this.chainId}/applications/${this.appId}`;
  },
  
  // Feature flag
  enabled: import.meta.env.VITE_ENABLE_LINERA === 'true',
} as const;

// ============================================
// GRAPHQL QUERIES
// ============================================

export const LINERA_QUERIES = {
  // Get player data
  getPlayer: `
    query GetPlayer($owner: String!) {
      player(owner: $owner) {
        owner
        username
        discordTag
        xp
        gamesPlayed
        bestTime
        bestLevel
        createdAt
      }
    }
  `,
  
  // Get all tournaments
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
        creator
        participantCount
        totalRuns
        xpRewardPool
        maxAttemptsPerPlayer
      }
    }
  `,
  
  // Get tournament details with leaderboard
  getTournament: `
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
  `,
  
  // Get practice leaderboard
  getPracticeLeaderboard: `
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
  `,
  
  // Get player's runs
  getPlayerRuns: `
    query GetPlayerRuns($owner: String!, $limit: Int) {
      playerRuns(owner: $owner, limit: $limit) {
        id
        owner
        mode
        tournamentId
        difficulty
        levelReached
        timeMs
        deaths
        completed
        xpEarned
        timestamp
      }
    }
  `,
  
  // Get platform stats
  getStats: `
    query GetStats {
      stats {
        totalPlayers
        totalTournaments
        totalRuns
        activeTournaments
      }
    }
  `,
};

// ============================================
// GRAPHQL MUTATIONS
// ============================================

export const LINERA_MUTATIONS = {
  // Register a new player
  registerPlayer: `
    mutation RegisterPlayer($username: String!, $discordTag: String) {
      registerPlayer(username: $username, discordTag: $discordTag)
    }
  `,
  
  // Update player profile
  updateProfile: `
    mutation UpdateProfile($username: String, $discordTag: String) {
      updateProfile(username: $username, discordTag: $discordTag)
    }
  `,
  
  // Create a tournament
  createTournament: `
    mutation CreateTournament(
      $title: String!
      $description: String!
      $difficulty: Difficulty!
      $mazeSeed: String!
      $startTime: Int!
      $endTime: Int!
      $maxAttemptsPerPlayer: Int
      $xpRewardPool: Int!
    ) {
      createTournament(
        title: $title
        description: $description
        difficulty: $difficulty
        mazeSeed: $mazeSeed
        startTime: $startTime
        endTime: $endTime
        maxAttemptsPerPlayer: $maxAttemptsPerPlayer
        xpRewardPool: $xpRewardPool
      )
    }
  `,
  
  // Join a tournament
  joinTournament: `
    mutation JoinTournament($tournamentId: Int!) {
      joinTournament(tournamentId: $tournamentId)
    }
  `,
  
  // Submit a game run
  submitRun: `
    mutation SubmitRun(
      $mode: GameMode!
      $tournamentId: Int
      $difficulty: Difficulty!
      $levelReached: Int!
      $timeMs: Int!
      $deaths: Int!
      $completed: Boolean!
    ) {
      submitRun(
        mode: $mode
        tournamentId: $tournamentId
        difficulty: $difficulty
        levelReached: $levelReached
        timeMs: $timeMs
        deaths: $deaths
        completed: $completed
      )
    }
  `,
  
  // Claim tournament reward
  claimTournamentReward: `
    mutation ClaimTournamentReward($tournamentId: Int!) {
      claimTournamentReward(tournamentId: $tournamentId)
    }
  `,
};

export default LINERA_CONFIG;
