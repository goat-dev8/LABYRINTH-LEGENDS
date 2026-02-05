//! Labyrinth Legends - Tournament-First Architecture
//! 15-day on-chain tournaments with instant gameplay
//!
//! DESIGN PRINCIPLES:
//! 1. Smart contract is the source of truth
//! 2. Frontend starts gameplay instantly (no waiting)
//! 3. All scoring/XP/leaderboard logic is on-chain
//! 4. Backend is optional cache/indexer only

use linera_sdk::linera_base_types::Timestamp;

// Re-export AccountOwner for service.rs
pub use linera_sdk::linera_base_types::AccountOwner;
use serde::{Deserialize, Serialize};

// ============================================
// ENUMS
// ============================================

/// Tournament status lifecycle
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq)]
pub enum TournamentStatus {
    Active,    // Currently accepting submissions
    Ended,     // Completed, leaderboard frozen
}

/// Difficulty levels (affects XP calculation)
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq, Hash)]
pub enum Difficulty {
    Easy,       // Base XP: 75
    Medium,     // Base XP: 100
    Hard,       // Base XP: 125
    Nightmare,  // Base XP: 150
}

impl Difficulty {
    pub fn base_xp(&self) -> u64 {
        match self {
            Difficulty::Easy => 75,
            Difficulty::Medium => 100,
            Difficulty::Hard => 125,
            Difficulty::Nightmare => 150,
        }
    }
}

// ============================================
// CORE DATA STRUCTURES
// ============================================

/// Tournament configuration and state
/// A tournament runs for a fixed period (e.g., 15 days)
/// All players compete on the same maze seed
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Tournament {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub maze_seed: String,              // Same maze for all players
    pub difficulty: Difficulty,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub status: TournamentStatus,
    pub participant_count: u32,
    pub total_runs: u64,
    pub xp_reward_pool: u64,            // XP to distribute to top players
    pub created_at: Timestamp,
}

/// Player stats within a specific tournament
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct TournamentPlayer {
    pub wallet_address: [u8; 20],
    pub username: String,
    pub best_time_ms: u64,              // Best completion time (lower = better)
    pub best_score: u64,                // Best score (higher = better)
    pub total_runs: u32,
    pub total_xp_earned: u64,
    pub last_run_at: Timestamp,
    pub joined_at: Timestamp,
}

/// Global player profile (aggregates all tournament stats)
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Player {
    pub wallet_address: [u8; 20],
    pub username: String,
    pub total_xp: u64,
    pub total_runs: u64,
    pub tournaments_played: u32,
    pub tournaments_won: u32,
    pub best_time_ms: Option<u64>,      // Best time across all tournaments
    pub registered_at: Timestamp,
    pub last_active: Timestamp,
}

/// Single game run record
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct GameRun {
    pub id: u64,
    pub tournament_id: u64,
    pub wallet_address: [u8; 20],
    pub username: String,
    pub time_ms: u64,
    pub score: u64,
    pub coins: u32,
    pub deaths: u32,
    pub completed: bool,
    pub xp_earned: u64,
    pub created_at: Timestamp,
}

/// Leaderboard entry (sorted by best_time_ms ascending)
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub wallet_address: [u8; 20],
    pub username: String,
    pub best_time_ms: u64,
    pub best_score: u64,
    pub total_runs: u32,
    pub total_xp: u64,
}

/// Tournament rewards for top players
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct TournamentReward {
    pub tournament_id: u64,
    pub wallet_address: [u8; 20],
    pub rank: u32,
    pub xp_amount: u64,
    pub claimed: bool,
}

// ============================================
// XP CALCULATION
// ============================================

