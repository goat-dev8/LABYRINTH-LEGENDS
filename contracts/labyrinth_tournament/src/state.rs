//! Labyrinth Legends - On-chain State Management
//! Uses Linera views for persistent storage

use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext};
use linera_sdk::linera_base_types::AccountOwner;
use crate::{
    Tournament, Player, GameRun, LeaderboardEntry, 
    TournamentParticipant, TournamentReward
};

/// Main application state stored on-chain
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct LabyrinthState {
    // ===== ID Counters =====
    /// Next tournament ID to assign
    pub next_tournament_id: RegisterView<u64>,
    /// Next run ID to assign
    pub next_run_id: RegisterView<u64>,

    // ===== Core Data =====
    /// All tournaments by ID
    pub tournaments: MapView<u64, Tournament>,
    /// All registered players by owner
    pub players: MapView<AccountOwner, Player>,
    /// All game runs by ID
    pub runs: MapView<u64, GameRun>,

    // ===== Tournament Data =====
    /// Tournament participants: (tournament_id, owner) -> TournamentParticipant
    pub tournament_participants: MapView<(u64, AccountOwner), TournamentParticipant>,
    /// Tournament leaderboards: tournament_id -> Vec<LeaderboardEntry>
    pub tournament_leaderboards: MapView<u64, Vec<LeaderboardEntry>>,
    /// Tournament rewards: (tournament_id, owner) -> TournamentReward
    pub tournament_rewards: MapView<(u64, AccountOwner), TournamentReward>,

    // ===== Global Leaderboard =====
    /// Practice mode global leaderboard (top 100)
    pub practice_leaderboard: RegisterView<Vec<LeaderboardEntry>>,
    /// Practice mode leaderboard by difficulty
    pub practice_leaderboard_by_difficulty: MapView<String, Vec<LeaderboardEntry>>,

    // ===== Activity Feed =====
    /// Recent runs (stores last 100 run IDs for activity feed)
    pub recent_run_ids: RegisterView<Vec<u64>>,

    // ===== Lookup Maps =====
    /// Username to owner mapping for Discord lookup
    pub username_to_owner: MapView<String, AccountOwner>,
    /// Player runs: owner -> Vec<run_id>
    pub player_runs: MapView<AccountOwner, Vec<u64>>,
}
