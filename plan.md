

=============================================================================
PROJECT: LABYRINTH LEGENDS
=============================================================================

Build "Labyrinth Legends" — a premium, on-chain 3D maze racing game for the Linera community. This is based on the open-source "Astray" WebGL maze game, but completely upgraded with modern visuals, blockchain integration, tournaments, leaderboards, and Discord XP rewards.

ALTERNATIVE NAMES (pick one if you prefer):
- Maze Nexus
- Vortex Run
- Linera Labyrinth
- Chain Maze
- Neon Depths
- Void Runner

=============================================================================
CRITICAL RESOURCES — READ THESE FIRST
=============================================================================

Before writing ANY code, you MUST:

1. **Read guideline.md** (in the project root)
   - This is the AgentHub Implementation Guideline
   - It contains EVERYTHING about Linera Conway testnet integration
   - Follow the EXACT same patterns for:
     - Contract structure (lib.rs, state.rs, contract.rs, service.rs)
     - Frontend chain connection (init.ts, signer.ts, connection.ts, operations.ts)
     - Dynamic.xyz wallet + auto-signing
     - GraphQL mutations with SCREAMING_CASE enums
     - Vercel + Render deployment

2. **Clone and study the original Astray game:**
   - Repo: https://github.com/wwwtyro/Astray
   - Demo: https://wwwtyro.github.io/Astray/
   - License: Public Domain / Unlicense (safe to modify)
   - Key files to understand:
     - How maze generation works
     - How player movement/physics work (Box2dWeb)
     - How level completion is detected
     - How the Three.js scene is set up

3. **Study Linera-Arcade for reference:**
   - Repo: https://github.com/mohamedwael201193/Linera-Arcade
   - This shows how to integrate games with Linera
   - Pay attention to:
     - frontend/src/lib/linera/lineraAdapter.ts
     - How they handle wallet connection
     - How they structure game state on-chain

=============================================================================
PROJECT STRUCTURE
=============================================================================

Create this monorepo structure (mirrors AgentHub guideline):


labyrinth-legends/
├── guideline.md                    # Copy the AgentHub guideline here
├── README.md
├── package.json                    # Root workspace config
│
├── game-engine/                    # Modified Astray game engine
│   ├── src/
│   │   ├── maze.js                 # Maze generation (from Astray)
│   │   ├── physics.js              # Box2dWeb physics (from Astray)
│   │   ├── renderer.js             # Three.js rendering (UPGRADED)
│   │   ├── controls.js             # Input handling
│   │   ├── game.js                 # Main game loop
│   │   └── hooks.js                # Event callbacks for React integration
│   ├── assets/
│   │   ├── models/                 # GLTF/GLB 3D models
│   │   ├── textures/               # PBR textures
│   │   ├── audio/                  # Sound effects
│   │   └── shaders/                # Custom GLSL shaders
│   └── index.js                    # Export game API
│
├── contracts/
│   └── labyrinth_tournament/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs              # Types, enums, Operation, ABI
│           ├── state.rs            # On-chain state (RootView)
│           ├── contract.rs         # Business logic
│           └── service.rs          # GraphQL queries
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Express + Socket.io server
│       ├── routes/
│       │   ├── tournaments.ts
│       │   ├── runs.ts
│       │   ├── players.ts
│       │   └── leaderboard.ts
│       ├── db/
│       │   └── memory.ts           # In-memory DB with JSON persistence
│       ├── services/
│       │   ├── lineraSync.ts       # Sync with on-chain data
│       │   ├── xpService.ts        # XP calculation
│       │   └── discordService.ts   # Discord username mapping
│       └── types.ts
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json                 # Deployment with WASM headers
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   ├── api.ts              # Backend API client
│       │   └── chain/              # COPY FROM AGENTHUB GUIDELINE
│       │       ├── init.ts
│       │       ├── signer.ts
│       │       ├── connection.ts
│       │       ├── operations.ts
│       │       └── useChain.ts
│       ├── hooks/
│       │   ├── useGame.ts
│       │   ├── useTournament.ts
│       │   └── useLeaderboard.ts
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── PlayPage.tsx
│       │   ├── TournamentsPage.tsx
│       │   ├── TournamentDetailPage.tsx
│       │   ├── LeaderboardPage.tsx
│       │   └── ProfilePage.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.tsx
│       │   │   ├── Footer.tsx
│       │   │   └── WalletButton.tsx
│       │   ├── game/
│       │   │   ├── GameCanvas.tsx
│       │   │   ├── GameHUD.tsx
│       │   │   ├── ModeSelector.tsx
│       │   │   └── RunCompleteModal.tsx
│       │   ├── tournament/
│       │   │   ├── TournamentCard.tsx
│       │   │   ├── TournamentTimer.tsx
│       │   │   └── JoinTournamentModal.tsx
│       │   └── leaderboard/
│       │       ├── LeaderboardTable.tsx
│       │       └── PlayerRankCard.tsx
│       └── styles/
│           └── globals.css
│
└── scripts/
├── deploy-contract.sh
└── setup.sh