impl Difficulty {
    /// Calculate XP earned for a run
    /// Formula: base_xp + completion_bonus + time_bonus - death_penalty
    pub fn calculate_xp(&self, time_ms: u64, deaths: u32, completed: bool) -> u64 {
        let base = self.base_xp();
        
        // Completion bonus: +100% of base if completed
        let completion_bonus = if completed { base } else { 0 };
        
        // Time bonus: up to +100% of base for fast completion (under 2 min)
        let time_secs = time_ms / 1000;
        let time_bonus = if completed && time_secs < 120 {
            (base * (120 - time_secs)) / 120
        } else {
            0
        };
        
        // Death penalty: -10% per death, max 50%
        let death_penalty = std::cmp::min(deaths as u64 * 10, 50);
        let death_multiplier = 100 - death_penalty;
        
        // Final calculation
        let raw_xp = (base + completion_bonus + time_bonus) * death_multiplier / 100;
        std::cmp::max(10, raw_xp)  // Minimum 10 XP
    }
}

// ============================================
// CROSS-CHAIN MESSAGES
// ============================================

/// Messages sent between chains for state synchronization
/// All tournament state updates go through the hub chain
#[derive(Debug, Deserialize, Serialize)]
pub enum Message {
    /// Apply a run submission to hub chain state
    /// Sent from user chain to hub chain
    ApplyRun {
        wallet_address: [u8; 20],
        username: String,
        tournament_id: u64,
        time_ms: u64,
        score: u64,
        coins: u32,
        deaths: u32,
        completed: bool,
    },
}

// ============================================
// OPERATIONS (Mutations)
// ============================================

#[derive(Debug, Deserialize, Serialize)]
pub enum Operation {
    /// Register a new player (wallet binding)
    /// Called automatically on first submitRun if player doesn't exist
    RegisterPlayer {
        wallet_address: [u8; 20],
        username: String,
    },
    
    /// Submit a game run to a tournament
    /// This is the PRIMARY gameplay operation
    /// - Auto-registers player if not exists
    /// - Validates tournament is active
    /// - Updates player stats and leaderboard
    SubmitRun {
        tournament_id: u64,
        time_ms: u64,
        score: u64,
        coins: u32,
        deaths: u32,
        completed: bool,
    },
    
    /// Create a new tournament (admin only)
    CreateTournament {
        title: String,
        description: String,
        maze_seed: String,
        difficulty: Difficulty,
        duration_days: u64,
        xp_reward_pool: u64,
    },
    
    /// End a tournament and compute rewards (admin only)
    EndTournament {
        tournament_id: u64,
    },
    
    /// Claim XP reward from ended tournament
    ClaimReward {
        tournament_id: u64,
    },
    
    /// Bootstrap the 15-day tournament #1 if it doesn't exist
    /// This is a workaround for instantiate not persisting state
    /// Can be called by anyone - idempotent (no-op if tournament exists)
    BootstrapTournament,
}

// ============================================
// RESPONSES
// ============================================

#[derive(Debug, Deserialize, Serialize)]
pub enum Response {
    Ok,
    
    PlayerRegistered {
        wallet_address: [u8; 20],
    },
    
    RunSubmitted {
        run_id: u64,
        xp_earned: u64,
        new_best: bool,
        rank: u32,
    },
    
    TournamentCreated {
        id: u64,
        maze_seed: String,
        end_time: Timestamp,
    },
    
    TournamentEnded {
        id: u64,
        winner_count: u32,
    },
    
    RewardClaimed {
        tournament_id: u64,
        xp_amount: u64,
    },
    
    TournamentBootstrapped {
        id: u64,
        end_time: Timestamp,
        already_existed: bool,
    },
    
    Error {
        message: String,
    },
}

// ============================================
// INITIALIZATION
// ============================================

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct InitializationArgument {
    pub hub_chain_id: String,
}

// ============================================
// ABI DEFINITION  
// ============================================

use linera_sdk::abi::{ContractAbi, ServiceAbi};

pub struct LabyrinthTournamentContractAbi;

impl ContractAbi for LabyrinthTournamentContractAbi {
    type Operation = Operation;
    type Response = Response;
}

impl ServiceAbi for LabyrinthTournamentContractAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}
