# 🎮 LABYRINTH LEGENDS - Complete Project Summary

> **A competitive multiplayer maze game built on Linera Conway Testnet with on-chain scoring, tournaments, and real-time leaderboards.**

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Smart Contract](#-smart-contract)
4. [Frontend Application](#-frontend-application)
5. [Backend Server](#-backend-server)
6. [Game Engine](#-game-engine-astray)
7. [Linera Integration](#-linera-blockchain-integration)
8. [Deployment Guide](#-deployment-guide)
9. [API Reference](#-api-reference)
10. [Key Features](#-key-features-implemented)

---

## 🎯 Project Overview

**Labyrinth Legends** is a 3D maze puzzle game where players:
- Navigate through procedurally generated mazes
- Collect coins, gems, and stars for points
- Compete on global leaderboards stored on-chain
- Participate in time-limited tournaments
- Earn XP and level up their profile

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Linera Conway Testnet |
| **Smart Contract** | Rust + Linera SDK 0.15.x |
| **Frontend** | React 18 + Vite + TypeScript |
| **Wallet** | Dynamic Labs (MetaMask, WalletConnect) |
| **Backend** | Express.js + Socket.IO |
| **Game Engine** | Three.js + Box2D (Astray) |
| **Styling** | Tailwind CSS + Framer Motion |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                 React Frontend (Vite)                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │    │
│  │  │ Dynamic     │  │ Linera      │  │ Astray Game Engine  │ │    │
│  │  │ Wallet      │  │ Adapter     │  │ (Three.js + Box2D)  │ │    │
│  │  │ (MetaMask)  │  │ (WASM)      │  │                     │ │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │    │
│  │         │                │                     │            │    │
│  │         └────────────────┼─────────────────────┘            │    │
│  │                          │                                  │    │
│  │                   ┌──────▼──────┐                          │    │
│  │                   │ useLabyrinth│ (Hybrid API)             │    │
│  │                   │ Hook        │                          │    │
│  │                   └──────┬──────┘                          │    │
│  └──────────────────────────┼──────────────────────────────────┘    │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Backend API    │  │  Linera Faucet  │  │  Linera Smart   │
│  (Express.js)   │  │  (Conway)       │  │  Contract       │
│                 │  │                 │  │                 │
│  - Player sync  │  │  - Wallet init  │  │  - registerPlayer│
│  - Score sync   │  │  - Chain claim  │  │  - submitRun    │
│  - Leaderboard  │  │  - Token fund   │  │  - tournaments  │
│  - Tournaments  │  │                 │  │  - leaderboards │
│  - Socket.IO    │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Data Flow: Hybrid Architecture

```
READS (Priority Order):
  1. Backend API (fast, cached) → GET /api/players/:wallet
  2. Blockchain Query (if not in backend) → GraphQL player(owner)
  3. Auto-sync to backend if found on chain

WRITES (Dual Write):
  1. Submit to Blockchain (auto-signed) → mutation registerPlayer/submitRun
  2. Sync to Backend (fire-and-forget) → POST /api/scores
```

---

## 📜 Smart Contract

**Location:** `contracts/labyrinth_tournament/`

### Contract Structure

```
contracts/labyrinth_tournament/
├── Cargo.toml          # Rust dependencies
└── src/
    ├── lib.rs          # Types, enums, operations
    ├── contract.rs     # Business logic
    ├── service.rs      # GraphQL queries
    └── state.rs        # On-chain state (Linera Views)
```

### On-Chain State (`state.rs`)

```rust
pub struct LabyrinthState {
    // ID Counters
    pub next_tournament_id: RegisterView<u64>,
    pub next_run_id: RegisterView<u64>,

    // Core Data
    pub tournaments: MapView<u64, Tournament>,
    pub players: MapView<AccountOwner, Player>,
    pub runs: MapView<u64, GameRun>,

    // Tournament Data
    pub tournament_participants: MapView<(u64, AccountOwner), TournamentParticipant>,
    pub tournament_leaderboards: MapView<u64, Vec<LeaderboardEntry>>,
    pub tournament_rewards: MapView<(u64, AccountOwner), TournamentReward>,

    // Global Leaderboard
    pub practice_leaderboard: RegisterView<Vec<LeaderboardEntry>>,

    // Lookup Maps
    pub username_to_owner: MapView<String, AccountOwner>,
    pub player_runs: MapView<AccountOwner, Vec<u64>>,
}
```

### Data Types (`lib.rs`)

```rust
// Enums (SCREAMING_CASE in GraphQL)
pub enum GameMode { Practice, Tournament }
pub enum TournamentStatus { Upcoming, Active, Ended }
pub enum Difficulty { Easy, Medium, Hard, Nightmare }

// Player Profile
pub struct Player {
    pub owner: AccountOwner,
    pub username: String,
    pub discord_tag: Option<String>,
    pub total_xp: u64,
    pub practice_runs: u64,
    pub tournament_runs: u64,
    pub tournaments_played: u32,
    pub tournaments_won: u32,
    pub registered_at: Timestamp,
}

// Game Run Record
pub struct GameRun {
    pub id: u64,
    pub owner: AccountOwner,
    pub mode: GameMode,
    pub difficulty: Difficulty,
    pub level_reached: u32,
    pub time_ms: u64,
    pub deaths: u32,
    pub xp_earned: u64,
    pub created_at: Timestamp,
}
```

### Operations (Mutations)

```rust
pub enum Operation {
    // Player
    RegisterPlayer { username: String, discord_tag: Option<String> },
    UpdateProfile { username: Option<String>, discord_tag: Option<String> },
    
    // Tournament
    CreateTournament { title, difficulty, maze_seed, start_time, end_time, ... },
    UpdateTournamentStatus { tournament_id: u64, status: TournamentStatus },
    JoinTournament { tournament_id: u64 },
    
    // Gameplay
    SubmitRun { mode, tournament_id, difficulty, level_reached, time_ms, deaths, completed },
    ClaimTournamentReward { tournament_id: u64 },
}
```

### GraphQL Queries (`service.rs`)

```graphql
# Player queries
player(owner: String!): Player
playerByUsername(username: String!): Player
isRegistered(owner: String!): Boolean!

# Tournament queries
tournament(id: Int!): Tournament
tournaments(status: TournamentStatus): [Tournament!]!
activeTournaments: [Tournament!]!

# Leaderboard queries
practiceLeaderboard(limit: Int): [LeaderboardEntry!]!
tournamentLeaderboard(tournamentId: Int!, limit: Int): [LeaderboardEntry!]!

# Run queries
run(id: Int!): GameRun
playerRuns(owner: String!, limit: Int): [GameRun!]!
recentRuns(limit: Int): [GameRun!]!

# Stats
stats: Stats!
```

---

## 💻 Frontend Application

**Location:** `frontend/src/`

### Directory Structure

```
frontend/src/
├── App.tsx                    # Routes + Linera status banner
├── main.tsx                   # Entry point + providers
├── components/
│   ├── Layout.tsx             # Main layout with navbar
│   ├── DivisionBadge.tsx      # XP level badges
│   ├── StreakDisplay.tsx      # Win streak UI
│   └── layout/
│       └── Navbar.tsx         # Navigation + wallet button
├── pages/
│   ├── HomePage.tsx           # Landing page with stats
│   ├── AstrayPlayPage.tsx     # 🎮 MAIN GAME PAGE
│   ├── ProfilePage.tsx        # Player profile + stats
│   ├── LeaderboardPage.tsx    # Global rankings
│   ├── TournamentsPage.tsx    # Tournament list
│   └── TournamentDetailPage.tsx
├── hooks/
│   ├── index.ts
│   ├── useLineraConnection.ts # Linera wallet hook
│   └── useLabyrinth.ts        # Player data hook
├── lib/
│   ├── api.ts                 # Backend API calls
│   ├── wallet.ts              # Wallet utilities
│   ├── labyrinthApi.ts        # Hybrid API (backend + blockchain)
│   └── linera/
│       ├── index.ts
│       ├── lineraAdapter.ts   # 🔑 LINERA SINGLETON
│       ├── dynamicSigner.ts   # MetaMask signer
│       └── wasmInit.ts        # WASM initialization
├── stores/
│   ├── gameStore.ts           # Zustand game state
│   └── socketStore.ts         # Socket.IO state
└── types/
    └── index.ts               # TypeScript types
```

### Key Components

#### 1. AstrayPlayPage.tsx (Main Game)
```tsx
// Game iframe communicates via postMessage
useEffect(() => {
  function handleMessage(event: MessageEvent) {
    switch (event.data.type) {
      case 'levelStart': // Level begins
      case 'levelComplete': // Auto-submit every 3 levels
      case 'coinCollected': // Update score
    }
  }
  window.addEventListener('message', handleMessage);
}, []);

// Registration flow
const handleRegister = async () => {
  // 1. Register on blockchain (auto-signed)
  await lineraAdapter.mutate(REGISTER_PLAYER, { username });
  // 2. Sync to backend
  syncPlayerToBackendHelper(address, username, chainId);
};

// Score submission
const handleSubmitScore = async (time, deaths, level) => {
  // 1. Submit to blockchain
  await lineraAdapter.mutate(SUBMIT_RUN, { mode: 'PRACTICE', ... });
  // 2. Sync to backend
  syncScoreToBackendHelper(address, time, deaths, level, chainId);
};
```

#### 2. useLineraConnection.ts Hook
```tsx
export function useLineraConnection(): LineraConnectionState {
  // Auto-connect when wallet available
  useEffect(() => {
    if (primaryWallet && !autoConnectAttempted.current) {
      autoConnectAttempted.current = true;
      connect();
    }
  }, [primaryWallet]);

  const connect = async () => {
    // 1. Connect wallet to Linera (claims chain, sets up auto-signer)
    await lineraAdapter.connect(primaryWallet, FAUCET_URL);
    // 2. Connect to deployed application
    await lineraAdapter.connectApplication(APPLICATION_ID);
  };
}
```

#### 3. useLabyrinth.ts Hook
```tsx
export function useLabyrinth(): LabyrinthState {
  // Auto-load player when app connected
  useEffect(() => {
    if (isAppConnected && walletAddress && !hasLoaded) {
      loadPlayer();
    }
  }, [isAppConnected, walletAddress]);

  const loadPlayer = async () => {
    // Hybrid: backend first, then blockchain
    const playerData = await labyrinthApi.getPlayer(walletAddress);
  };
}
```

---

## 🖥 Backend Server

**Location:** `backend/src/`

### Structure

```
backend/src/
├── index.ts           # Express + Socket.IO server
├── types.ts           # TypeScript types
├── db/
│   └── memory.ts      # In-memory database with JSON persistence
├── config/
│   └── index.ts       # Environment config
└── routes/
    └── api.ts         # API routes (if separated)
```

### API Endpoints

```
GET  /health                    # Health check
GET  /api/stats                 # Server statistics
GET  /api/players/:wallet       # Get player profile
POST /api/players/register      # Register player (with signature)
POST /api/players/sync          # Sync player from blockchain
POST /api/scores                # Submit score (sync from blockchain)
GET  /api/players/:wallet/runs  # Get player's runs
GET  /api/tournaments           # List tournaments
GET  /api/tournaments/:id       # Tournament details
POST /api/tournaments           # Create tournament
POST /api/tournaments/:id/join  # Join tournament
POST /api/runs                  # Submit run (with signature)
GET  /api/leaderboard           # Practice leaderboard
```

### Key Endpoint: /api/scores (Blockchain Sync)

```typescript
app.post('/api/scores', (req, res) => {
  const { wallet_address, xp_earned, game_type } = req.body;
  
  // Get or create player
  let player = db.getPlayer(wallet_address);
  if (!player) {
    player = db.createPlayer({ walletAddress: wallet_address, username: `Player_${...}` });
  }
  
  // Update XP and runs
  player = db.updatePlayer(wallet_address, {
    totalXp: player.totalXp + xp_earned,
    practiceRuns: player.practiceRuns + 1,
  });
  
  // Emit Socket.IO event
  io.emit('runSubmitted', { walletAddress, xpEarned });
});
```

### Socket.IO Events

```typescript
// Server → Client
'playerRegistered'       // New player joined
'tournamentCreated'      // New tournament
'runSubmitted'           // Score submitted
'leaderboardUpdate'      // Leaderboard changed
'tournamentStatusChange' // Tournament started/ended
```

---

## 🎮 Game Engine (Astray)

**Location:** `frontend/public/astray/`

### Files

```
astray/
├── index.html        # Main game with enhanced features
├── maze.js           # Maze generation algorithm
├── Three.js          # 3D rendering
├── Box2dWeb.min.js   # Physics engine
├── keyboard.js       # Input handling
├── jquery.js         # DOM utilities
├── ball.png          # Ball texture
├── brick.png         # Wall texture
└── concrete.png      # Floor texture
```

### Enhanced Features

```javascript
// Collectibles per level
function getLevelConfig(level) {
  return {
    coinCount: 8 + level * 2,      // 10 points each
    gemCount: 1 + Math.floor(level / 2),  // 50 points each
    starCount: Math.min(level, 3),  // 100 points each
  };
}

// Combo system
combo = 0, comboTimer = 0, maxCombo = 0;
// Collecting within 2 seconds increases combo multiplier

// Score calculation
function calculateScore() {
  return coins * 10 * combo + gems * 50 * combo + stars * 100 * combo;
}

// Communication with parent React app
window.parent.postMessage({
  type: 'levelComplete',
  level: currentLevel,
  time: elapsedTime,
  score: totalScore,
  coins: coinsCollected,
  gems: gemsCollected,
  stars: starsCollected,
  maxCombo: maxCombo
}, '*');
```

---

## ⛓ Linera Blockchain Integration

### LineraAdapter Singleton (`lib/linera/lineraAdapter.ts`)

The core of blockchain integration - manages all Linera interactions:

```typescript
class LineraAdapterClass {
  private connection: LineraConnection | null = null;
  private appConnection: ApplicationConnection | null = null;

  // Connect to Linera Conway Testnet
  async connect(dynamicWallet: DynamicWallet): Promise<LineraConnection> {
    // 1. Initialize WASM
    await ensureWasmInitialized();
    
    // 2. Load @linera/client
    const { Faucet, Client, signer } = await import('@linera/client');
    
    // 3. Connect to faucet
    const faucet = new Faucet('https://faucet.testnet-conway.linera.net');
    
    // 4. Create wallet and claim chain
    const wallet = await faucet.createWallet();
    const chainId = await faucet.claimChain(wallet, userAddress);
    
    // 5. Setup auto-signing (NO wallet popups!)
    const autoSigner = signer.PrivateKey.createRandom();
    const chain = await client.chain(chainId);
    await chain.addOwner(autoSigner.address()); // One-time signature
    await wallet.setOwner(chainId, autoSigner.address());
    
    return { client, wallet, chainId, address };
  }

  // Connect to deployed application
  async connectApplication(appId: string): Promise<ApplicationConnection> {
    const chain = await this.connection.client.chain(this.connection.chainId);
    const application = await chain.application(appId);
    return { application, applicationId: appId };
  }

  // Execute GraphQL query
  async query<T>(query: string, variables?: object): Promise<T> {
    const response = await this.appConnection.application.query(query, variables);
    return response.data as T;
  }

  // Execute GraphQL mutation (auto-signed!)
  async mutate<T>(mutation: string, variables?: object): Promise<T> {
    const response = await this.appConnection.application.mutate(mutation, variables);
    return response.data as T;
  }
}

export const lineraAdapter = LineraAdapterClass.getInstance();
```

### Auto-Signing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User connects MetaMask (Dynamic Labs)                        │
│    └─► Creates DynamicSigner for wallet operations              │
├─────────────────────────────────────────────────────────────────┤
│ 2. Connect to Linera Faucet                                     │
│    └─► Claims new microchain for user's EVM address             │
├─────────────────────────────────────────────────────────────────┤
│ 3. Create Auto-Signer                                           │
│    └─► Random in-memory key (PrivateKey.createRandom())         │
├─────────────────────────────────────────────────────────────────┤
│ 4. Add Auto-Signer as Chain Owner                               │
│    └─► ONE MetaMask popup (chain.addOwner)                      │
├─────────────────────────────────────────────────────────────────┤
│ 5. All future transactions auto-signed                          │
│    └─► No more popups! Game runs smoothly                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Guide

### Prerequisites

```bash
# Install Linera CLI
cargo install linera-sdk@0.15.8

# Install Node.js dependencies
pnpm install
```

### Deploy Smart Contract

```bash
# 1. Initialize wallet with faucet
linera wallet init --faucet https://faucet.testnet-conway.linera.net

# 2. Build contract
cd contracts/labyrinth_tournament
cargo build --release --target wasm32-unknown-unknown

# 3. Publish bytecode
linera publish-bytecode \
  target/wasm32-unknown-unknown/release/labyrinth_tournament_contract.wasm \
  target/wasm32-unknown-unknown/release/labyrinth_tournament_service.wasm

# 4. Create application
linera create-application <bytecode_id> \
  --json-argument '{"hub_chain_id":"<your-chain-id>"}'

# Output: Application ID (save this!)
# 14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a
```

### Configure Frontend

```bash
# .env file
VITE_LINERA_APP_ID=14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a
VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
VITE_API_URL=http://localhost:3001
```

### Run Development

```bash
# Terminal 1: Backend
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev
```

---

## 📚 API Reference

### GraphQL Mutations

```graphql
# Register player (auto-signed)
mutation RegisterPlayer($username: String!) {
  registerPlayer(username: $username)
}

# Submit game run (auto-signed)
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
```

### GraphQL Queries

```graphql
# Get player
query GetPlayer($owner: String!) {
  player(owner: $owner) {
    owner
    username
    totalXp
    practiceRuns
    tournamentRuns
    tournamentsPlayed
    tournamentsWon
    registeredAt
  }
}

# Get leaderboard
query GetLeaderboard($limit: Int) {
  practiceLeaderboard(limit: $limit) {
    rank
    owner
    username
    bestTimeMs
    totalXp
  }
}
```

---

## ✅ Key Features Implemented

### ✅ Blockchain Features
- [x] Linera Conway Testnet integration
- [x] Auto-signing (no wallet popups during gameplay)
- [x] On-chain player registration
- [x] On-chain score submission
- [x] On-chain leaderboards
- [x] Tournament system (create, join, rewards)

### ✅ Game Features
- [x] 3D maze game (Astray engine)
- [x] Progressive difficulty (levels 1-∞)
- [x] Collectibles (coins, gems, stars)
- [x] Combo system
- [x] Score auto-submit every 3 levels
- [x] XP and leveling system

### ✅ UI/UX Features
- [x] Medieval/dungeon theme
- [x] Responsive design
- [x] Framer Motion animations
- [x] Real-time leaderboard updates
- [x] Profile page with stats
- [x] Tournament browser (Coming Soon placeholder)
- [x] "Click to Play" hint in game for keyboard activation
- [x] "Connecting to Linera Conway" loading state with animations

### ✅ Backend Features
- [x] Express.js REST API
- [x] Socket.IO for real-time updates
- [x] In-memory database with JSON persistence
- [x] Player sync endpoint (blockchain → backend)
- [x] Score sync endpoint with best time tracking
- [x] Leaderboard aggregation with auto-rebuild

---

## 🛠 Recent Updates & Bug Fixes

### XP Calculation Fix
- **Issue**: XP displayed was much higher than contract calculation
- **Solution**: Created `calculateXpMatchingContract()` function that exactly matches the smart contract formula:
  ```javascript
  // Base XP by difficulty (matches contract)
  Easy: 75, Medium: 100, Hard: 125, Nightmare: 150
  
  // Formula: base + completion_bonus + time_bonus - death_penalty
  completion_bonus = completed ? base * 0.5 : 0
  time_bonus = max(0, (300000 - time_ms) / 1000)  // Up to 300 bonus for fast times
  death_penalty = deaths * 10
  ```
- **Files Changed**: `AstrayPlayPage.tsx`, `gameConfig.ts` (frontend & backend), `wallet.ts`

### Leaderboard Not Showing Players
- **Issue**: New players weren't appearing on the leaderboard
- **Solution**: Added `db.updatePracticeLeaderboard(wallet_address)` call in `/api/scores` endpoint
- **File Changed**: `backend/src/index.ts`

### Best Time Tracking
- **Issue**: Best time wasn't being recorded or displayed
- **Solution**: 
  - Frontend now sends `time_ms` to backend via `/api/scores`
  - Backend tracks `bestPracticeTimeMs` and updates it when a faster time is achieved
- **Files Changed**: `AstrayPlayPage.tsx`, `backend/src/index.ts`, `backend/src/db/memory.ts`

### Profile Page Loading State
- **Issue**: Profile page showed blank while connecting to blockchain
- **Solution**: Added beautiful "Connecting to Linera Conway" loading screen with:
  - Animated shield icon
  - Rotating border animation
  - Step-by-step connection indicators
  - Themed styling matching the game
- **File Changed**: `ProfilePage.tsx`

### Game Click-to-Play Hint
- **Issue**: Users didn't know they needed to click the game to activate keyboard controls
- **Solution**: Added pulsing "👆 Click anywhere to start playing" message at bottom of game screen
  - Automatically fades out on first click or keypress
  - Cyan glow styling matching game theme
- **File Changed**: `frontend/public/astray/index.html`

### Tournament Page Placeholder
- **Issue**: Tournament functionality not ready for production
- **Solution**: Replaced full tournament system with beautiful "Coming Soon" page featuring:
  - Animated floating crown/shield icon
  - Feature preview cards (Multiplayer, XP Prizes, Timed Events)
  - Links to Practice and Leaderboard
  - Medieval themed design
- **File Changed**: `TournamentsPage.tsx`

---

## 🔗 Resources & References

### Linera Documentation
- [Linera SDK Docs](https://linera.dev/)
- [Conway Testnet Faucet](https://faucet.testnet-conway.linera.net)
- [@linera/client NPM](https://www.npmjs.com/package/@linera/client)

### Reference Projects
- [Linera-Arcade](https://github.com/mohamedwael201193/Linera-Arcade) - Similar hybrid architecture
- [Astray Game](https://github.com/wwwtyro/Astray) - Original maze game

### Deployed Contract Info

| Property | Value |
|----------|-------|
| **Network** | Conway Testnet |
| **Application ID** | `14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a` |
| **Faucet URL** | `https://faucet.testnet-conway.linera.net` |

---

## 📝 Notes

### Known Issues
1. **Chain persistence**: Each browser session claims a new chain from faucet. Previous registrations may be on old chains.
2. **Testnet stability**: Conway validators occasionally have SSL/CORS errors.
3. **Solution**: Backend sync ensures player data persists across chain changes.

### Resolved Issues ✅
1. **XP Calculation Mismatch**: Fixed frontend XP calculation to match smart contract formula exactly
2. **Leaderboard Empty**: Fixed by calling `updatePracticeLeaderboard()` on score submission
3. **Best Time Not Tracked**: Added `time_ms` sync and `bestPracticeTimeMs` field in backend
4. **Profile Blank Loading**: Added animated "Connecting to Conway" loading state
5. **Game Controls Unclear**: Added click-to-play hint message in game

### Future Improvements
- [ ] NFT rewards for tournament winners
- [ ] Multiplayer real-time racing
- [ ] Custom maze editor
- [ ] Discord bot integration
- [ ] Mobile responsive game controls
- [ ] Full tournament system implementation

---

*Built with ❤️ for the Linera Conway Testnet Hackathon*
*Last Updated: January 2026*
