//! Labyrinth Legends Tournament Contract
//! Types, enums, and Operation definitions

use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

// ============================================
// ENUMS - These become SCREAMING_CASE in GraphQL
// ============================================

/// Game mode - Practice for casual play, Tournament for competitive
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq, Hash)]
pub enum GameMode {
    Practice,    // GraphQL: "PRACTICE" - Always-on global leaderboard
    Tournament,  // GraphQL: "TOURNAMENT" - Time-boxed events
}

/// Tournament status lifecycle
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq)]
pub enum TournamentStatus {
    Upcoming,  // GraphQL: "UPCOMING" - Not yet started
    Active,    // GraphQL: "ACTIVE" - Currently running
    Ended,     // GraphQL: "ENDED" - Completed
}

/// Difficulty levels affecting maze size and XP rewards
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq, Hash)]
pub enum Difficulty {
    Easy,       // GraphQL: "EASY" - 6x6 maze, 100 base XP
    Medium,     // GraphQL: "MEDIUM" - 10x10 maze, 200 base XP
    Hard,       // GraphQL: "HARD" - 15x15 maze, 400 base XP
    Nightmare,  // GraphQL: "NIGHTMARE" - 20x20 maze, 800 base XP
}

impl Difficulty {
    pub fn base_xp(&self) -> u64 {
        match self {
            Difficulty::Easy => 100,
            Difficulty::Medium => 200,
            Difficulty::Hard => 400,
            Difficulty::Nightmare => 800,
        }
    }
}

// ============================================
// DATA STRUCTURES
// ============================================

/// Tournament configuration and state
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Tournament {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub difficulty: Difficulty,
    pub maze_seed: String,                     // Same maze for all players
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub max_attempts_per_player: Option<u32>,  // None = unlimited
    pub xp_reward_pool: u64,                   // Total XP to distribute
    pub status: TournamentStatus,
    pub created_at: Timestamp,
    pub creator: AccountOwner,
    pub participant_count: u32,
}

/// Player profile and stats
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Player {
    pub owner: AccountOwner,
    pub username: String,                      // For Discord identification
    pub discord_tag: Option<String>,           // e.g., "player#1234"
    pub total_xp: u64,
    pub practice_runs: u64,
    pub tournament_runs: u64,
    pub best_practice_time_ms: Option<u64>,
    pub tournaments_played: u32,
    pub tournaments_won: u32,
    pub registered_at: Timestamp,
}

/// Record of a single game run
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct GameRun {
    pub id: u64,
    pub owner: AccountOwner,
    pub username: String,
    pub mode: GameMode,
    pub tournament_id: Option<u64>,
    pub difficulty: Difficulty,
    pub level_reached: u32,
    pub time_ms: u64,
    pub deaths: u32,
    pub completed: bool,
    pub xp_earned: u64,
    pub created_at: Timestamp,
}

/// Leaderboard entry with ranking
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub owner: AccountOwner,
    pub username: String,
    pub best_time_ms: u64,
    pub total_runs: u32,
    pub total_xp: u64,
}

/// Tournament participant tracking
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct TournamentParticipant {
    pub owner: AccountOwner,
    pub username: String,
    pub attempts_used: u32,
    pub best_time_ms: Option<u64>,
    pub best_run_id: Option<u64>,
    pub joined_at: Timestamp,
}

/// Tournament reward for claiming
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct TournamentReward {
    pub tournament_id: u64,
    pub owner: AccountOwner,
    pub rank: u32,
    pub xp_amount: u64,
    pub claimed: bool,
}

// ============================================
// OPERATIONS (Mutations requiring wallet signature)
// ============================================

#[derive(Debug, Deserialize, Serialize)]
pub enum Operation {
    // ===== Player Registration =====
    RegisterPlayer {
        username: String,
        discord_tag: Option<String>,
    },
    UpdateProfile {
        username: Option<String>,
        discord_tag: Option<String>,
    },

    // ===== Tournament Management =====
    CreateTournament {
        title: String,
        description: String,
        difficulty: Difficulty,
        maze_seed: String,
        start_time: Timestamp,
        end_time: Timestamp,
        max_attempts_per_player: Option<u32>,
        xp_reward_pool: u64,
    },
    UpdateTournamentStatus {
        tournament_id: u64,
        status: TournamentStatus,
    },

    // ===== Player Actions =====
    JoinTournament {
        tournament_id: u64,
    },
    SubmitRun {
        mode: GameMode,
        tournament_id: Option<u64>,
        difficulty: Difficulty,
        level_reached: u32,
        time_ms: u64,
        deaths: u32,
        completed: bool,
    },
    ClaimTournamentReward {
        tournament_id: u64,
    },
}

// ============================================
// RESPONSES
// ============================================

#[derive(Debug, Deserialize, Serialize)]
pub enum Response {
    Ok,
    PlayerRegistered { owner: AccountOwner },
    ProfileUpdated { owner: AccountOwner },
    TournamentCreated { id: u64 },
    TournamentStatusUpdated { id: u64, status: TournamentStatus },
    TournamentJoined { tournament_id: u64, participant_count: u32 },
    RunSubmitted { run_id: u64, xp_earned: u64 },
    RewardClaimed { tournament_id: u64, xp_amount: u64 },
    Error { message: String },
}

// ============================================
// INITIALIZATION
// ============================================

/// Initialization parameters for the application
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InitializationArgument {
    pub hub_chain_id: String,
}

// ============================================
// ABI DEFINITION  
// ============================================

use linera_sdk::abi::{ContractAbi, ServiceAbi};

/// ABI type for the Labyrinth Tournament contract
pub struct LabyrinthTournamentContractAbi;

impl ContractAbi for LabyrinthTournamentContractAbi {
    type Operation = Operation;
    type Response = Response;
}

impl ServiceAbi for LabyrinthTournamentContractAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}