=============================================================================
STEP 1: CLONE AND SETUP
=============================================================================

First, clone the original Astray game:

```bash
# Create project directory
mkdir labyrinth-legends
cd labyrinth-legends

# Initialize git
git init

# Clone Astray into game-engine folder (we'll refactor it)
git clone https://github.com/wwwtyro/Astray.git game-engine-original

# Create our modified game-engine folder
mkdir -p game-engine/src game-engine/assets

# Copy and refactor the core game files
# (We'll modernize these into ES modules)

=============================================================================
STEP 2: GAME ENGINE MODERNIZATION
Refactor the Astray game into a modern, hookable game engine:
game-engine/src/game.js:
javascriptDownloadCopy code// Main game class that React can control
export class LabyrinthGame {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      difficulty: options.difficulty || 'medium',
      seed: options.seed || null,
      onRunStart: options.onRunStart || (() => {}),
      onRunComplete: options.onRunComplete || (() => {}),
      onDeath: options.onDeath || (() => {}),
      onLevelProgress: options.onLevelProgress || (() => {}),
    };
    
    this.state = {
      isRunning: false,
      currentLevel: 1,
      timeMs: 0,
      deaths: 0,
      startTime: null,
    };
    
    // Initialize Three.js, Box2dWeb, etc.
    this.init();
  }

  init() {
    // Set up Three.js scene with UPGRADED visuals
    // Set up Box2dWeb physics
    // Set up controls
  }

  start(runConfig) {
    // runConfig: { mode, tournamentId, username, walletAddress }
    this.runConfig = runConfig;
    this.state.startTime = Date.now();
    this.state.isRunning = true;
    this.options.onRunStart(this.runConfig);
    this.gameLoop();
  }

  onLevelComplete() {
    const result = {
      runId: crypto.randomUUID(),
      mode: this.runConfig.mode,
      tournamentId: this.runConfig.tournamentId,
      username: this.runConfig.username,
      walletAddress: this.runConfig.walletAddress,
      level: this.state.currentLevel,
      timeMs: Date.now() - this.state.startTime,
      completed: true,
      deaths: this.state.deaths,
      startedAt: this.state.startTime,
      finishedAt: Date.now(),
    };
    
    this.options.onRunComplete(result);
  }

  destroy() {
    // Clean up Three.js, physics, etc.
  }
}
=============================================================================
STEP 3: LINERA SMART CONTRACT
Follow the EXACT patterns from guideline.md for the contract.
contracts/labyrinth_tournament/src/lib.rs:
rustDownloadCopy codeuse linera_sdk::base::{AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

// ============================================
// ENUMS - These become SCREAMING_CASE in GraphQL
// ============================================

#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq)]
pub enum GameMode {
    Practice,       // GraphQL: "PRACTICE" - Always-on global leaderboard
    Tournament,     // GraphQL: "TOURNAMENT" - Time-boxed events
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq)]
pub enum TournamentStatus {
    Upcoming,       // GraphQL: "UPCOMING"
    Active,         // GraphQL: "ACTIVE"
    Ended,          // GraphQL: "ENDED"
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum, PartialEq, Eq)]
pub enum Difficulty {
    Easy,           // GraphQL: "EASY"
    Medium,         // GraphQL: "MEDIUM"
    Hard,           // GraphQL: "HARD"
    Nightmare,      // GraphQL: "NIGHTMARE"
}

// ============================================
// DATA STRUCTURES
// ============================================

#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Tournament {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub difficulty: Difficulty,
    pub maze_seed: String,                    // Same maze for all players in tournament
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub max_attempts_per_player: Option<u32>, // None = unlimited
    pub xp_reward_pool: u64,                  // Total XP to distribute
    pub status: TournamentStatus,
    pub created_at: Timestamp,
    pub creator: AccountOwner,
}

#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Player {
    pub owner: AccountOwner,
    pub username: String,                     // For Discord identification
    pub discord_tag: Option<String>,          // e.g., "player#1234"
    pub total_xp: u64,
    pub practice_runs: u64,
    pub tournament_runs: u64,
    pub best_practice_time_ms: Option<u64>,
    pub tournaments_played: u32,
    pub tournaments_won: u32,
    pub registered_at: Timestamp,
}

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

#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub owner: AccountOwner,
    pub username: String,
    pub best_time_ms: u64,
    pub total_runs: u32,
    pub total_xp: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct TournamentParticipant {
    pub owner: AccountOwner,
    pub username: String,
    pub attempts_used: u32,
    pub best_time_ms: Option<u64>,
    pub best_run_id: Option<u64>,
    pub joined_at: Timestamp,
}

// ============================================
// OPERATIONS (Mutations requiring wallet signature)
// ============================================

#[derive(Debug, Deserialize, Serialize)]
pub enum Operation {
    // Player Registration
    RegisterPlayer {
        username: String,
        discord_tag: Option<String>,
    },
    UpdateDiscordTag {
        discord_tag: String,
    },

    // Tournament Management (admin/organizer)
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
    EndTournament {
        tournament_id: u64,
    },

    // Player Actions
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
    PlayerRegistered { owner: AccountOwner },
    TournamentCreated { id: u64 },
    TournamentJoined { tournament_id: u64 },
    RunSubmitted { run_id: u64, xp_earned: u64 },
    RewardClaimed { xp_amount: u64 },
    Error { message: String },
}

// ABI
linera_sdk::contract!(LabyrinthTournamentContract);
contracts/labyrinth_tournament/src/state.rs:
rustDownloadCopy codeuse linera_sdk::views::{MapView, RegisterView, RootView, QueueView};
use linera_sdk::base::AccountOwner;
use crate::{Tournament, Player, GameRun, LeaderboardEntry, TournamentParticipant};

#[derive(RootView)]
pub struct LabyrinthState {
    // ID Counters
    pub next_tournament_id: RegisterView<u64>,
    pub next_run_id: RegisterView<u64>,

    // Core Data
    pub tournaments: MapView<u64, Tournament>,
    pub players: MapView<AccountOwner, Player>,
    pub runs: MapView<u64, GameRun>,

    // Tournament Participants: (tournament_id, owner) -> TournamentParticipant
    pub tournament_participants: MapView<(u64, AccountOwner), TournamentParticipant>,
    
    // Tournament Leaderboards: tournament_id -> Vec<LeaderboardEntry>
    pub tournament_leaderboards: MapView<u64, Vec<LeaderboardEntry>>,

    // Global Practice Leaderboard (always-on mode)
    pub practice_leaderboard: RegisterView<Vec<LeaderboardEntry>>,

    // Recent runs for activity feed (last 50)
    pub recent_runs: QueueView<GameRun>,

    // Username to Owner mapping (for Discord lookup)
    pub username_to_owner: MapView<String, AccountOwner>,
}
contracts/labyrinth_tournament/src/contract.rs:
rustDownloadCopy code// Follow the EXACT pattern from guideline.md
// Key points:
// 1. Use self.runtime.authenticated_signer() to get owner
// 2. Validate tournament is active before accepting runs
// 3. Check max_attempts_per_player
// 4. Calculate XP based on: time, deaths, difficulty, completion
// 5. Update leaderboards after each run

impl Contract for LabyrinthTournamentContract {
    async fn execute_operation(&mut self, operation: Operation) -> Response {
        let owner = match self.runtime.authenticated_signer() {
            Some(signer) => AccountOwner::from(signer),
            None => return Response::Error { 
                message: "Not authenticated".to_string() 
            },
        };

        match operation {
            Operation::SubmitRun { 
                mode, 
                tournament_id, 
                difficulty,
                level_reached,
                time_ms, 
                deaths, 
                completed 
            } => {
                // Verify player is registered
                let player = match self.state.players.get(&owner).await? {
                    Some(p) => p,
                    None => return Response::Error { 
                        message: "Player not registered".to_string() 
                    },
                };

                // If tournament mode, validate tournament
                if mode == GameMode::Tournament {
                    let tournament_id = tournament_id.ok_or("Tournament ID required")?;
                    let tournament = self.state.tournaments.get(&tournament_id).await?
                        .ok_or("Tournament not found")?;
                    
                    // Check tournament is active
                    let now = self.runtime.system_time();
                    if now < tournament.start_time || now > tournament.end_time {
                        return Response::Error { 
                            message: "Tournament not active".to_string() 
                        };
                    }

                    // Check player has joined
                    let participant_key = (tournament_id, owner.clone());
                    let participant = self.state.tournament_participants
                        .get(&participant_key).await?
                        .ok_or("Not joined this tournament")?;

                    // Check attempts limit
                    if let Some(max) = tournament.max_attempts_per_player {
                        if participant.attempts_used >= max {
                            return Response::Error { 
                                message: "Max attempts reached".to_string() 
                            };
                        }
                    }
                }

                // Calculate XP
                let xp_earned = self.calculate_xp(
                    &difficulty, 
                    time_ms, 
                    deaths, 
                    completed,
                    mode == GameMode::Tournament
                );

                // Create run record
                let run_id = *self.state.next_run_id.get();
                self.state.next_run_id.set(run_id + 1);

                let run = GameRun {
                    id: run_id,
                    owner: owner.clone(),
                    username: player.username.clone(),
                    mode,
                    tournament_id,
                    difficulty,
                    level_reached,
                    time_ms,
                    deaths,
                    completed,
                    xp_earned,
                    created_at: self.runtime.system_time(),
                };

                self.state.runs.insert(&run_id, run.clone())?;
                self.state.recent_runs.push_back(run.clone()).await?;

                // Update player stats
                let mut updated_player = player.clone();
                updated_player.total_xp += xp_earned;
                if mode == GameMode::Practice {
                    updated_player.practice_runs += 1;
                    if completed {
                        if updated_player.best_practice_time_ms.is_none() 
                           || time_ms < updated_player.best_practice_time_ms.unwrap() {
                            updated_player.best_practice_time_ms = Some(time_ms);
                        }
                    }
                } else {
                    updated_player.tournament_runs += 1;
                }
                self.state.players.insert(&owner, updated_player)?;

                // Update appropriate leaderboard
                if mode == GameMode::Tournament {
                    self.update_tournament_leaderboard(tournament_id.unwrap(), &owner).await?;
                    // Update participant stats
                    self.update_tournament_participant(tournament_id.unwrap(), &owner, &run).await?;
                } else {
                    self.update_practice_leaderboard(&owner).await?;
                }

                Response::RunSubmitted { run_id, xp_earned }
            },
            // ... implement other operations
        }
    }

    fn calculate_xp(
        &self, 
        difficulty: &Difficulty, 
        time_ms: u64, 
        deaths: u32, 
        completed: bool,
        is_tournament: bool
    ) -> u64 {
        let base_xp: u64 = match difficulty {
            Difficulty::Easy => 100,
            Difficulty::Medium => 200,
            Difficulty::Hard => 400,
            Difficulty::Nightmare => 800,
        };

        let completion_bonus = if completed { base_xp } else { 0 };
        
        // Time bonus: faster = more XP (max 2x base)
        let time_secs = time_ms / 1000;
        let time_bonus = if completed && time_secs < 120 {
            base_xp * (120 - time_secs) / 120
        } else {
            0
        };

        // Death penalty: -10% per death, min 50%
        let death_penalty = std::cmp::min(deaths as u64 * 10, 50);
        let death_multiplier = 100 - death_penalty;

        // Tournament multiplier
        let tournament_bonus = if is_tournament { 50 } else { 0 }; // +50%

        let raw_xp = (base_xp + completion_bonus + time_bonus) * death_multiplier / 100;
        raw_xp + (raw_xp * tournament_bonus / 100)
    }
}
=============================================================================
STEP 4: FRONTEND - CHAIN CONNECTION
CRITICAL: Copy the chain connection code EXACTLY from guideline.md!
frontend/src/lib/chain/signer.ts:
typescriptDownloadCopy code// COPY EXACTLY FROM GUIDELINE.MD
// Key points:
// 1. Use personal_sign, NOT signMessage
// 2. Implement EvmChainSigner class
// 3. Implement createAutoSignerSetup for auto-signing
frontend/src/lib/chain/connection.ts:
typescriptDownloadCopy code// COPY EXACTLY FROM GUIDELINE.MD
// Key points:
// 1. ensureChainInitialized() for WASM
// 2. faucet.claimChain() for user's microchain
// 3. Auto-signer setup with chain.addOwner()
// 4. User interacts via THEIR chain, not hub chain
frontend/src/lib/chain/operations.ts:
typescriptDownloadCopy code// GraphQL operations for Labyrinth Legends

export const REGISTER_PLAYER = `
  mutation RegisterPlayer($username: String!, $discordTag: String) {
    registerPlayer(username: $username, discordTag: $discordTag)
  }
