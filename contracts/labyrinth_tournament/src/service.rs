//! Labyrinth Legends - GraphQL Service
//! Tournament-first query interface

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use self::state::LabyrinthState;
use async_graphql::{EmptySubscription, Object, Request, Response, Schema, SimpleObject};
use labyrinth_tournament::{
    Difficulty, Tournament, TournamentStatus, Player, TournamentPlayer,
    GameRun, LeaderboardEntry, TournamentReward, Operation, AccountOwner,
};
use linera_sdk::{
    bcs,
    abi::WithServiceAbi,
    views::View,
    Service,
    ServiceRuntime,
};

pub struct LabyrinthTournamentService {
    state: Arc<LabyrinthState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(LabyrinthTournamentService);

impl WithServiceAbi for LabyrinthTournamentService {
    type Abi = labyrinth_tournament::LabyrinthTournamentContractAbi;
}

impl Service for LabyrinthTournamentService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = LabyrinthState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        LabyrinthTournamentService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Request) -> Response {
        let schema = Schema::build(
            QueryRoot { state: self.state.clone() },
            MutationRoot { runtime: self.runtime.clone() },
            EmptySubscription,
        )
        .finish();
        schema.execute(query).await
    }
}

// ============================================
// QUERY ROOT
// ============================================

struct QueryRoot {
    state: Arc<LabyrinthState>,
}

impl QueryRoot {
    /// Get the default tournament with FIXED parameters.
    /// This ensures all users see the same tournament immediately,
    /// even before any on-chain state is created.
    /// 
    /// CRITICAL: All values are CONSTANTS so every chain gets the same tournament.
    fn get_default_tournament(&self) -> Tournament {
        use linera_sdk::linera_base_types::Timestamp;
        
        // FIXED CONSTANTS - same for ALL chains, ALL users
        // Tournament #1: February 2026 Championship
        const TOURNAMENT_ID: u64 = 1;
        const MAZE_SEED: &str = "labyrinth-feb-2026";
        
        // February 1, 2026 00:00:00 UTC in microseconds
        // 1769904000 seconds since Unix epoch = Feb 1, 2026
        const START_TIME: u64 = 1769904000_000_000;
        
        // Duration: 15 days in microseconds
        const DURATION_MICROS: u64 = 15 * 24 * 60 * 60 * 1_000_000;
        const END_TIME: u64 = START_TIME + DURATION_MICROS;
        
        Tournament {
            id: TOURNAMENT_ID,
            title: "February 2026 Championship".to_string(),
            description: "15-day tournament - fastest time wins!".to_string(),
            maze_seed: MAZE_SEED.to_string(),
            difficulty: Difficulty::Medium,
            start_time: Timestamp::from(START_TIME),
            end_time: Timestamp::from(END_TIME),
            status: TournamentStatus::Active,
            participant_count: 0,
            total_runs: 0,
            xp_reward_pool: 10000,
            created_at: Timestamp::from(START_TIME),
        }
    }
}

/// App stats summary
#[derive(SimpleObject)]
struct Stats {
    total_players: u64,
    total_tournaments: u64,
    total_runs: u64,
    active_tournament_id: Option<u64>,
}

#[Object]
impl QueryRoot {
    // ===== Stats =====
    
    /// Get app-wide statistics
    async fn stats(&self) -> Stats {
        let total_tournaments = *self.state.next_tournament_id.get() - 1;
        let total_runs = *self.state.next_run_id.get() - 1;
        let active_tournament_id = self.state.active_tournament_id.get().clone();
        
        // Count players (approximate - just use next values)
        Stats {
            total_players: total_runs / 10, // Rough estimate
            total_tournaments,
            total_runs,
            active_tournament_id,
        }
    }

    // ===== Tournament Queries =====

    /// Get the currently active tournament.
    /// Returns FIXED tournament data if not yet initialized.
    /// This ensures all users see the same tournament info immediately.
    async fn active_tournament(&self) -> Option<Tournament> {
        // Try to get from state first
        if let Some(id) = *self.state.active_tournament_id.get() {
            if let Ok(Some(tournament)) = self.state.tournaments.get(&id).await {
                return Some(tournament);
            }
        }
        
        // Return FIXED tournament data (same constants as contract)
        // This allows UI to show tournament before any mutation runs
        // CRITICAL: All values are CONSTANTS so every chain gets the same tournament
        Some(self.get_default_tournament())
    }

