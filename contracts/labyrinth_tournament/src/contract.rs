//! Labyrinth Legends - Tournament Contract Logic
//! Handles all operations for tournament-first architecture

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use self::state::LabyrinthState;
use labyrinth_tournament::{
    Difficulty, Tournament, TournamentStatus, Player, TournamentPlayer,
    GameRun, LeaderboardEntry, TournamentReward, Operation, Response,
    InitializationArgument, Message,
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
    type Message = Message;
    type Parameters = ();
    type InstantiationArgument = InitializationArgument;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = LabyrinthState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        LabyrinthTournamentContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        // Store the hub chain ID for cross-chain messaging
        self.state.hub_chain_id.set(Some(argument.hub_chain_id));
        
        // Initialize counters
        self.state.next_tournament_id.set(2); // Start at 2 since we create tournament 1
        self.state.next_run_id.set(1);
        self.state.recent_runs.set(Vec::new());
        
        // =====================================================================
        // AUTO-CREATE 15-DAY TOURNAMENT AT DEPLOYMENT
        // Like Linera-Arcade: Everyone sees the SAME tournament immediately
        // No waiting, no manual creation required
        // =====================================================================
        let now = self.runtime.system_time();
        
        // Tournament duration: 15 days in microseconds
        const DURATION_DAYS: u64 = 15;
        let duration_micros = DURATION_DAYS * 24 * 60 * 60 * 1_000_000;
        let end_time = linera_sdk::linera_base_types::Timestamp::from(
            now.micros() + duration_micros
        );
        
        // Deterministic seed from deployment timestamp (everyone gets same maze)
        let maze_seed = format!("labyrinth_legends_{}", now.micros() / 1_000_000);
        
        let tournament = Tournament {
            id: 1,
            title: "Labyrinth Legends Championship".to_string(),
            description: "15-day tournament - Navigate the maze faster than anyone else!".to_string(),
            maze_seed,
            difficulty: Difficulty::Medium,
            start_time: now,
            end_time,
            status: TournamentStatus::Active,
            participant_count: 0,
            total_runs: 0,
            xp_reward_pool: 10000, // 10,000 XP pool for top players
            created_at: now,
        };
        
        // Store tournament in BOTH places:
        // 1. MapView for historical lookup
        // 2. RegisterView for direct mutation (CRITICAL for state persistence)
        self.state.tournaments.insert(&1u64, tournament.clone()).unwrap();
        self.state.active_tournament.set(Some(tournament));
        self.state.leaderboards.insert(&1u64, Vec::new()).unwrap();
        self.state.active_tournament_id.set(Some(1));
    }

    async fn execute_operation(&mut self, operation: Operation) -> Response {
        // Get authenticated signer
        let signer = match self.runtime.authenticated_signer() {
            Some(s) => AccountOwner::from(s),
            None => return Response::Error { message: "Not authenticated".to_string() },
        };

        match operation {
            Operation::RegisterPlayer { wallet_address, username } => {
                self.register_player(signer, wallet_address, username).await
            }
            
            Operation::SubmitRun { tournament_id, time_ms, score, coins, deaths, completed } => {
                self.submit_run(signer, tournament_id, time_ms, score, coins, deaths, completed).await
            }
            
            Operation::CreateTournament { title, description, maze_seed, difficulty, duration_days, xp_reward_pool } => {
                self.create_tournament(signer, title, description, maze_seed, difficulty, duration_days, xp_reward_pool).await
            }
            
            Operation::EndTournament { tournament_id } => {
                self.end_tournament(signer, tournament_id).await
            }
            
            Operation::ClaimReward { tournament_id } => {
                self.claim_reward(signer, tournament_id).await
            }
            
            Operation::BootstrapTournament => {
                self.bootstrap_tournament().await
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        // =====================================================================
        // CRITICAL: ALL state mutations happen HERE and ONLY here.
        // NEVER use get_mut() on RegisterView - it does NOT persist state!
        // ALWAYS use: let mut val = view.get().clone(); ... view.set(Some(val));
        // =====================================================================
        match message {
            Message::ApplyRun {
                wallet_address,
                username,
                tournament_id,
                time_ms,
                score,
                coins,
                deaths,
                completed,
            } => {
                let now = self.runtime.system_time();
                
                // ===== STEP 1: Get tournament using .get() - returns a CLONE =====
                // CRITICAL: Do NOT use get_mut() - it doesn't persist in RegisterView!
                let mut tournament = match self.state.active_tournament.get() {
                    Some(t) => t.clone(),
                    None => return, // No active tournament
                };
                
                // Validate tournament
                if tournament.id != tournament_id {
                    return; // Wrong tournament ID
                }
                if tournament.status != TournamentStatus::Active {
                    return; // Tournament not active
                }
                if now >= tournament.end_time {
                    return; // Tournament ended
                }
                
                // ===== STEP 2: Check if new participant =====
                let key = (tournament_id, wallet_address);
                let is_new_participant = !self.state.tournament_players
                    .contains_key(&key)
                    .await
                    .unwrap_or(false);
                
                // ===== STEP 3: Mutate tournament counts (on the clone) =====
                if is_new_participant {
                    tournament.participant_count += 1;
                }
                tournament.total_runs += 1;
                
                // ===== STEP 4: Calculate XP =====
                let xp_earned = tournament.difficulty.calculate_xp(time_ms, deaths, completed);
                
                // ===== STEP 5: Create run record =====
                let run_id = *self.state.next_run_id.get();
                self.state.next_run_id.set(run_id + 1);
                
                let run = GameRun {
                    id: run_id,
                    tournament_id,
                    wallet_address,
                    username: username.clone(),
                    time_ms,
                    score,
                    coins,
                    deaths,
                    completed,
                    xp_earned,
                    created_at: now,
                };
                
                // Store run in MapView
                let _ = self.state.runs.insert(&run_id, run);
                
                // ===== STEP 6: Update recent runs (RegisterView with .get().clone() / .set()) =====
                let mut recent = self.state.recent_runs.get().clone();
                recent.insert(0, run_id);
                if recent.len() > 100 {
                    recent.truncate(100);
                }
                self.state.recent_runs.set(recent);
                
                // ===== STEP 7: Get or create tournament player =====
                let mut tp = match self.state.tournament_players.get(&key).await.ok().flatten() {
                    Some(existing) => existing,
                    None => TournamentPlayer {
                        wallet_address,
                        username: username.clone(),
                        best_time_ms: u64::MAX,
                        best_score: 0,
                        total_runs: 0,
                        total_xp_earned: 0,
                        last_run_at: now,
                        joined_at: now,
                    },
                };
                
                // Update tournament player stats
                if completed && time_ms < tp.best_time_ms {
                    tp.best_time_ms = time_ms;
                }
                if score > tp.best_score {
                    tp.best_score = score;
                }
                tp.total_runs += 1;
                tp.total_xp_earned += xp_earned;
                tp.last_run_at = now;
                
                // Store tournament player in MapView
                let _ = self.state.tournament_players.insert(&key, tp.clone());
                
                // ===== STEP 8: Update global player stats =====
                let mut player = self.state.players.get(&wallet_address).await.ok().flatten()
                    .unwrap_or_else(|| Player {
                        wallet_address,
                        username: username.clone(),
                        total_xp: 0,
                        total_runs: 0,
                        tournaments_played: 0,
                        tournaments_won: 0,
                        best_time_ms: None,
                        registered_at: now,
                        last_active: now,
                    });
                
                player.total_xp += xp_earned;
                player.total_runs += 1;
                player.last_active = now;
                if is_new_participant {
                    player.tournaments_played += 1;
                }
                if completed {
                    match player.best_time_ms {
                        Some(best) if time_ms < best => player.best_time_ms = Some(time_ms),
                        None => player.best_time_ms = Some(time_ms),
                        _ => {}
                    }
                }
                
                // Store player in MapView
                let _ = self.state.players.insert(&wallet_address, player);
                
                // ===== STEP 9: Update leaderboard (INLINE - no helper function) =====
                let mut leaderboard = self.state.leaderboards
                    .get(&tournament_id)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();
                
                // Find or update entry
                let mut found = false;
                for entry in &mut leaderboard {
                    if entry.wallet_address == wallet_address {
                        if tp.best_time_ms < entry.best_time_ms {
                            entry.best_time_ms = tp.best_time_ms;
                        }
                        if tp.best_score > entry.best_score {
                            entry.best_score = tp.best_score;
                        }
                        entry.total_runs = tp.total_runs;
                        entry.total_xp = tp.total_xp_earned;
                        found = true;
                        break;
                    }
                }
                
                if !found {
                    leaderboard.push(LeaderboardEntry {
                        wallet_address,
                        username: username.clone(),
                        best_time_ms: tp.best_time_ms,
                        best_score: tp.best_score,
                        total_runs: tp.total_runs,
                        total_xp: tp.total_xp_earned,
                        rank: 0,
                    });
                }
                
                // Sort by best time (ascending - lower is better)
                leaderboard.sort_by(|a, b| a.best_time_ms.cmp(&b.best_time_ms));
                
                // Update ranks
                for (i, entry) in leaderboard.iter_mut().enumerate() {
                    entry.rank = (i + 1) as u32;
                }
                
                // Keep top 100
                if leaderboard.len() > 100 {
                    leaderboard.truncate(100);
                }
                
                // Store leaderboard in MapView
                let _ = self.state.leaderboards.insert(&tournament_id, leaderboard);
                
                // =====================================================================
                // STEP 10: CRITICAL - Persist tournament state using .set()
                // This is THE KEY FIX - get_mut() does NOT persist in RegisterView!
                // We must use .set(Some(value)) to trigger state persistence.
                // =====================================================================
                self.state.active_tournament.set(Some(tournament.clone()));
                
                // Also sync to MapView for consistency
                let _ = self.state.tournaments.insert(&tournament_id, tournament);
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl LabyrinthTournamentContract {
    // ===== Helper: Get wallet for signer =====
    async fn get_wallet_for_signer(&self, signer: &AccountOwner) -> Option<[u8; 20]> {
        self.state.signer_to_wallet.get(signer).await.ok().flatten()
    }

    // ===== Helper: Get or create player =====
    async fn get_or_create_player(&mut self, signer: AccountOwner, wallet: [u8; 20], default_username: &str) -> Player {
        // Check if player exists
        if let Some(player) = self.state.players.get(&wallet).await.ok().flatten() {
            // Bind signer to wallet if not already
            self.state.signer_to_wallet.insert(&signer, wallet).unwrap();
            return player;
        }

        // Create new player
        let now = self.runtime.system_time();
        let username = format!("Player_{}", hex::encode(&wallet[0..4]));
        
        let player = Player {
            wallet_address: wallet,
            username: username.clone(),
            total_xp: 0,
            total_runs: 0,
            tournaments_played: 0,
            tournaments_won: 0,
            best_time_ms: None,
            registered_at: now,
            last_active: now,
        };

        // Store player
        self.state.players.insert(&wallet, player.clone()).unwrap();
        self.state.username_to_wallet.insert(&username, wallet).unwrap();
        self.state.signer_to_wallet.insert(&signer, wallet).unwrap();

        player
    }

    // ===== Register Player =====
    async fn register_player(
        &mut self,
        signer: AccountOwner,
        wallet_address: [u8; 20],
        username: String,
    ) -> Response {
        // Check if wallet already registered
        if self.state.players.contains_key(&wallet_address).await.unwrap_or(false) {
            // Just bind signer
            self.state.signer_to_wallet.insert(&signer, wallet_address).unwrap();
            return Response::PlayerRegistered { wallet_address };
        }

        // Check username uniqueness
        if self.state.username_to_wallet.contains_key(&username).await.unwrap_or(false) {
            return Response::Error { message: "Username already taken".to_string() };
        }

        let now = self.runtime.system_time();

        let player = Player {
            wallet_address,
            username: username.clone(),
            total_xp: 0,
            total_runs: 0,
            tournaments_played: 0,
            tournaments_won: 0,
            best_time_ms: None,
            registered_at: now,
            last_active: now,
        };

        // Store everything
        self.state.players.insert(&wallet_address, player).unwrap();
        self.state.username_to_wallet.insert(&username, wallet_address).unwrap();
        self.state.signer_to_wallet.insert(&signer, wallet_address).unwrap();

        Response::PlayerRegistered { wallet_address }
    }

    // ===== Submit Run (PRIMARY OPERATION) =====
    // CRITICAL: This function ALWAYS sends a message to hub chain.
    // NO branching logic. NO direct state mutation.
    // All state changes happen ONLY in execute_message.
    async fn submit_run(
        &mut self,
        signer: AccountOwner,
        tournament_id: u64,
        time_ms: u64,
        score: u64,
        coins: u32,
        deaths: u32,
        completed: bool,
    ) -> Response {
        // Get wallet for signer, or auto-register if signer is Address20 (EVM wallet)
        let wallet = match self.get_wallet_for_signer(&signer).await {
            Some(w) => w,
            None => {
                // Signer not mapped - try to derive wallet from Address20
                match &signer {
                    AccountOwner::Address20(addr) => {
                        // Auto-bind this signer to wallet immediately
                        self.state.signer_to_wallet.insert(&signer, *addr).unwrap();
                        *addr
                    },
                    _ => return Response::Error { 
                        message: "Player not registered. Call registerPlayer first.".to_string() 
                    },
                }
            }
        };

        // Get or create player to get username
        let player = self.get_or_create_player(signer.clone(), wallet, "").await;
        let username = player.username.clone();

        // ALWAYS send message to hub chain - NO branching logic
        // Even if we ARE on the hub chain, we send a message to ourselves
        // This ensures ALL state mutations go through execute_message
        let hub_chain = self.runtime.application_creator_chain_id();
        
        let message = Message::ApplyRun {
            wallet_address: wallet,
            username,
            tournament_id,
            time_ms,
            score,
            coins,
            deaths,
            completed,
        };
        
        // Send message to hub chain
        self.runtime.send_message(hub_chain, message);
        
        // Return success - actual state update happens in execute_message
        Response::Ok
    }

    // NOTE: apply_run_on_hub has been DELETED
    // NOTE: update_leaderboard has been DELETED
    // ALL state mutations now happen ONLY inside execute_message

    // ===== Create Tournament =====
    async fn create_tournament(
        &mut self,
        _creator: AccountOwner,
        title: String,
        description: String,
        maze_seed: String,
        difficulty: Difficulty,
        duration_days: u64,
        xp_reward_pool: u64,
    ) -> Response {
        let now = self.runtime.system_time();
        
        // Calculate end time (duration_days * 24 * 60 * 60 * 1_000_000 microseconds)
        let duration_micros = duration_days * 24 * 60 * 60 * 1_000_000;
        let end_time = linera_sdk::linera_base_types::Timestamp::from(
            now.micros() + duration_micros
        );

        let id = *self.state.next_tournament_id.get();
        self.state.next_tournament_id.set(id + 1);

        let tournament = Tournament {
            id,
            title,
            description,
            maze_seed: maze_seed.clone(),
            difficulty,
            start_time: now,
            end_time,
            status: TournamentStatus::Active,
            participant_count: 0,
            total_runs: 0,
            xp_reward_pool,
            created_at: now,
        };

        self.state.tournaments.insert(&id, tournament).unwrap();
        self.state.leaderboards.insert(&id, Vec::new()).unwrap();
        self.state.active_tournament_id.set(Some(id));

        Response::TournamentCreated {
            id,
            maze_seed,
            end_time,
        }
    }

    // ===== End Tournament (Finalize) =====
    // STRICT ENFORCEMENT: Can only be called when now >= end_time
    // This ensures the tournament runs for the full duration
    // Anyone can call this (not admin-only) - the contract enforces timing
    async fn end_tournament(
        &mut self,
        _caller: AccountOwner,
        tournament_id: u64,
    ) -> Response {
        let mut tournament = match self.state.tournaments.get(&tournament_id).await.ok().flatten() {
            Some(t) => t,
            None => return Response::Error { message: "Tournament not found".to_string() },
        };

        if tournament.status == TournamentStatus::Ended {
            return Response::Error { message: "Tournament already ended".to_string() };
        }

        // STRICT TIME ENFORCEMENT: Tournament must have reached end_time
        let now = self.runtime.system_time();
        if now < tournament.end_time {
            return Response::Error { 
                message: format!(
                    "Tournament cannot be finalized yet. Ends at timestamp {}",
                    tournament.end_time.micros()
                )
            };
        }

        // Mark as ended
        tournament.status = TournamentStatus::Ended;
        self.state.tournaments.insert(&tournament_id, tournament.clone()).unwrap();

        // Clear active tournament if this was it
        if self.state.active_tournament_id.get() == &Some(tournament_id) {
            self.state.active_tournament_id.set(None);
        }

        // Get leaderboard and create rewards for top 5
        let leaderboard = self.state.leaderboards.get(&tournament_id).await.ok().flatten()
            .unwrap_or_default();

        // Reward distribution: 1st=40%, 2nd=25%, 3rd=15%, 4th=12%, 5th=8%
        let reward_percentages = [40u64, 25, 15, 12, 8];
        let mut winner_count = 0u32;

        for (i, entry) in leaderboard.iter().take(5).enumerate() {
            let xp_amount = (tournament.xp_reward_pool * reward_percentages[i]) / 100;
            
            let reward = TournamentReward {
                tournament_id,
                wallet_address: entry.wallet_address,
                rank: entry.rank,
                xp_amount,
                claimed: false,
            };

            let key = (tournament_id, entry.wallet_address);
            self.state.rewards.insert(&key, reward).unwrap();
            
            // Update player's tournaments_won for 1st place
            if i == 0 {
                if let Some(mut player) = self.state.players.get(&entry.wallet_address).await.ok().flatten() {
                    player.tournaments_won += 1;
                    self.state.players.insert(&entry.wallet_address, player).unwrap();
                }
            }
            
            winner_count += 1;
        }

        Response::TournamentEnded {
            id: tournament_id,
            winner_count,
        }
    }

    // ===== Claim Reward =====
    async fn claim_reward(
        &mut self,
        signer: AccountOwner,
        tournament_id: u64,
    ) -> Response {
        // Get wallet for signer
        let wallet = match self.get_wallet_for_signer(&signer).await {
            Some(w) => w,
            None => return Response::Error { message: "Player not registered".to_string() },
        };

        let key = (tournament_id, wallet);
        let mut reward = match self.state.rewards.get(&key).await.ok().flatten() {
            Some(r) => r,
            None => return Response::Error { message: "No reward found for this tournament".to_string() },
        };

        if reward.claimed {
            return Response::Error { message: "Reward already claimed".to_string() };
        }

        // Mark as claimed
        reward.claimed = true;
        self.state.rewards.insert(&key, reward.clone()).unwrap();

        // Add XP to player
        if let Some(mut player) = self.state.players.get(&wallet).await.ok().flatten() {
            player.total_xp += reward.xp_amount;
            self.state.players.insert(&wallet, player).unwrap();
        }

        Response::RewardClaimed {
            tournament_id,
            xp_amount: reward.xp_amount,
        }
    }
    
    // ===== Bootstrap Tournament (Workaround for instantiate not persisting) =====
    // Creates tournament #1 if it doesn't exist
    // This is idempotent - calling multiple times has no effect
    async fn bootstrap_tournament(&mut self) -> Response {
        // Check if tournament #1 already exists in MapView
        if let Ok(Some(existing)) = self.state.tournaments.get(&1u64).await {
            // Tournament exists in MapView - ensure RegisterView is also set
            // This is CRITICAL: execute_message reads from RegisterView, not MapView!
            self.state.active_tournament.set(Some(existing.clone()));
            self.state.active_tournament_id.set(Some(1));
            
            return Response::TournamentBootstrapped {
                id: 1,
                end_time: existing.end_time,
                already_existed: true,
            };
        }

        // Tournament doesn't exist - create it
        let now = self.runtime.system_time();
        
        // Tournament duration: 15 days in microseconds
        const DURATION_DAYS: u64 = 15;
        let duration_micros = DURATION_DAYS * 24 * 60 * 60 * 1_000_000;
        let end_time = linera_sdk::linera_base_types::Timestamp::from(
            now.micros() + duration_micros
        );
        
        // Deterministic seed from current timestamp
        let maze_seed = format!("labyrinth_legends_{}", now.micros() / 1_000_000);
        
        let tournament = Tournament {
            id: 1,
            title: "Labyrinth Legends Championship".to_string(),
            description: "15-day tournament - Navigate the maze faster than anyone else!".to_string(),
            maze_seed,
            difficulty: Difficulty::Medium,
            start_time: now,
            end_time,
            status: TournamentStatus::Active,
            participant_count: 0,
            total_runs: 0,
            xp_reward_pool: 10000,
            created_at: now,
        };
        
        // Store tournament in BOTH places for consistency:
        // 1. MapView for historical lookup and persistence
        // 2. RegisterView for quick access and state mutations in execute_message
        self.state.tournaments.insert(&1u64, tournament.clone()).unwrap();
        self.state.active_tournament.set(Some(tournament)); // CRITICAL: Set RegisterView!
        self.state.leaderboards.insert(&1u64, Vec::new()).unwrap();
        self.state.active_tournament_id.set(Some(1));
        
        // Initialize counters if not set
        if *self.state.next_tournament_id.get() < 2 {
            self.state.next_tournament_id.set(2);
        }
        if *self.state.next_run_id.get() < 1 {
            self.state.next_run_id.set(1);
        }
        
        Response::TournamentBootstrapped {
            id: 1,
            end_time,
            already_existed: false,
        }
    }
}
