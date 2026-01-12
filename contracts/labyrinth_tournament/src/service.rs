//! Labyrinth Legends - GraphQL Service
//! Provides query interface for frontend

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use self::state::LabyrinthState;
use async_graphql::{EmptySubscription, Object, Request, Response, Schema, SimpleObject};
use labyrinth_tournament::{
    Difficulty, GameMode, GameRun, LeaderboardEntry, Operation, Player, Tournament,
    TournamentParticipant, TournamentReward, TournamentStatus,
};
use linera_sdk::{
    linera_base_types::AccountOwner, 
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

struct QueryRoot {
    state: Arc<LabyrinthState>,
}

/// Statistics response
#[derive(SimpleObject)]
struct Stats {
    total_players: u64,
    total_tournaments: u64,
    total_runs: u64,
    active_tournaments: u64,
}

/// Paginated response wrapper
#[derive(SimpleObject)]
struct PaginatedRuns {
    runs: Vec<GameRun>,
    total: u64,
    has_more: bool,
}

#[Object]
impl QueryRoot {
    // ===== Player Queries =====

    /// Get player by owner address
    async fn player(&self, owner: String) -> Option<Player> {
        let owner = parse_account_owner(&owner)?;
        self.state.players.get(&owner).await.ok().flatten()
    }

    /// Get player by username
    async fn player_by_username(&self, username: String) -> Option<Player> {
        let owner = self
            .state
            .username_to_owner
            .get(&username)
            .await
            .ok()
            .flatten()?;
        self.state.players.get(&owner).await.ok().flatten()
    }

    /// Check if player is registered
    async fn is_registered(&self, owner: String) -> bool {
        if let Some(owner) = parse_account_owner(&owner) {
            self.state
                .players
                .contains_key(&owner)
                .await
                .unwrap_or(false)
        } else {
            false
        }
    }

    // ===== Tournament Queries =====

    /// Get tournament by ID
    async fn tournament(&self, id: u64) -> Option<Tournament> {
        self.state.tournaments.get(&id).await.ok().flatten()
    }

    /// Get all tournaments with optional status filter
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

        // Sort by start time descending
        result.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        result
    }

    /// Get active tournaments
    async fn active_tournaments(&self) -> Vec<Tournament> {
        let mut result = Vec::new();
        let next_id = *self.state.next_tournament_id.get();
        for id in 1..next_id {
            if let Ok(Some(tournament)) = self.state.tournaments.get(&id).await {
                if tournament.status == TournamentStatus::Active {
                    result.push(tournament);
                }
            }
        }
        result.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        result
    }

    /// Get upcoming tournaments
    async fn upcoming_tournaments(&self) -> Vec<Tournament> {
        let mut result = Vec::new();
        let next_id = *self.state.next_tournament_id.get();
        for id in 1..next_id {
            if let Ok(Some(tournament)) = self.state.tournaments.get(&id).await {
                if tournament.status == TournamentStatus::Upcoming {
                    result.push(tournament);
                }
            }
        }
        result.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        result
    }

    /// Get tournament leaderboard
    async fn tournament_leaderboard(&self, tournament_id: u64) -> Vec<LeaderboardEntry> {
        self.state
            .tournament_leaderboards
            .get(&tournament_id)
            .await
            .ok()
            .flatten()
            .unwrap_or_default()
    }

    /// Get tournament participant info
    async fn tournament_participant(
        &self,
        tournament_id: u64,
        owner: String,
    ) -> Option<TournamentParticipant> {
        let owner = parse_account_owner(&owner)?;
        let key = (tournament_id, owner);
        self.state
            .tournament_participants
            .get(&key)
            .await
            .ok()
            .flatten()
    }

    /// Check if player has joined tournament
    async fn has_joined_tournament(&self, tournament_id: u64, owner: String) -> bool {
        if let Some(owner) = parse_account_owner(&owner) {
            let key = (tournament_id, owner);
            self.state
                .tournament_participants
                .contains_key(&key)
                .await
                .unwrap_or(false)
        } else {
            false
        }
    }

    /// Get tournament reward for player
    async fn tournament_reward(&self, tournament_id: u64, owner: String) -> Option<TournamentReward> {
        let owner = parse_account_owner(&owner)?;
        let key = (tournament_id, owner);
        self.state.tournament_rewards.get(&key).await.ok().flatten()
    }

    // ===== Leaderboard Queries =====

    /// Get global practice leaderboard
    async fn practice_leaderboard(&self, limit: Option<u32>) -> Vec<LeaderboardEntry> {
        let leaderboard = self.state.practice_leaderboard.get().clone();
        let limit = limit.unwrap_or(100) as usize;
        leaderboard.into_iter().take(limit).collect()
    }

    // ===== Run Queries =====

    /// Get run by ID
    async fn run(&self, id: u64) -> Option<GameRun> {
        self.state.runs.get(&id).await.ok().flatten()
    }

    /// Get recent runs
    async fn recent_runs(&self, limit: Option<u32>) -> Vec<GameRun> {
        let limit = limit.unwrap_or(20) as usize;
        let run_ids = self.state.recent_run_ids.get();
        let mut runs = Vec::new();

        for id in run_ids.iter().take(limit) {
            if let Ok(Some(run)) = self.state.runs.get(id).await {
                runs.push(run);
            }
        }

        runs
    }

    /// Get runs by player
    async fn player_runs(&self, owner: String, limit: Option<u32>) -> Vec<GameRun> {
        let owner = match parse_account_owner(&owner) {
            Some(o) => o,
            None => return Vec::new(),
        };

        let limit = limit.unwrap_or(50) as usize;
        let run_ids = self
            .state
            .player_runs
            .get(&owner)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let mut runs = Vec::new();
        for id in run_ids.iter().rev().take(limit) {
            if let Ok(Some(run)) = self.state.runs.get(id).await {
                runs.push(run);
            }
        }

        runs
    }

    // ===== Stats Queries =====

    /// Get global statistics
    async fn stats(&self) -> Stats {
        let total_runs = *self.state.next_run_id.get() - 1;
        let total_tournaments = *self.state.next_tournament_id.get() - 1;

        // Count active tournaments
        let mut active_tournaments = 0;
        for id in 1..=total_tournaments {
            if let Ok(Some(t)) = self.state.tournaments.get(&id).await {
                if t.status == TournamentStatus::Active {
                    active_tournaments += 1;
                }
            }
        }

        // Estimate total players from leaderboard
        let total_players = self.state.practice_leaderboard.get().len() as u64;

        Stats {
            total_players,
            total_tournaments,
            total_runs,
            active_tournaments,
        }
    }
}