    /// Get tournament by ID
    async fn tournament(&self, id: u64) -> Option<Tournament> {
        // If asking for tournament 1 and it doesn't exist, return default
        if id == 1 {
            if let Ok(Some(tournament)) = self.state.tournaments.get(&id).await {
                return Some(tournament);
            }
            // Return fixed default tournament
            return Some(self.get_default_tournament());
        }
        self.state.tournaments.get(&id).await.ok().flatten()
    }

    /// Get all tournaments
    async fn tournaments(&self, status: Option<TournamentStatus>) -> Vec<Tournament> {
        let mut result = Vec::new();
        let next_id = *self.state.next_tournament_id.get();

        for id in 1..next_id {
            if let Ok(Some(tournament)) = self.state.tournaments.get(&id).await {
                if status.is_none() || status == Some(tournament.status) {
                    result.push(tournament);
                }
            }
        }

        // Sort by start time descending (newest first)
        result.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        result
    }

    // ===== Leaderboard Queries =====

    /// Get tournament leaderboard (sorted by best time)
    async fn leaderboard(&self, tournament_id: u64, limit: Option<u32>) -> Vec<LeaderboardEntry> {
        let entries = self.state.leaderboards.get(&tournament_id).await.ok().flatten()
            .unwrap_or_default();
        
        let limit = limit.unwrap_or(100) as usize;
        entries.into_iter().take(limit).collect()
    }

    /// Get player's rank in a tournament
    async fn player_rank(&self, tournament_id: u64, owner: String) -> Option<u32> {
        let wallet = parse_wallet_address(&owner)?;
        let entries = self.state.leaderboards.get(&tournament_id).await.ok().flatten()?;
        
        entries.iter()
            .find(|e| e.wallet_address == wallet)
            .map(|e| e.rank)
    }

    // ===== Player Queries =====

    /// Get player by wallet address (hex string, e.g., "0x...")
    async fn player(&self, owner: String) -> Option<Player> {
        let wallet = parse_wallet_address(&owner)?;
        self.state.players.get(&wallet).await.ok().flatten()
    }

    /// Get player by username
    async fn player_by_username(&self, username: String) -> Option<Player> {
        let wallet = self.state.username_to_wallet.get(&username).await.ok().flatten()?;
        self.state.players.get(&wallet).await.ok().flatten()
    }

    /// Check if player is registered
    async fn is_registered(&self, owner: String) -> bool {
        if let Some(wallet) = parse_wallet_address(&owner) {
            self.state.players.contains_key(&wallet).await.unwrap_or(false)
        } else {
            // Try as signer
            if let Some(signer) = parse_account_owner(&owner) {
                self.state.signer_to_wallet.contains_key(&signer).await.unwrap_or(false)
            } else {
                false
            }
        }
    }

    // ===== Tournament Player Queries =====

    /// Get player's stats for a specific tournament
    async fn tournament_player(&self, tournament_id: u64, owner: String) -> Option<TournamentPlayer> {
        let wallet = parse_wallet_address(&owner)?;
        let key = (tournament_id, wallet);
        self.state.tournament_players.get(&key).await.ok().flatten()
    }

    // ===== Run Queries =====

    /// Get run by ID
    async fn run(&self, id: u64) -> Option<GameRun> {
        self.state.runs.get(&id).await.ok().flatten()
    }

    /// Get recent runs (activity feed)
    async fn recent_runs(&self, limit: Option<u32>) -> Vec<GameRun> {
        let limit = limit.unwrap_or(20) as usize;
        let run_ids = self.state.recent_runs.get();
        
        let mut runs = Vec::new();
        for id in run_ids.iter().take(limit) {
            if let Ok(Some(run)) = self.state.runs.get(id).await {
                runs.push(run);
            }
        }
        runs
    }

    // ===== Reward Queries =====

    /// Get player's reward for a tournament
    async fn reward(&self, tournament_id: u64, owner: String) -> Option<TournamentReward> {
        let wallet = parse_wallet_address(&owner)?;
        let key = (tournament_id, wallet);
        self.state.rewards.get(&key).await.ok().flatten()
    }

