//! Labyrinth Legends - Simplified Tournament State
//! Optimized for tournament-first architecture

use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext};
use labyrinth_tournament::{
    Tournament, Player, GameRun, TournamentPlayer, LeaderboardEntry, TournamentReward
};

/// Main application state - tournament-focused
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct LabyrinthState {
    // ===== Hub Chain Config =====
    /// The hub chain ID where all tournament state is authoritative
    pub hub_chain_id: RegisterView<Option<String>>,

    // ===== ID Counters =====
    /// Next tournament ID
    pub next_tournament_id: RegisterView<u64>,
    /// Next run ID
    pub next_run_id: RegisterView<u64>,

    // ===== Identity =====
    /// Maps auto-signer -> wallet address (for identity binding)
    pub signer_to_wallet: MapView<linera_sdk::linera_base_types::AccountOwner, [u8; 20]>,

    // ===== Tournaments =====
    /// All tournaments by ID (for historical lookup)
    pub tournaments: MapView<u64, Tournament>,
    /// Active tournament ID (only one active at a time for simplicity)
    pub active_tournament_id: RegisterView<Option<u64>>,
    /// DIRECT ACCESS: The currently active tournament stored in a RegisterView
    /// This allows direct mutation without MapView clone issues
    pub active_tournament: RegisterView<Option<Tournament>>,

    // ===== Players =====
    /// Global player profiles by wallet address
    pub players: MapView<[u8; 20], Player>,
    /// Username -> wallet mapping (for lookup)
    pub username_to_wallet: MapView<String, [u8; 20]>,

    // ===== Tournament Players =====
    /// Tournament participants: (tournament_id, wallet) -> TournamentPlayer
    pub tournament_players: MapView<(u64, [u8; 20]), TournamentPlayer>,

    // ===== Leaderboards =====
    /// Tournament leaderboards: tournament_id -> Vec<LeaderboardEntry>
    /// Sorted by best_time_ms ascending (lower = better)
    pub leaderboards: MapView<u64, Vec<LeaderboardEntry>>,

    // ===== Runs =====
    /// All game runs by ID
    pub runs: MapView<u64, GameRun>,
    /// Recent run IDs (last 100 for activity feed)
    pub recent_runs: RegisterView<Vec<u64>>,

    // ===== Rewards =====
    /// Tournament rewards: (tournament_id, wallet) -> TournamentReward
    pub rewards: MapView<(u64, [u8; 20]), TournamentReward>,
}
