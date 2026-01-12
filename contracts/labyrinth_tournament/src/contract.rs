//! Labyrinth Legends - Contract Logic
//! Handles all operations and business logic

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use self::state::LabyrinthState;
use labyrinth_tournament::{
    Difficulty, GameMode, GameRun, InitializationArgument, LeaderboardEntry,
    Operation, Player, Response, Tournament, TournamentParticipant,
    TournamentReward, TournamentStatus,
};
use linera_sdk::{
    linera_base_types::AccountOwner,
    abi::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

pub struct LabyrinthTournamentContract {
    state: LabyrinthState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(LabyrinthTournamentContract);

impl WithContractAbi for LabyrinthTournamentContract {
    type Abi = labyrinth_tournament::LabyrinthTournamentContractAbi;
}

impl Contract for LabyrinthTournamentContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = InitializationArgument;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = LabyrinthState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        LabyrinthTournamentContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        // Initialize counters
        self.state.next_tournament_id.set(1);
        self.state.next_run_id.set(1);
        self.state.practice_leaderboard.set(Vec::new());
        self.state.recent_run_ids.set(Vec::new());
    }

    async fn execute_operation(&mut self, operation: Operation) -> Response {
        // Get authenticated signer
        let owner = match self.runtime.authenticated_signer() {
            Some(signer) => AccountOwner::from(signer),
            None => {
                return Response::Error {
                    message: "Not authenticated".to_string(),
                }
            }
        };

        match operation {
            // ===== Player Registration =====
            Operation::RegisterPlayer {
                username,
                discord_tag,
            } => self.register_player(owner, username, discord_tag).await,

            Operation::UpdateProfile {
                username,
                discord_tag,
            } => self.update_profile(owner, username, discord_tag).await,

            // ===== Tournament Management =====
            Operation::CreateTournament {
                title,
                description,
                difficulty,
                maze_seed,
                start_time,
                end_time,
                max_attempts_per_player,
                xp_reward_pool,
            } => {
                self.create_tournament(
                    owner,
                    title,
                    description,
                    difficulty,
                    maze_seed,
                    start_time,
                    end_time,
                    max_attempts_per_player,
                    xp_reward_pool,
                )
                .await
            }

            Operation::UpdateTournamentStatus {
                tournament_id,
                status,
            } => {
                self.update_tournament_status(owner, tournament_id, status)
                    .await
            }

            // ===== Player Actions =====
            Operation::JoinTournament { tournament_id } => {
                self.join_tournament(owner, tournament_id).await
            }

            Operation::SubmitRun {
                mode,
                tournament_id,
                difficulty,
                level_reached,
                time_ms,
                deaths,
                completed,
            } => {
                self.submit_run(
                    owner,
                    mode,
                    tournament_id,
                    difficulty,
                    level_reached,
                    time_ms,
                    deaths,
                    completed,
                )
                .await
            }

            Operation::ClaimTournamentReward { tournament_id } => {
                self.claim_tournament_reward(owner, tournament_id).await
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {
        // No cross-chain messages in this version
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl LabyrinthTournamentContract {
    // ===== Player Registration =====

    async fn register_player(
        &mut self,
        owner: AccountOwner,
        username: String,
        discord_tag: Option<String>,
    ) -> Response {
        // Check if already registered
        if self.state.players.contains_key(&owner).await.unwrap_or(false) {
            return Response::Error {
                message: "Player already registered".to_string(),
            };
        }

        // Check username uniqueness
        if self
            .state
            .username_to_owner
            .contains_key(&username)
            .await
            .unwrap_or(false)
        {
            return Response::Error {
                message: "Username already taken".to_string(),
            };
        }

        let now = self.runtime.system_time();

        let player = Player {
            owner: owner.clone(),
            username: username.clone(),
            discord_tag,
            total_xp: 0,
            practice_runs: 0,
            tournament_runs: 0,
            best_practice_time_ms: None,
            tournaments_played: 0,
            tournaments_won: 0,
            registered_at: now,
        };

        self.state.players.insert(&owner, player).unwrap();
        self.state.username_to_owner.insert(&username, owner.clone()).unwrap();
        self.state.player_runs.insert(&owner, Vec::new()).unwrap();

        Response::PlayerRegistered { owner }
    }

    async fn update_profile(
        &mut self,
        owner: AccountOwner,
        username: Option<String>,
        discord_tag: Option<String>,
    ) -> Response {
        let mut player = match self.state.players.get(&owner).await.unwrap() {
            Some(p) => p,
            None => {
                return Response::Error {
                    message: "Player not registered".to_string(),
                }
            }
        };

        // Update username if provided
        if let Some(new_username) = username {
            // Check uniqueness
            if new_username != player.username {
                if self
                    .state
                    .username_to_owner
                    .contains_key(&new_username)
                    .await
                    .unwrap_or(false)
                {
                    return Response::Error {
                        message: "Username already taken".to_string(),
                    };
                }

                // Remove old mapping
                self.state.username_to_owner.remove(&player.username).unwrap();
                // Add new mapping
                self.state
                    .username_to_owner
                    .insert(&new_username, owner.clone())
                    .unwrap();
                player.username = new_username;
            }
        }

        // Update discord tag if provided
        if discord_tag.is_some() {
            player.discord_tag = discord_tag;
        }

        self.state.players.insert(&owner, player).unwrap();
        Response::ProfileUpdated { owner }
    }

    // ===== Tournament Management =====

    async fn create_tournament(
        &mut self,
        creator: AccountOwner,
        title: String,
        description: String,
        difficulty: Difficulty,
        maze_seed: String,
        start_time: linera_sdk::linera_base_types::Timestamp,
        end_time: linera_sdk::linera_base_types::Timestamp,
        max_attempts_per_player: Option<u32>,
        xp_reward_pool: u64,
    ) -> Response {
        // Validate times
        if end_time <= start_time {
            return Response::Error {
                message: "End time must be after start time".to_string(),
            };
        }

        let now = self.runtime.system_time();

        // Determine initial status
        let status = if now < start_time {
            TournamentStatus::Upcoming
        } else if now < end_time {
            TournamentStatus::Active
        } else {
            TournamentStatus::Ended
        };

        let id = *self.state.next_tournament_id.get();
        self.state.next_tournament_id.set(id + 1);

        let tournament = Tournament {
            id,
            title,
            description,
            difficulty,
            maze_seed,
            start_time,
            end_time,
            max_attempts_per_player,
            xp_reward_pool,
            status,
            created_at: now,
            creator,
            participant_count: 0,
        };

        self.state.tournaments.insert(&id, tournament).unwrap();
        self.state
            .tournament_leaderboards
            .insert(&id, Vec::new())
            .unwrap();

        Response::TournamentCreated { id }
    }

    async fn update_tournament_status(
        &mut self,
        owner: AccountOwner,
        tournament_id: u64,
        status: TournamentStatus,
    ) -> Response {
        let mut tournament = match self.state.tournaments.get(&tournament_id).await.unwrap() {
            Some(t) => t,
            None => {
                return Response::Error {
                    message: "Tournament not found".to_string(),
                }
            }
        };

        // Only creator can update status
        if tournament.creator != owner {
            return Response::Error {
                message: "Only tournament creator can update status".to_string(),
            };
        }

        tournament.status = status;

        // If ending, distribute rewards
        if status == TournamentStatus::Ended {
            self.distribute_tournament_rewards(tournament_id).await;
        }

        self.state.tournaments.insert(&tournament_id, tournament).unwrap();

        Response::TournamentStatusUpdated {
            id: tournament_id,
            status,
        }
    }

    // ===== Player Actions =====

    async fn join_tournament(&mut self, owner: AccountOwner, tournament_id: u64) -> Response {
        // Check player is registered
        let player = match self.state.players.get(&owner).await.unwrap() {
            Some(p) => p,
            None => {
                return Response::Error {
                    message: "Player not registered".to_string(),
                }
            }
        };

        // Check tournament exists
        let mut tournament = match self.state.tournaments.get(&tournament_id).await.unwrap() {
            Some(t) => t,
            None => {
                return Response::Error {
                    message: "Tournament not found".to_string(),
                }
            }
        };

        // Check tournament is joinable
        if tournament.status == TournamentStatus::Ended {
            return Response::Error {
                message: "Tournament has ended".to_string(),
            };
        }

        let key = (tournament_id, owner.clone());

        // Check not already joined
        if self
            .state
            .tournament_participants
            .contains_key(&key)
            .await
            .unwrap_or(false)
        {
            return Response::Error {
                message: "Already joined this tournament".to_string(),
            };
        }

        let now = self.runtime.system_time();

        let participant = TournamentParticipant {
            owner: owner.clone(),
            username: player.username.clone(),
            attempts_used: 0,
            best_time_ms: None,
            best_run_id: None,
            joined_at: now,
        };

        self.state.tournament_participants.insert(&key, participant).unwrap();

        // Update participant count
        tournament.participant_count += 1;
        self.state.tournaments.insert(&tournament_id, tournament.clone()).unwrap();

        // Update player stats
        let mut updated_player = player;
        updated_player.tournaments_played += 1;
        self.state.players.insert(&owner, updated_player).unwrap();

        Response::TournamentJoined {
            tournament_id,
            participant_count: tournament.participant_count,
        }
    }

    async fn submit_run(
        &mut self,
        owner: AccountOwner,
        mode: GameMode,
        tournament_id: Option<u64>,
        difficulty: Difficulty,
        level_reached: u32,
        time_ms: u64,
        deaths: u32,
        completed: bool,
    ) -> Response {
        // Check player is registered
        let mut player = match self.state.players.get(&owner).await.unwrap() {
            Some(p) => p,
            None => {
                return Response::Error {
                    message: "Player not registered".to_string(),
                }
            }
        };

        // Tournament mode validation
        if mode == GameMode::Tournament {
            let tid = match tournament_id {
                Some(id) => id,
                None => {
                    return Response::Error {
                        message: "Tournament ID required for tournament mode".to_string(),
                    }
                }
            };

            let tournament = match self.state.tournaments.get(&tid).await.unwrap() {
                Some(t) => t,
                None => {
                    return Response::Error {
                        message: "Tournament not found".to_string(),
                    }
                }
            };

            // Check tournament is active
            let now = self.runtime.system_time();
            if now < tournament.start_time || tournament.status == TournamentStatus::Upcoming {
                return Response::Error {
                    message: "Tournament has not started yet".to_string(),
                };
            }
            if now > tournament.end_time || tournament.status == TournamentStatus::Ended {
                return Response::Error {
                    message: "Tournament has ended".to_string(),
                };
            }

            // Check player has joined
            let key = (tid, owner.clone());
            let mut participant =
                match self.state.tournament_participants.get(&key).await.unwrap() {
                    Some(p) => p,
                    None => {
                        return Response::Error {
                            message: "Not joined this tournament".to_string(),
                        }
                    }
                };

            // Check attempts limit
            if let Some(max) = tournament.max_attempts_per_player {
                if participant.attempts_used >= max {
                    return Response::Error {
                        message: "Maximum attempts reached".to_string(),
                    };
                }
            }

            // Calculate XP
            let xp_earned = self.calculate_xp(&difficulty, time_ms, deaths, completed, true);

            // Create run
            let run_id = *self.state.next_run_id.get();
            self.state.next_run_id.set(run_id + 1);

            let run = GameRun {
                id: run_id,
                owner: owner.clone(),
                username: player.username.clone(),
                mode,
                tournament_id: Some(tid),
                difficulty,
                level_reached,
                time_ms,
                deaths,
                completed,
                xp_earned,
                created_at: self.runtime.system_time(),
            };

            self.state.runs.insert(&run_id, run).unwrap();

            // Update participant
            participant.attempts_used += 1;
            if completed {
                if participant.best_time_ms.is_none() || time_ms < participant.best_time_ms.unwrap()
                {
                    participant.best_time_ms = Some(time_ms);
                    participant.best_run_id = Some(run_id);
                }
            }
            self.state.tournament_participants.insert(&key, participant).unwrap();

            // Update tournament leaderboard
            self.update_tournament_leaderboard(tid).await;

            // Update player stats
            player.tournament_runs += 1;
            player.total_xp += xp_earned;
            self.state.players.insert(&owner, player).unwrap();

            // Add to recent runs
            self.add_recent_run(run_id).await;

            // Add to player runs
            self.add_player_run(&owner, run_id).await;

            Response::RunSubmitted { run_id, xp_earned }
        } else {
            // Practice mode
            let xp_earned = self.calculate_xp(&difficulty, time_ms, deaths, completed, false);

            // Create run
            let run_id = *self.state.next_run_id.get();
            self.state.next_run_id.set(run_id + 1);

            let run = GameRun {
                id: run_id,
                owner: owner.clone(),
                username: player.username.clone(),
                mode,
                tournament_id: None,
                difficulty,
                level_reached,
                time_ms,
                deaths,
                completed,
                xp_earned,
                created_at: self.runtime.system_time(),
            };

            self.state.runs.insert(&run_id, run).unwrap();

            // Update player stats
            player.practice_runs += 1;
            player.total_xp += xp_earned;
            if completed {
                if player.best_practice_time_ms.is_none()
                    || time_ms < player.best_practice_time_ms.unwrap()
                {
                    player.best_practice_time_ms = Some(time_ms);
                }
            }
            self.state.players.insert(&owner, player).unwrap();

            // Update practice leaderboard
            self.update_practice_leaderboard(&owner).await;

            // Add to recent runs
            self.add_recent_run(run_id).await;

            // Add to player runs
            self.add_player_run(&owner, run_id).await;

            Response::RunSubmitted { run_id, xp_earned }
        }
    }

    async fn claim_tournament_reward(&mut self, owner: AccountOwner, tournament_id: u64) -> Response {
        let key = (tournament_id, owner.clone());

        // Check reward exists
        let mut reward = match self.state.tournament_rewards.get(&key).await.unwrap() {
            Some(r) => r,
            None => {
                return Response::Error {
                    message: "No reward available".to_string(),
                }
            }
        };

        // Check not already claimed
        if reward.claimed {
            return Response::Error {
                message: "Reward already claimed".to_string(),
            };
        }

        // Mark as claimed
        reward.claimed = true;
        self.state.tournament_rewards.insert(&key, reward.clone()).unwrap();

        // Add XP to player (already added during distribution, just marking claimed)
        Response::RewardClaimed {
            tournament_id,
            xp_amount: reward.xp_amount,
        }
    }

    // ===== Helper Functions =====

    fn calculate_xp(
        &self,
        difficulty: &Difficulty,
        time_ms: u64,
        deaths: u32,
        completed: bool,
        is_tournament: bool,
    ) -> u64 {
        let base_xp = difficulty.base_xp();

        // Completion bonus
        let completion_bonus = if completed { base_xp } else { 0 };

        // Time bonus: faster = more XP (max 2x base for under 2 minutes)
        let time_secs = time_ms / 1000;
        let time_bonus = if completed && time_secs < 120 {
            base_xp * (120 - time_secs) / 120
        } else {
            0
        };

        // Death penalty: -10% per death, min 50%
        let death_penalty = std::cmp::min(deaths as u64 * 10, 50);
        let death_multiplier = 100 - death_penalty;

        // Tournament multiplier: +50%
        let tournament_multiplier = if is_tournament { 150 } else { 100 };

        let raw_xp = (base_xp + completion_bonus + time_bonus) * death_multiplier / 100;
        raw_xp * tournament_multiplier / 100
    }

    async fn update_tournament_leaderboard(&mut self, tournament_id: u64) {
        // Get all participants for this tournament
        let mut entries: Vec<LeaderboardEntry> = Vec::new();

        // We need to iterate through participants - simplified approach
        // In production, maintain a list of participant owners per tournament
        let tournament = self.state.tournaments.get(&tournament_id).await.unwrap();
        if tournament.is_none() {
            return;
        }

        // For now, we'll rebuild from the current leaderboard and update
        let mut leaderboard = self
            .state
            .tournament_leaderboards
            .get(&tournament_id)
            .await
            .unwrap()
            .unwrap_or_default();

        // Sort by best time (ascending)
        leaderboard.sort_by(|a, b| a.best_time_ms.cmp(&b.best_time_ms));

        // Update ranks
        for (i, entry) in leaderboard.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }

        self.state
            .tournament_leaderboards
            .insert(&tournament_id, leaderboard)
            .unwrap();
    }

    async fn update_practice_leaderboard(&mut self, owner: &AccountOwner) {
        let player = match self.state.players.get(owner).await.unwrap() {
            Some(p) => p,
            None => return,
        };

        let best_time = match player.best_practice_time_ms {
            Some(t) => t,
            None => return, // No completed runs
        };

        let mut leaderboard = self.state.practice_leaderboard.get().clone();

        // Find or create entry
        let entry_idx = leaderboard.iter().position(|e| e.owner == *owner);

        let entry = LeaderboardEntry {
            rank: 0,
            owner: owner.clone(),
            username: player.username.clone(),
            best_time_ms: best_time,
            total_runs: player.practice_runs as u32,
            total_xp: player.total_xp,
        };

        if let Some(idx) = entry_idx {
            leaderboard[idx] = entry;
        } else {
            leaderboard.push(entry);
        }

        // Sort by best time
        leaderboard.sort_by(|a, b| a.best_time_ms.cmp(&b.best_time_ms));

        // Keep top 100
        leaderboard.truncate(100);

        // Update ranks
        for (i, entry) in leaderboard.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }

        self.state.practice_leaderboard.set(leaderboard);
    }

    async fn distribute_tournament_rewards(&mut self, tournament_id: u64) {
        let tournament = match self.state.tournaments.get(&tournament_id).await.unwrap() {
            Some(t) => t,
            None => return,
        };

        let leaderboard = self
            .state
            .tournament_leaderboards
            .get(&tournament_id)
            .await
            .unwrap()
            .unwrap_or_default();

        let pool = tournament.xp_reward_pool;

        // Distribution: 30% 1st, 20% 2nd, 10% 3rd, 40% shared among 4-10
        let distribution = vec![0.30, 0.20, 0.10];

        for (i, entry) in leaderboard.iter().take(10).enumerate() {
            let xp_amount = if i < 3 {
                (pool as f64 * distribution[i]) as u64
            } else {
                // Positions 4-10 share 40%
                (pool as f64 * 0.40 / 7.0) as u64
            };

            let reward = TournamentReward {
                tournament_id,
                owner: entry.owner.clone(),
                rank: entry.rank,
                xp_amount,
                claimed: false,
            };

            let key = (tournament_id, entry.owner.clone());
            self.state.tournament_rewards.insert(&key, reward).unwrap();

            // Add XP to player
            if let Some(mut player) = self.state.players.get(&entry.owner).await.unwrap() {
                player.total_xp += xp_amount;
                if entry.rank == 1 {
                    player.tournaments_won += 1;
                }
                self.state.players.insert(&entry.owner, player).unwrap();
            }
        }
    }

    async fn add_recent_run(&mut self, run_id: u64) {
        let mut recent = self.state.recent_run_ids.get().clone();
        recent.insert(0, run_id);
        recent.truncate(100); // Keep last 100
        self.state.recent_run_ids.set(recent);
    }

    async fn add_player_run(&mut self, owner: &AccountOwner, run_id: u64) {
        let mut runs = self
            .state
            .player_runs
            .get(owner)
            .await
            .unwrap()
            .unwrap_or_default();
        runs.push(run_id);
        self.state.player_runs.insert(owner, runs).unwrap();
    }
}
