# 🏰 Labyrinth Legends

<div align="center">

![Linera](https://img.shields.io/badge/Blockchain-Linera%20Conway-blueviolet)
![Rust](https://img.shields.io/badge/Smart%20Contract-Rust-orange)
![TypeScript](https://img.shields.io/badge/Frontend-TypeScript-blue)
![React](https://img.shields.io/badge/UI-React%2019-61dafb)

**A Web3 Maze Racing Game with Deep Linera Blockchain Integration**

*Navigate treacherous labyrinths. Compete in 15-day tournaments. All on-chain.*

[Play Now](#getting-started) • [Architecture](#architecture) • [Smart Contract](#smart-contract) • [Integration Deep Dive](#linera-integration-deep-dive)

</div>

---

## 🎮 Overview

Labyrinth Legends is a competitive maze racing game where players navigate through challenging labyrinths while competing for the best times on a **fully decentralized leaderboard**. Built on **Linera's Conway Testnet**, every tournament, every run, and every XP point is recorded immutably on-chain.

### Key Features

- 🏆 **15-Day Tournaments** - Compete in long-running tournaments with shared maze seeds
- ⛓️ **Fully On-Chain** - All game state, scoring, and leaderboards live on Linera
- 🔄 **Cross-Chain Architecture** - User chains send messages to hub chain for state updates
- ⚡ **Instant Gameplay** - Play immediately while blockchain syncs in background
- 🎯 **XP System** - On-chain XP calculation based on time, deaths, and completion
- 🔐 **Auto-Signing** - One-time wallet approval, then seamless gameplay

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LABYRINTH LEGENDS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    GraphQL     ┌──────────────────────────────┐   │
│  │   Frontend  │ ◄────────────► │     LINERA HUB CHAIN          │   │
│  │   (React)   │    Queries     │  (Tournament State Authority) │   │
│  │             │                │                                │   │
│  │  • Play UI  │                │  • Active Tournament           │   │
│  │  • Profile  │                │  • Leaderboards                │   │
│  │  • Leaders  │                │  • Player Stats                │   │
│  │  • Tourney  │                │  • Run History                 │   │
│  └──────┬──────┘                └────────────▲───────────────────┘   │
│         │                                    │                       │
│         │ Mutations                          │ Cross-Chain           │
│         │                                    │ Messages              │
│         ▼                                    │                       │
│  ┌─────────────┐                 ┌──────────┴──────────┐            │
│  │ USER CHAIN  │ ─────────────► │  Backend Service     │            │
│  │  (@linera/  │   Message      │  (process-inbox)     │            │
│  │   client)   │                │  Every 10 seconds    │            │
│  └─────────────┘                └──────────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Tournament-First Design

Unlike traditional games where backend databases store game state, Labyrinth Legends follows a **"Smart Contract is Truth"** philosophy:

1. **Smart Contract** → Single source of truth for all tournament data
2. **Frontend** → Reads from blockchain, writes mutations to user chain
3. **Backend** → Optional indexer/cache + critical inbox processor

---

## 🔗 Linera Integration Deep Dive

### Deployment Info

| Component | Value |
|-----------|-------|
| **Network** | Conway Testnet |
| **Hub Chain ID** | `b0638c9b0f9e42f53d4d05d1c23598dc2ca06a29467453d54a27e33bc78b136c` |
| **Application ID** | `b277f96b4ad009b8553f309a10d6d9babba220b192bea2fdbc18484b107770b8` |
| **Faucet URL** | `https://faucet.testnet-conway.linera.net` |

### Cross-Chain Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    RUN SUBMISSION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User completes maze level                                    │
│     ↓                                                            │
│  2. Frontend calls lineraAdapter.mutate(submitRun, {...})        │
│     ↓                                                            │
│  3. Mutation scheduled on USER'S CHAIN                           │
│     ↓                                                            │
│  4. Contract.execute_operation() receives SubmitRun              │
│     ↓                                                            │
│  5. Contract sends Message::ApplyRun to HUB CHAIN                │
│     ↓                                                            │
│  6. Backend runs `linera process-inbox` (every 10s)              │
│     ↓                                                            │
│  7. Hub chain's Contract.execute_message() processes ApplyRun    │
│     ↓                                                            │
│  8. Tournament state updated:                                    │
│     • participant_count += 1 (if new player)                     │
│     • total_runs += 1                                            │
│     • Leaderboard updated                                        │
│     • XP calculated and awarded                                  │
│     ↓                                                            │
│  9. Frontend receives block notification, refreshes data         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Innovation: Hub Chain Inbox Processing

The critical insight for Linera multi-chain architecture:

```rust
// User chains can propose blocks with mutations
// But cross-chain messages need to be PROCESSED on the hub chain
// The hub chain must have `open_multi_leader_rounds: true`
// Or a backend service must run `linera process-inbox`
```

Our backend service automatically processes the hub chain's inbox every 10 seconds, ensuring cross-chain messages are executed promptly.

---

## 📜 Smart Contract

### State Architecture (`state.rs`)

```rust
pub struct LabyrinthState {
    // ===== Hub Chain Config =====
    pub hub_chain_id: RegisterView<Option<String>>,

    // ===== Tournaments =====
    pub tournaments: MapView<u64, Tournament>,
    pub active_tournament: RegisterView<Option<Tournament>>,  // CRITICAL: RegisterView for mutations!
    pub active_tournament_id: RegisterView<Option<u64>>,

    // ===== Players =====
    pub players: MapView<[u8; 20], Player>,
    pub signer_to_wallet: MapView<AccountOwner, [u8; 20]>,

    // ===== Leaderboards =====
    pub leaderboards: MapView<u64, Vec<LeaderboardEntry>>,

    // ===== Runs =====
    pub runs: MapView<u64, GameRun>,
    pub recent_runs: RegisterView<Vec<u64>>,
}
```

**Critical Learning**: Use `RegisterView` with `.get().clone()` / `.set(Some(...))` pattern for state that needs mutation in `execute_message`. `MapView.get_mut()` does NOT persist changes!

### Operations (`lib.rs`)

```rust
pub enum Operation {
    RegisterPlayer { wallet_address: [u8; 20], username: String },
    SubmitRun { tournament_id, time_ms, score, coins, deaths, completed },
    CreateTournament { title, description, maze_seed, difficulty, duration_days, xp_reward_pool },
    EndTournament { tournament_id },
    ClaimReward { tournament_id },
    BootstrapTournament,  // Creates tournament #1 if missing
}
```

### Cross-Chain Messages (`lib.rs`)

```rust
pub enum Message {
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
```

### XP Calculation (On-Chain)

```rust
pub fn calculate_xp(&self, time_ms: u64, deaths: u32, completed: bool) -> u64 {
    let base = self.base_xp();  // Easy=75, Medium=100, Hard=125, Nightmare=150
    
    // Completion bonus: +100% if completed
    let completion_bonus = if completed { base } else { 0 };
    
    // Time bonus: up to +100% for sub-2-minute completion
    let time_bonus = if completed && time_ms < 120_000 {
        (base * (120 - time_ms/1000)) / 120
    } else { 0 };
    
    // Death penalty: -10% per death, max 50%
    let death_penalty = min(deaths * 10, 50);
    
    let raw_xp = (base + completion_bonus + time_bonus) * (100 - death_penalty) / 100;
    max(10, raw_xp)  // Minimum 10 XP
}
```

### GraphQL Service (`service.rs`)

#### Queries
- `activeTournament` - Get the current active tournament
- `tournament(id)` - Get tournament by ID
- `tournaments(status)` - List all tournaments
- `leaderboard(tournamentId, limit)` - Get sorted leaderboard
- `player(owner)` - Get player stats
- `recentRuns(limit)` - Activity feed

#### Mutations (Schedule Operations)
- `registerPlayer(walletAddress, username)` → Schedules `Operation::RegisterPlayer`
- `submitRun(tournamentId, ...)` → Schedules `Operation::SubmitRun`
- `bootstrapTournament` → Schedules `Operation::BootstrapTournament`

---

## ⚛️ Frontend Integration

### Linera Adapter Singleton

The frontend uses a singleton adapter pattern ([lineraAdapter.ts](frontend/src/lib/linera/lineraAdapter.ts)) that:

1. **Initializes WASM** - Loads `@linera/client` WebAssembly module
2. **Connects to Faucet** - Claims a microchain for each user
3. **Sets Up Auto-Signing** - Creates ephemeral key for automatic transaction signing
4. **Maintains Dual Connections**:
   - **Hub Chain** → For GraphQL queries (reading state)
   - **User Chain** → For mutations (writing state via cross-chain messages)

```typescript
// Connect to application with dual-chain architecture
const hubChain = await client.chain(HUB_CHAIN_ID);    // Queries
const userChain = await client.chain(userChainId);     // Mutations

appConnection = {
  application: await hubChain.application(appId),      // For reading
  userApplication: await userChain.application(appId), // For writing
};
```

### Block Notifications

The adapter subscribes to block notifications for real-time state updates:

```typescript
// Subscribe to block notifications for auto-refresh
lineraAdapter.subscribe(() => {
  console.log('🔔 Block notification - refetching tournament...');
  refetchTournament();
});
```

### React Hooks

- **`useLineraConnection`** - Manages wallet connection and Linera client state
- **`useLabyrinth`** - Player data and registration management
- **`useGameStore`** (Zustand) - Local game UI state

---

## 📱 Pages & Features

### 🎮 Play Page (`AstrayPlayPage.tsx`)

- Embedded 3D maze game (Astray engine)
- Real-time tournament loading from blockchain
- Auto-submit scores every 3 levels
- XP estimation with on-chain calculation
- Cross-chain message submission

### 🏆 Tournaments Page (`TournamentsPage.tsx`)

- Active tournament display with live stats
- Real-time countdown timer
- Participant count and total runs (from blockchain)
- Top 10 leaderboard preview
- Block notification subscription for auto-refresh

### 📊 Leaderboard Page (`LeaderboardPage.tsx`)

- Full tournament leaderboard from blockchain
- Fallback to backend if not connected
- Current player rank highlighting
- Time formatting and XP display

### 👤 Profile Page (`ProfilePage.tsx`)

- Player stats from blockchain via `useLabyrinth` hook
- Total XP, tournaments played, best times
- Recent run history
- Linera connection status

---

## 🔧 Backend Service

### Inbox Processing (`services/linera.ts`)

The backend performs the **critical task** of processing the hub chain's inbox:

```typescript
async processHubInbox(): Promise<{ success: boolean; blocksCreated: number }> {
  const output = await lineraCommand(['process-inbox', HUB_CHAIN_ID]);
  // Parses output to get block count
  return { success: true, blocksCreated };
}

// Runs automatically every 10 seconds
startPeriodicInboxProcessing(10000);
```

This ensures cross-chain messages from user chains are processed, updating:
- `participantCount`
- `totalRuns`
- Leaderboard entries
- Player stats

### API Endpoints

- `POST /api/admin/process-inbox` - Manual inbox processing trigger
- `POST /api/players/sync` - Backend player registration (instant UX)
- `POST /api/scores` - Backup score storage
- `GET /api/leaderboard` - Cached leaderboard data

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust (for contract development)
- Linera CLI (`cargo install linera-service`)
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/labyrinth-legends.git
cd labyrinth-legends

# Install dependencies
pnpm install

# Set up environment variables
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Configure your Linera deployment
# frontend/.env:
VITE_LINERA_APP_ID=b277f96b4ad009b8553f309a10d6d9babba220b192bea2fdbc18484b107770b8
VITE_LINERA_CHAIN_ID=b0638c9b0f9e42f53d4d05d1c23598dc2ca06a29467453d54a27e33bc78b136c
VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
VITE_ENABLE_LINERA=true
```

### Running Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

### Deploying the Contract

```bash
cd contracts/labyrinth_tournament

# Build the contract
cargo build --release --target wasm32-unknown-unknown

# Publish bytecode
linera publish-bytecode \
  ./target/wasm32-unknown-unknown/release/labyrinth_tournament_{contract,service}.wasm

# Deploy application
linera create-application <BYTECODE_ID> \
  --json-argument '{"hub_chain_id":"<YOUR_CHAIN_ID>"}'

# Enable multi-leader rounds (critical for cross-chain messages!)
linera change-ownership --open-multi-leader-rounds
```

---

## 📁 Project Structure

```
labyrinth-legends/
├── contracts/
│   └── labyrinth_tournament/
│       └── src/
│           ├── lib.rs        # Types, Operations, Messages, XP calculation
│           ├── contract.rs   # execute_operation, execute_message
│           ├── service.rs    # GraphQL queries and mutations
│           └── state.rs      # On-chain state views
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── linera/
│       │   │   └── lineraAdapter.ts  # Singleton Linera client
│       │   └── chain/
│       │       └── config.ts         # GraphQL queries/mutations
│       ├── hooks/
│       │   ├── useLineraConnection.ts
│       │   └── useLabyrinth.ts
│       └── pages/
│           ├── AstrayPlayPage.tsx
│           ├── TournamentsPage.tsx
│           ├── LeaderboardPage.tsx
│           └── ProfilePage.tsx
├── backend/
│   └── src/
│       ├── index.ts          # Express server + inbox processing
│       └── services/
│           └── linera.ts     # CLI wrapper + processHubInbox
└── game-engine/              # Astray 3D maze game
```

---

## 🔑 Key Learnings & Challenges Solved

### 1. RegisterView vs MapView for Mutations

**Problem**: Tournament counters stayed at 0 despite successful mutations.

**Solution**: Use `RegisterView<Option<Tournament>>` with explicit `.get().clone()` / `.set(Some(...))` pattern instead of `MapView.get_mut()` which doesn't persist in `execute_message`.

### 2. Cross-Chain Message Processing

**Problem**: Messages sent from user chains never updated hub chain state.

**Root Cause**: Hub chain had `open_multi_leader_rounds: false`, meaning only the owner could propose blocks.

**Solution**: 
1. Enable `open_multi_leader_rounds: true` on hub chain
2. Backend service runs `linera process-inbox` every 10 seconds

### 3. Dual-Chain Application Connections

**Problem**: Users couldn't write to the hub chain directly.

**Solution**: Connect to application on BOTH chains:
- Hub chain application → For GraphQL queries (reading)
- User chain application → For mutations (writing via cross-chain messages)

### 4. Auto-Signing for Web3 UX

**Problem**: Users had to approve every transaction popup.

**Solution**: Use `@linera/client`'s composite signer with:
- `PrivateKey.createRandom()` for auto-signer (no popup)
- `DynamicSigner` as fallback for manual signing
- One-time `chain.addOwner()` to authorize auto-signer

---

## 🛣️ Roadmap

- [ ] Token rewards for tournament winners
- [ ] Multiple difficulty tournaments running simultaneously
- [ ] NFT badges for achievements
- [ ] Discord bot for leaderboard updates
- [ ] Mobile-responsive game UI
- [ ] Practice mode without tournament submission

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Linera](https://linera.io) - Revolutionary microchain blockchain architecture
- [Linera-Arcade](https://github.com/linera-io/linera-arcade) - Reference implementation for @linera/client patterns
- [Astray](https://github.com/wwwtyro/Astray) - Original 3D maze game engine
- [Dynamic](https://dynamic.xyz) - Embedded wallet integration

---

<div align="center">

**Built with ❤️ for the Linera Ecosystem**

*Navigate the labyrinth. Conquer the leaderboard. All on-chain.*

</div>