`;

export const CREATE_TOURNAMENT = `
  mutation CreateTournament(
    $title: String!,
    $description: String!,
    $difficulty: Difficulty!,
    $mazeSeed: String!,
    $startTime: Timestamp!,
    $endTime: Timestamp!,
    $maxAttemptsPerPlayer: Int,
    $xpRewardPool: Int!
  ) {
    createTournament(
      title: $title,
      description: $description,
      difficulty: $difficulty,
      mazeSeed: $mazeSeed,
      startTime: $startTime,
      endTime: $endTime,
      maxAttemptsPerPlayer: $maxAttemptsPerPlayer,
      xpRewardPool: $xpRewardPool
    )
  }
`;

export const JOIN_TOURNAMENT = `
  mutation JoinTournament($tournamentId: Int!) {
    joinTournament(tournamentId: $tournamentId)
  }
`;

export const SUBMIT_RUN = `
  mutation SubmitRun(
    $mode: GameMode!,
    $tournamentId: Int,
    $difficulty: Difficulty!,
    $levelReached: Int!,
    $timeMs: Int!,
    $deaths: Int!,
    $completed: Boolean!
  ) {
    submitRun(
      mode: $mode,
      tournamentId: $tournamentId,
      difficulty: $difficulty,
      levelReached: $levelReached,
      timeMs: $timeMs,
      deaths: $deaths,
      completed: $completed
    )
  }