    /// Get all rewards for a player
    async fn player_rewards(&self, owner: String) -> Vec<TournamentReward> {
        let wallet = match parse_wallet_address(&owner) {
            Some(w) => w,
            None => return Vec::new(),
        };

        let mut rewards = Vec::new();
        let next_id = *self.state.next_tournament_id.get();

        for tournament_id in 1..next_id {
            let key = (tournament_id, wallet);
            if let Ok(Some(reward)) = self.state.rewards.get(&key).await {
                rewards.push(reward);
            }
        }

        rewards
    }
}

// ============================================
// MUTATION ROOT
// ============================================

struct MutationRoot {
    runtime: Arc<ServiceRuntime<LabyrinthTournamentService>>,
}

#[Object]
impl MutationRoot {
    /// Register a new player
    async fn register_player(
        &self,
        wallet_address: Vec<u8>,
        username: String,
    ) -> Vec<u8> {
        let wallet: [u8; 20] = wallet_address.try_into().unwrap_or([0u8; 20]);
        
        let operation = Operation::RegisterPlayer {
            wallet_address: wallet,
            username,
        };
        bcs::to_bytes(&operation).unwrap()
    }

    /// Submit a game run to a tournament
    async fn submit_run(
        &self,
        tournament_id: u64,
        time_ms: u64,
        score: u64,
        coins: u32,
        deaths: u32,
        completed: bool,
    ) -> Vec<u8> {
        let operation = Operation::SubmitRun {
            tournament_id,
            time_ms,
            score,
            coins,
            deaths,
            completed,
        };
        bcs::to_bytes(&operation).unwrap()
    }

    /// Create a new tournament (admin)
    async fn create_tournament(
        &self,
        title: String,
        description: String,
        maze_seed: String,
        difficulty: Difficulty,
        duration_days: u64,
        xp_reward_pool: u64,
    ) -> Vec<u8> {
        let operation = Operation::CreateTournament {
            title,
            description,
            maze_seed,
            difficulty,
            duration_days,
            xp_reward_pool,
        };
        bcs::to_bytes(&operation).unwrap()
    }

    /// End a tournament (admin)
    async fn end_tournament(&self, tournament_id: u64) -> Vec<u8> {
        let operation = Operation::EndTournament { tournament_id };
        bcs::to_bytes(&operation).unwrap()
    }

    /// Claim tournament reward
    async fn claim_reward(&self, tournament_id: u64) -> Vec<u8> {
        let operation = Operation::ClaimReward { tournament_id };
        bcs::to_bytes(&operation).unwrap()
    }
    
    /// Bootstrap tournament #1 (creates if doesn't exist)
    /// This is idempotent - safe to call multiple times
    async fn bootstrap_tournament(&self) -> Vec<u8> {
        let operation = Operation::BootstrapTournament;
        bcs::to_bytes(&operation).unwrap()
    }
}

// ============================================
// HELPERS
// ============================================

/// Parse hex wallet address (0x... or raw hex) to [u8; 20]
fn parse_wallet_address(s: &str) -> Option<[u8; 20]> {
    let hex = s.to_lowercase().trim_start_matches("0x").to_string();
    if hex.len() != 40 {
        return None;
    }
    
    let bytes = hex::decode(&hex).ok()?;
    if bytes.len() != 20 {
        return None;
    }
    
    let mut wallet = [0u8; 20];
    wallet.copy_from_slice(&bytes);
    Some(wallet)
}

/// Parse account owner from various formats
fn parse_account_owner(s: &str) -> Option<AccountOwner> {
    // Try Address20 (40 hex chars, possibly with 0x prefix)
    let hex = s.to_lowercase().trim_start_matches("0x").to_string();
    if hex.len() == 40 {
        if let Ok(bytes) = hex::decode(&hex) {
            if bytes.len() == 20 {
                let mut addr = [0u8; 20];
                addr.copy_from_slice(&bytes);
                return Some(AccountOwner::Address20(addr));
            }
        }
    }
    
    // Try Address32 (64 hex chars)
    if hex.len() == 64 {
        if let Ok(bytes) = hex::decode(&hex) {
            if bytes.len() == 32 {
                let mut addr = [0u8; 32];
                addr.copy_from_slice(&bytes);
                return Some(AccountOwner::Address32(addr.into()));
            }
        }
    }

    None
}