/// Mutation root - delegates to contract operations
struct MutationRoot {
    runtime: Arc<ServiceRuntime<LabyrinthTournamentService>>,
}

#[Object]
impl MutationRoot {
    /// Register a new player
    async fn register_player(&self, username: String, discord_tag: Option<String>) -> [u8; 0] {
        let operation = Operation::RegisterPlayer { username, discord_tag };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Update player profile
    async fn update_profile(&self, username: Option<String>, discord_tag: Option<String>) -> [u8; 0] {
        let operation = Operation::UpdateProfile { username, discord_tag };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Create a tournament
    async fn create_tournament(
        &self,
        title: String,
        description: String,
        difficulty: Difficulty,
        maze_seed: String,
        start_time: u64,
        end_time: u64,
        max_attempts_per_player: Option<u32>,
        xp_reward_pool: u64,
    ) -> [u8; 0] {
        let operation = Operation::CreateTournament {
            title,
            description,
            difficulty,
            maze_seed,
            start_time: start_time.into(),
            end_time: end_time.into(),
            max_attempts_per_player,
            xp_reward_pool,
        };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Update tournament status
    async fn update_tournament_status(
        &self,
        tournament_id: u64,
        status: TournamentStatus,
    ) -> [u8; 0] {
        let operation = Operation::UpdateTournamentStatus { tournament_id, status };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Join a tournament
    async fn join_tournament(&self, tournament_id: u64) -> [u8; 0] {
        let operation = Operation::JoinTournament { tournament_id };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Submit a game run
    async fn submit_run(
        &self,
        mode: GameMode,
        tournament_id: Option<u64>,
        difficulty: Difficulty,
        level_reached: u32,
        time_ms: u64,
        deaths: u32,
        completed: bool,
    ) -> [u8; 0] {
        let operation = Operation::SubmitRun {
            mode,
            tournament_id,
            difficulty,
            level_reached,
            time_ms,
            deaths,
            completed,
        };
        self.runtime.schedule_operation(&operation);
        []
    }

    /// Claim tournament reward
    async fn claim_tournament_reward(&self, tournament_id: u64) -> [u8; 0] {
        let operation = Operation::ClaimTournamentReward { tournament_id };
        self.runtime.schedule_operation(&operation);
        []
    }
}

// Helper function to parse account owner from string
fn parse_account_owner(s: &str) -> Option<AccountOwner> {
    // Handle hex-encoded owner
    if s.starts_with("0x") {
        // Convert hex string to bytes and create owner
        let hex = s.strip_prefix("0x")?;
        let bytes = hex::decode(hex).ok()?;
        if bytes.len() == 20 {
            // 20-byte Ethereum-style address
            let mut arr = [0u8; 20];
            arr.copy_from_slice(&bytes);
            return Some(AccountOwner::Address20(arr));
        } else if bytes.len() == 32 {
            // 32-byte address (CryptoHash)
            let arr: [u8; 32] = bytes.try_into().ok()?;
            return Some(AccountOwner::Address32(linera_sdk::linera_base_types::CryptoHash::from(arr)));
        }
    }
    None
}