`;

// CRITICAL: Convert enums to SCREAMING_CASE
const gameModeMap: Record<string, string> = {
  'Practice': 'PRACTICE',
  'Tournament': 'TOURNAMENT',
};

const difficultyMap: Record<string, string> = {
  'Easy': 'EASY',
  'Medium': 'MEDIUM',
  'Hard': 'HARD',
  'Nightmare': 'NIGHTMARE',
};

export const onChainApi = {
  async registerPlayer(username: string, discordTag?: string) {
    await ensureAppConnected();
    const result = await chainMutate(REGISTER_PLAYER, { username, discordTag });
    return result;
  },

  async submitRun(data: {
    mode: string;
    tournamentId?: number;
    difficulty: string;
    levelReached: number;
    timeMs: number;
    deaths: number;
    completed: boolean;
  }) {
    await ensureAppConnected();
    
    const graphqlData = {
      ...data,
      mode: gameModeMap[data.mode] || 'PRACTICE',
      difficulty: difficultyMap[data.difficulty] || 'MEDIUM',
    };

    console.log('🎮 Submitting run on-chain:', graphqlData);
    const result = await chainMutate(SUBMIT_RUN, graphqlData);
    return result;
  },

  // ... other operations
};
=============================================================================
STEP 5: GAME CANVAS COMPONENT
frontend/src/components/game/GameCanvas.tsx:
typescriptDownloadCopy codeimport React, { useEffect, useRef, useState } from 'react';
import { LabyrinthGame } from '../../../../game-engine';
import { onChainApi } from '../../lib/chain/operations';
import { useChain } from '../../lib/chain/useChain';
import GameHUD from './GameHUD';
import RunCompleteModal from './RunCompleteModal';

interface GameCanvasProps {
  mode: 'Practice' | 'Tournament';
  tournamentId?: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Nightmare';
  mazeSeed?: string;
  username: string;
}

export default function GameCanvas({ 
  mode, 
  tournamentId, 
  difficulty,
  mazeSeed,
  username 
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<LabyrinthGame | null>(null);
  const { isConnected, address, isAutoSignEnabled } = useChain();
  
  const [gameState, setGameState] = useState({
    isRunning: false,
    timeMs: 0,
    deaths: 0,
    level: 1,
  });
  const [runResult, setRunResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize game
    gameRef.current = new LabyrinthGame(containerRef.current, {
      difficulty,
      seed: mazeSeed,
      
      onRunStart: (config) => {
        setGameState(prev => ({ ...prev, isRunning: true }));
      },
      
      onRunComplete: async (result) => {
        setGameState(prev => ({ ...prev, isRunning: false }));
        setRunResult(result);
        
        // Submit to blockchain if connected
        if (isConnected && address) {
          setIsSubmitting(true);
          try {
            const onChainResult = await onChainApi.submitRun({
              mode,
              tournamentId,
              difficulty,
              levelReached: result.level,
              timeMs: result.timeMs,
              deaths: result.deaths,
              completed: result.completed,
            });
            console.log('✅ Run submitted on-chain:', onChainResult);
          } catch (error) {
            console.error('❌ Failed to submit run:', error);
          }
          setIsSubmitting(false);
        }
      },
      
      onDeath: () => {
        setGameState(prev => ({ ...prev, deaths: prev.deaths + 1 }));
      },
      
      onLevelProgress: (level, timeMs) => {
        setGameState(prev => ({ ...prev, level, timeMs }));
      },
    });

    return () => {
      gameRef.current?.destroy();
    };
  }, [difficulty, mazeSeed]);

  const handleStart = () => {
    gameRef.current?.start({
      mode,
      tournamentId,
      username,
      walletAddress: address,
    });
  };

  return (
    <div className="relative w-full h-full">
      {/* Game Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-black rounded-lg overflow-hidden"
      />

      {/* HUD Overlay */}
      <GameHUD 
        timeMs={gameState.timeMs}
        deaths={gameState.deaths}
        level={gameState.level}
        mode={mode}
        isRunning={gameState.isRunning}
      />

      {/* Start Button (when not running) */}
      {!gameState.isRunning && !runResult && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 
                       text-white text-2xl font-bold rounded-lg hover:scale-105 
                       transition-transform shadow-2xl"
          >
            🎮 START RUN
          </button>
        </div>
      )}

      {/* Run Complete Modal */}
      {runResult && (
        <RunCompleteModal
          result={runResult}
          isSubmitting={isSubmitting}
          onClose={() => setRunResult(null)}
          onPlayAgain={() => {
            setRunResult(null);
            setGameState({ isRunning: false, timeMs: 0, deaths: 0, level: 1 });
          }}
        />
      )}

      {/* Chain Status Indicator */}
      <div className="absolute bottom-4 right-4">
        {isConnected ? (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 
                          rounded-full text-sm border border-green-500/30">
            {isAutoSignEnabled ? '✅ On-Chain' : '🔗 Connected'}
          </span>
        ) : (
          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 
                          rounded-full text-sm border border-yellow-500/30">
            ⚡ Off-Chain Only
          </span>
        )}
      </div>
    </div>
  );
}
=============================================================================
STEP 6: VISUAL UPGRADE GUIDELINES
Transform Astray from a simple demo into a AAA-quality experience:
1. Three.js Scene Enhancements:
javascriptDownloadCopy code// game-engine/src/renderer.js

// Add post-processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

// Setup post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Add bloom for neon glow effect
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,   // strength
  0.4,   // radius
  0.85   // threshold
);
composer.addPass(bloomPass);

// Add chromatic aberration for sci-fi feel
const chromaticPass = new ShaderPass(ChromaticAberrationShader);
composer.addPass(chromaticPass);
2. Material Upgrades:
javascriptDownloadCopy code// Neon wall material
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a2e,
  emissive: 0x16213e,
  emissiveIntensity: 0.1,
  roughness: 0.7,
  metalness: 0.3,
});

// Glowing floor material
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x0f0f23,
  emissive: 0x0a1628,
  roughness: 0.9,
  metalness: 0.1,
});

// Player orb - glowing energy ball
const playerMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ff88,
  emissive: 0x00ff88,
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.9,
});

// Add point light to player
const playerLight = new THREE.PointLight(0x00ff88, 2, 10);
playerMesh.add(playerLight);
3. Color Palette (Tailwind config):
javascriptDownloadCopy code// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'maze': {
          bg: '#0a0a0f',
          wall: '#1a1a2e',
          floor: '#0f0f23',
          accent: '#00ff88',
          secondary: '#00d4ff',
          danger: '#ff3366',
          warning: '#ffaa00',
          purple: '#8b5cf6',
        }
      },
      backgroundImage: {
        'maze-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        'neon-glow': 'radial-gradient(ellipse at center, rgba(0,255,136,0.1) 0%, transparent 70%)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0,255,136,0.5)',
        'neon-blue': '0 0 20px rgba(0,212,255,0.5)',
        'neon-purple': '0 0 20px rgba(139,92,246,0.5)',
      },
    }
  }
}
=============================================================================
STEP 7: TOURNAMENT FLOW
Tournament Lifecycle:
┌─────────────────────────────────────────────────────────────┐
│                   TOURNAMENT LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. ADMIN CREATES TOURNAMENT                                 │
│     - Title, description, difficulty                         │
│     - Fixed maze seed (same maze for everyone)               │
│     - Start time, end time (e.g., 2 hours)                  │
│     - Max attempts per player (e.g., 20)                    │
│     - XP reward pool                                         │
│     ↓                                                        │
│  2. STATUS: UPCOMING                                         │
│     - Countdown shown on frontend                            │
│     - Players can "pre-register" with username               │
│     ↓                                                        │
│  3. STATUS: ACTIVE (tournament starts)                       │
│     - Players join with username (Discord identity)          │
│     - Players compete for best time                          │
│     - Real-time leaderboard updates                          │
│     - Max attempts enforced                                  │
│     ↓                                                        │
│  4. STATUS: ENDED (time expires)                            │
│     - No more runs accepted                                  │
│     - Final leaderboard frozen                               │
│     - XP distributed based on ranking                        │
│     - Winners can claim rewards                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

XP Distribution Formula:
typescriptDownloadCopy code// backend/src/services/xpService.ts

function distributeXP(tournament: Tournament, leaderboard: LeaderboardEntry[]) {
  const pool = tournament.xpRewardPool;
  const rewards: { owner: string; xp: number }[] = [];

  // Top 3 get special bonuses
  const distribution = [
    0.30,  // 1st place: 30% of pool
    0.20,  // 2nd place: 20% of pool
    0.10,  // 3rd place: 10% of pool
    // Remaining 40% distributed among top 10
  ];

  leaderboard.slice(0, 10).forEach((entry, index) => {
    let xp: number;
    
    if (index < 3) {
      xp = Math.floor(pool * distribution[index]);
    } else {
      // Positions 4-10 share remaining 40%
      xp = Math.floor((pool * 0.40) / 7);
    }

    rewards.push({ owner: entry.owner, xp });
  });

  return rewards;
}
=============================================================================
STEP 8: DISCORD INTEGRATION
Username → Discord Mapping:
typescriptDownloadCopy code// backend/src/services/discordService.ts

interface DiscordPlayer {
  walletAddress: string;
  username: string;        // In-game username
  discordTag: string;      // e.g., "Player#1234"
  totalXpEarned: number;
  lastActive: Date;
}

// Store mapping for Discord bot to query
const discordPlayers = new Map<string, DiscordPlayer>();

export function linkDiscord(
  walletAddress: string, 
  username: string, 
  discordTag: string
) {
  discordPlayers.set(walletAddress, {
    walletAddress,
    username,
    discordTag,
    totalXpEarned: 0,
    lastActive: new Date(),
  });
}

export function getXPByDiscord(discordTag: string): number {
  for (const player of discordPlayers.values()) {
    if (player.discordTag === discordTag) {
      return player.totalXpEarned;
    }
  }
  return 0;
}

// API endpoint for Discord bot
export function getLeaderboardForDiscord(tournamentId: number) {
  // Returns leaderboard with Discord tags for the bot to display
  return leaderboard.map(entry => ({
    rank: entry.rank,
    discordTag: discordPlayers.get(entry.owner)?.discordTag || 'Unknown',
    bestTime: formatTime(entry.bestTimeMs),
    xp: entry.totalXp,
  }));
}
=============================================================================
STEP 9: GRAPHICS & ASSET CREATION GUIDE
For professional-quality visuals, here's WHERE and HOW to create assets:
1. 3D Models (Blender - Free)

* Download: https://www.blender.org/
* Create:

Maze walls (beveled, detailed)
Player orb (energy sphere with particle effects)
Exit portal (glowing, animated)
Decorative elements (floating crystals, light beams)


* Export: GLTF/GLB format
* Place in: game-engine/assets/models/

2. Textures (Free Resources)

* ambientCG: https://ambientcg.com/ (PBR textures)
* Poly Haven: https://polyhaven.com/ (HDRIs, textures)
* Create procedural textures in Blender
* Place in: game-engine/assets/textures/

3. Sound Effects

* Freesound: https://freesound.org/
* Generate with Tone.js for procedural sounds
* Key sounds needed:

Ball rolling
Wall collision
Death/fall
Level complete
Countdown beeps
Victory fanfare



4. UI Design (Figma - Free)

* Design all UI components first
* Export SVG icons
* Create consistent design system
* Components: buttons, cards, modals, HUD elements

5. Shaders (GLSL)

* Custom shaders for:

Neon glow effects
Energy distortion
Portal effects
Trail effects behind player



=============================================================================
STEP 10: DEPLOYMENT
Follow guideline.md EXACTLY for deployment:

1. Contract Deployment:

bashDownloadCopy code# From project root
cd contracts/labyrinth_tournament
cargo build --release --target wasm32-unknown-unknown

# Deploy to Conway
linera publish-and-create \
  target/wasm32-unknown-unknown/release/labyrinth_tournament_contract.wasm \
  target/wasm32-unknown-unknown/release/labyrinth_tournament_service.wasm \
  --json-argument '{"hub_chain_id": "YOUR_CHAIN_ID"}'

1. 
Backend (Render):

Connect GitHub repo
Build: npm install && npm run build
Start: npm start
Add persistent disk for data.json


2. 
Frontend (Vercel):

Connect GitHub repo
Add COOP/COEP headers in vercel.json
Set environment variables:

VITE_LINERA_FAUCET_URL
VITE_LINERA_APP_ID
VITE_LINERA_CHAIN_ID
VITE_API_URL
VITE_DYNAMIC_ENV_ID





=============================================================================
IMPLEMENTATION ORDER
Work in this sequence:

1. 
Setup (Day 1)

Create project structure
Clone Astray into game-engine-original
Set up frontend with Vite + React + Tailwind
Copy chain connection code from guideline.md


2. 
Game Engine (Days 2-3)

Refactor Astray into ES modules
Add event callbacks (onRunComplete, etc.)
Integrate into React component
Test basic gameplay works


3. 
Visual Upgrade (Days 4-5)

Add Three.js post-processing
Upgrade materials and lighting
Create neon theme
Add particle effects


4. 
Contract (Days 6-7)

Implement all types in lib.rs
Implement state in state.rs
Implement operations in contract.rs
Deploy to Conway testnet


5. 
Backend (Day 8)

Set up Express server
Implement REST endpoints
Add lineraSync service
Add XP calculation


6. 
Frontend Integration (Days 9-10)

Wire up chain connection
Implement all pages
Add tournament flow
Real-time leaderboard


7. 
Polish (Days 11-12)

Sound effects
Animations
Error handling
Testing



=============================================================================
START NOW
Begin by:

1. Creating the project directory structure
2. Cloning Astray game
3. Setting up the frontend with Vite
4. Copying the chain connection code from guideline.md

Show me the initial file structure and basic GameCanvas component when ready!

---

## WHERE TO CREATE GRAPHICS & ASSETS

| Asset Type | Tool | Resource |
|------------|------|----------|
| **3D Models** | Blender (free) | [blender.org](https://www.blender.org/) |
| **PBR Textures** | Download | [ambientCG.com](https://ambientcg.com/) |
| **HDRIs** | Download | [polyhaven.com](https://polyhaven.com/) |
| **UI Design** | Figma (free) | [figma.com](https://www.figma.com/) |
| **Icons** | Lucide React | Already in dependencies |
| **Sound FX** | Download | [freesound.org](https://freesound.org/) |
| **Procedural Audio** | Tone.js | Include in-game |
| **Custom Shaders** | Write GLSL | In game-engine/assets/shaders/ |

---

## Quick Start After Pasting Prompt

Once Copilot starts working:

1. **Verify structure** - Make sure it creates the full monorepo
2. **Check guideline.md** - Copilot should reference it throughout
3. **Test game engine** - Ensure Astray core gameplay works
4. **Test chain connection** - Wallet connects, auto-signing works
5. **Deploy contract** - Follow the deploy-contract.sh script
6. **Test full flow** - Practice mode → Tournament mode → Leaderboard