# 🎯 AGENTHUB IMPLEMENTATION GUIDELINE

> **Complete step-by-step guide to building a Linera dApp with Dynamic.xyz wallet integration**

This document explains EVERYTHING we did to build AgentHub - a full-stack dApp on Linera Conway testnet. Use this as a blueprint to build similar projects without errors.

---

## 📚 TABLE OF CONTENTS

1. [Project Setup](#1-project-setup)
2. [Linera Smart Contract](#2-linera-smart-contract)
3. [Contract Deployment (Create Chain & Deploy)](#3-contract-deployment)
4. [Backend Setup](#4-backend-setup)
5. [Frontend Setup](#5-frontend-setup)
6. [Wallet Integration (Critical)](#6-wallet-integration-critical)
7. [Chain Connection Flow](#7-chain-connection-flow)
   - 7.5 [Auto-Signing (Session-Based)](#75-auto-signing-session-based---important)
8. [GraphQL Integration](#8-graphql-integration)
9. [Data Transformation Layer](#9-data-transformation-layer)
10. [Deployment](#10-deployment)
11. [Common Errors & Solutions](#11-common-errors--solutions)
12. [Testing Checklist](#12-testing-checklist)
13. [Signal Resolution Logic](#13-signal-resolution-logic)
14. [Complete File Reference](#14-complete-file-reference)
15. [Quick Start Commands](#15-quick-start-commands)

---

## 1. PROJECT SETUP

### Directory Structure
```
AgentHub/
├── contracts/
│   └── agent_hub/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs        # Types, ABI, enums
│           ├── contract.rs   # Business logic
│           ├── service.rs    # GraphQL queries
│           └── state.rs      # On-chain state
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.ts          # Express server
│       ├── routes/api.ts     # REST endpoints
│       ├── db/memory.ts      # In-memory DB
│       ├── services/
│       │   ├── resolver.ts   # Auto-resolve signals
│       │   └── priceService.ts
│       └── types.ts
├── frontend/
│   ├── package.json
│   ├── vercel.json           # Deployment config
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   ├── api.ts        # Backend API client
│       │   └── chain/
│       │       ├── init.ts   # WASM initialization
│       │       ├── signer.ts # Wallet adapter
│       │       ├── connection.ts
│       │       ├── operations.ts
│       │       └── useChain.ts
│       ├── pages/
│       └── components/
└── scripts/
    └── deploy.sh             # Deployment script
```

### Initial Dependencies

**Contract (Cargo.toml):**
```toml
[package]
name = "agent_hub"
version = "0.1.0"
edition = "2021"

[dependencies]
linera-sdk = "0.15.8"
async-graphql = "7.0"
serde = { version = "1.0", features = ["derive"] }
thiserror = "1.0"
```

**Backend (package.json):**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "zod": "^3.22.4",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "tsx": "^4.0.0"
  }
}
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@linera/client": "0.15.8",
    "@dynamic-labs/sdk-react-core": "^3.4.9",
    "@dynamic-labs/ethereum": "^3.4.9",
    "@tanstack/react-query": "^5.17.19",
    "framer-motion": "^11.0.3",
    "lucide-react": "^0.316.0",
    "tailwindcss": "^3.4.1",
    "vite": "^5.0.11"
  }
}
```

---

## 2. LINERA SMART CONTRACT

### 2.1 Define Types (lib.rs)

```rust
use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

// Market types - CRITICAL: These become GraphQL enums
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum)]
pub enum MarketKind {
    Crypto,           // Becomes "CRYPTO" in GraphQL
    Sports,           // Becomes "SPORTS" in GraphQL
    PredictionApp,    // Becomes "PREDICTION_APP" in GraphQL
}

// Direction - CRITICAL: GraphQL enum naming
#[derive(Clone, Copy, Debug, Deserialize, Serialize, async_graphql::Enum)]
pub enum Direction {
    Up,     // GraphQL: "UP"
    Down,   // GraphQL: "DOWN"
    Over,   // GraphQL: "OVER"
    Under,  // GraphQL: "UNDER"
    Yes,    // GraphQL: "YES"
    No,     // GraphQL: "NO"
}

// Operations (mutations that require wallet signing)
#[derive(Debug, Deserialize, Serialize)]
pub enum Operation {
    RegisterStrategist { display_name: String },
    CreateAgentStrategy {
        name: String,
        description: String,
        market_kind: MarketKind,
        base_market: String,
        is_public: bool,
        is_ai_controlled: bool,
    },
    PublishSignal {
        strategy_id: u64,
        direction: Direction,
        horizon_secs: u64,
        confidence_bps: u32,
        entry_value: Option<i64>,
    },
    FollowStrategy {
        strategy_id: u64,
        auto_copy: bool,
        max_exposure_units: u64,
    },
    UnfollowStrategy {
        strategy_id: u64,
    },
    // ... more operations
}

// Strategist struct
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct Strategist {
    pub owner: AccountOwner,
    pub display_name: String,
    pub created_at: Timestamp,
}

// Agent Strategy struct
#[derive(Clone, Debug, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct AgentStrategy {
    pub id: u64,
    pub owner: AccountOwner,
    pub name: String,
    pub description: String,
    pub market_kind: MarketKind,
    pub base_market: String,
    pub is_public: bool,
    pub is_ai_controlled: bool,
    pub created_at: Timestamp,
}

// ABI definition
linera_sdk::contract!(AgentHubContract);
```

### 2.2 State Management (state.rs)

```rust
use linera_sdk::views::{MapView, RegisterView, RootView};

#[derive(RootView)]
pub struct AgentHubState {
    // Counters
    pub next_strategy_id: RegisterView<u64>,
    pub next_signal_id: RegisterView<u64>,
    
    // Data stores
    pub strategists: MapView<AccountOwner, Strategist>,
    pub strategies: MapView<u64, AgentStrategy>,
    pub signals: MapView<u64, Signal>,
    pub followers: MapView<FollowerKey, Follower>,
    pub follower_count: MapView<u64, u64>,
    pub strategy_stats: MapView<u64, StrategyStats>,
}
```

### 2.3 Contract Logic (contract.rs)

```rust
impl Contract for AgentHubContract {
    async fn execute_operation(&mut self, operation: Operation) -> AgentHubResponse {
        // CRITICAL: Get authenticated signer
        let owner = match self.runtime.authenticated_signer() {
            Some(signer) => AccountOwner::from(signer),
            None => return AgentHubResponse::Error { 
                message: "Not authenticated".to_string() 
            },
        };

        match operation {
            Operation::CreateAgentStrategy { name, description, ... } => {
                // Verify strategist is registered
                if !self.state.strategists.contains_key(&owner).await? {
                    return AgentHubError::StrategistNotRegistered.into();
                }

                // Generate ID and create strategy
                let id = *self.state.next_strategy_id.get();
                self.state.next_strategy_id.set(id + 1);

                let strategy = AgentStrategy {
                    id,
                    owner,
                    name,
                    description,
                    market_kind,
                    base_market,
                    is_public,
                    is_ai_controlled,
                    created_at: self.now(),
                };

                self.state.strategies.insert(&id, strategy)?;
                
                // Initialize stats
                let stats = StrategyStats::default();
                self.state.strategy_stats.insert(&id, stats)?;
                
                // Initialize follower count
                self.state.follower_count.insert(&id, 0)?;

                AgentHubResponse::StrategyCreated { id }
            },
            // ... other operations
        }
    }
}
```

### 2.4 GraphQL Service (service.rs)

```rust
use async_graphql::{Context, EmptySubscription, Object, Schema};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn strategies(&self, ctx: &Context<'_>) -> Vec<AgentStrategy> {
        let state = ctx.data::<AgentHubState>().unwrap();
        state.strategies.indices().await.unwrap()
            .map(|id| state.strategies.get(&id).await.unwrap().unwrap())
            .collect()
    }
}

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    async fn register_strategist(
        &self,
        ctx: &Context<'_>,
        display_name: String,
    ) -> Result<bool> {
        // This triggers Operation::RegisterStrategist
        Ok(true)
    }
}

pub type AgentHubSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;
```

---

## 3. CONTRACT DEPLOYMENT

### 3.1 Install Linera CLI

```bash
# Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm target
rustup target add wasm32-unknown-unknown

# Install Linera CLI tools
cargo install linera-service
```

### 3.2 Create Your Own Chain (Hub Chain)

This is a CRITICAL step - you need your OWN chain to deploy your application.

```bash
# Step 1: Initialize a new wallet with a new chain from Conway faucet
linera wallet init --with-new-chain --faucet https://faucet.testnet-conway.linera.net

# Step 2: View your wallet and get your CHAIN ID
linera wallet show

# Output will look like:
# ╭────────────────────────────────────────────────────────────────────╮
# │ Chain ID                                                           │
# ├────────────────────────────────────────────────────────────────────┤
# │ e0714069de69f3e7277e2831cc8e6a4a79dc913cb56e6acccf15e6be3832d291  │
# ╰────────────────────────────────────────────────────────────────────╯

# SAVE THIS CHAIN ID! You'll use it in:
# 1. Contract deployment (--json-argument)
# 2. Frontend env (VITE_LINERA_CHAIN_ID)
```

**IMPORTANT:** The chain ID you get from `linera wallet show` becomes your **Hub Chain ID**. This is where your application lives.

### 3.3 Build the Contract

```bash
cd contracts/agent_hub

# Build both contract and service WASM files
cargo build --release --target wasm32-unknown-unknown

# Verify the files were created:
ls -la target/wasm32-unknown-unknown/release/*.wasm

# You should see:
# - agent_hub_contract.wasm  (contract logic)
# - agent_hub_service.wasm   (GraphQL service)
```

### 3.4 Deploy Contract to Conway Testnet

**CRITICAL COMMAND - This is how you deploy:**

```bash
# Deploy using publish-and-create
# NOTE: Use --json-argument (NOT --json-parameters)
linera publish-and-create \
  target/wasm32-unknown-unknown/release/agent_hub_contract.wasm \
  target/wasm32-unknown-unknown/release/agent_hub_service.wasm \
  --json-argument '{"hub_chain_id": "YOUR_CHAIN_ID_FROM_STEP_2"}'
```

**Example with real chain ID:**
```bash
linera publish-and-create \
  target/wasm32-unknown-unknown/release/agent_hub_contract.wasm \
  target/wasm32-unknown-unknown/release/agent_hub_service.wasm \
  --json-argument '{"hub_chain_id": "e0714069de69f3e7277e2831cc8e6a4a79dc913cb56e6acccf15e6be3832d291"}'
```

**Expected Output:**
```
2026-01-03T12:00:00.000000Z  INFO linera: Publishing and creating application...
Application ID: e0298eccc11f6feff7c1f442edc0116e2f15665fbed495d055ee504a56531e8a
```

### 3.5 Save Your Deployment Values

After deployment, save these THREE critical values:

| Value | Example | Where to Use |
|-------|---------|--------------|
| **Hub Chain ID** | `e0714069de69f3e7277e2831cc8e6a4a79dc913cb56e6acccf15e6be3832d291` | `VITE_LINERA_CHAIN_ID` |
| **Application ID** | `e0298eccc11f6feff7c1f442edc0116e2f15665fbed495d055ee504a56531e8a` | `VITE_LINERA_APP_ID` |
| **Faucet URL** | `https://faucet.testnet-conway.linera.net` | `VITE_LINERA_FAUCET_URL` |

### 3.6 Verify Deployment

```bash
# Start a local node to interact with your app
linera service --port 8080

# In another terminal, query your app
curl -X POST http://localhost:8080/chains/YOUR_CHAIN_ID/applications/YOUR_APP_ID \
  -H "Content-Type: application/json" \
  -d '{"query": "{ strategies { id name } }"}'
```

### 3.7 Common Deployment Errors

**Error: "No chain found"**
```bash
# Solution: Re-initialize wallet with faucet
linera wallet init --with-new-chain --faucet https://faucet.testnet-conway.linera.net
```

**Error: "Invalid JSON argument"**
```bash
# Wrong: --json-parameters
# Correct: --json-argument
linera publish-and-create ... --json-argument '{"hub_chain_id": "..."}'
```

**Error: "WASM file not found"**
```bash
# Make sure you're in the project root, not contracts/agent_hub
cd /path/to/AgentHub
linera publish-and-create \
  contracts/agent_hub/target/wasm32-unknown-unknown/release/agent_hub_contract.wasm \
  contracts/agent_hub/target/wasm32-unknown-unknown/release/agent_hub_service.wasm \
  --json-argument '{"hub_chain_id": "..."}'
```


**Save these values:**
- `APPLICATION_ID` (app ID)
- `HUB_CHAIN_ID` (chain where app is deployed)
- `FAUCET_URL`: `https://faucet.testnet-conway.linera.net`

---

## 4. BACKEND SETUP

### 4.1 Environment Variables

Create `.env`:
```env
PORT=3002
NODE_ENV=production
CRYPTOCOMPARE_API_KEY=your_key_here
```

### 4.2 In-Memory Database with Persistence

**backend/src/db/memory.ts:**
```typescript
import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.join(__dirname, '../../data.json');

// In-memory stores
let strategists = new Map<string, Strategist>();
let strategies = new Map<number, AgentStrategy>();
let signals = new Map<number, Signal>();
let strategyStats = new Map<number, StrategyStats>();
let followers = new Map<string, Follower>();

// Save to file
function saveData() {
  const data = {
    strategists: Array.from(strategists.entries()),
    strategies: Array.from(strategies.entries()),
    signals: Array.from(signals.entries()),
    strategyStats: Array.from(strategyStats.entries()),
    followers: Array.from(followers.entries()),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Load from file
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    strategists = new Map(data.strategists || []);
    strategies = new Map(data.strategies || []);
    signals = new Map(data.signals || []);
    strategyStats = new Map(data.strategyStats || []);
    followers = new Map(data.followers || []);
    
    // Convert date strings back to Date objects
    for (const [key, value] of signals) {
      value.created_at = new Date(value.created_at);
      value.expires_at = new Date(value.expires_at);
      if (value.resolved_at) value.resolved_at = new Date(value.resolved_at);
    }
  }
}

loadData();
setInterval(saveData, 30000); // Auto-save every 30s
```

### 4.3 Auto-Resolver Service

**backend/src/services/resolver.ts:**
```typescript
import { Database, Signal } from '../types';
import { getPrices } from './priceService';
import type { Server } from 'socket.io';

export function startResolver(config: {
  db: Database;
  io: Server;
  intervalMs: number;
}) {
  setInterval(async () => {
    try {
      const expired = await config.db.getExpiredUnresolvedSignals();
      if (expired.length === 0) return;

      console.log(`📊 Found ${expired.length} expired signals to resolve`);

      const prices = await getPrices();
      
      for (const signal of expired) {
        // Get current price in cents
        const currentPrice = signal.direction.toLowerCase().includes('btc')
          ? prices.btc * 100
          : prices.eth * 100;

        const resolved = await config.db.resolveSignal({
          signal_id: signal.id,
          resolved_value: Math.round(currentPrice),
        });

        if (resolved) {
          // Broadcast via WebSocket
          config.io.emit('signal:resolved', resolved);
          console.log(`✅ Resolved signal ${signal.id}: ${resolved.result}`);
        }
      }
    } catch (error) {
      console.error('❌ Resolver error:', error);
    }
  }, config.intervalMs);
}
```

### 4.4 Express Server

**backend/src/index.ts:**
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { memoryDb } from './db/memory';
import apiRoutes from './routes/api';
import { startResolver } from './services/resolver';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

// Start auto-resolver
startResolver({ db: memoryDb, io, intervalMs: 30000 });

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

---

## 5. FRONTEND SETUP

### 5.1 Environment Variables

**frontend/.env:**
```env
VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
VITE_LINERA_APP_ID=e0298eccc11f6feff7c1f442edc0116e2f15665fbed495d055ee504a56531e8a
VITE_LINERA_CHAIN_ID=e0714069de69f3e7277e2831cc8e6a4a79dc913cb56e6acccf15e6be3832d291
VITE_API_URL=https://agenthub-backend-8vzy.onrender.com
VITE_DYNAMIC_ENV_ID=your_dynamic_environment_id
```

### 5.2 Vite Config for WASM

**frontend/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@linera/client'],
  },
});
```

### 5.3 Vercel Deployment Config

**frontend/vercel.json:**
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api|assets|static).*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 6. WALLET INTEGRATION (CRITICAL)

This section is THE MOST IMPORTANT for Linera integration.

### 6.1 Dynamic.xyz Setup

**frontend/src/App.tsx:**
```typescript
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <YourApp />
    </DynamicContextProvider>
  );
}
```

### 6.2 Linera Signer Implementation

**frontend/src/lib/chain/signer.ts:**

This is CRITICAL - it adapts Dynamic.xyz wallet to Linera's Signer interface.

```typescript
import type { Signer } from '@linera/client';

interface DynamicWallet {
  address?: string;
  getWalletClient(): Promise<any>;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class EvmChainSigner implements Signer {
  private dynamicWallet: DynamicWallet;
  private walletAddress: string;

  constructor(dynamicWallet: DynamicWallet) {
    this.dynamicWallet = dynamicWallet;
    if (!dynamicWallet.address) {
      throw new Error('Wallet address not available');
    }
    this.walletAddress = dynamicWallet.address.toLowerCase();
  }

  async containsKey(owner: string): Promise<boolean> {
    return owner.toLowerCase() === this.walletAddress;
  }

  /**
   * CRITICAL: Use personal_sign, NOT signMessage
   * 
   * Why? signMessage adds an Ethereum prefix and hashes the message,
   * which breaks Linera's signature verification.
   * 
   * personal_sign signs the raw bytes directly.
   */
  async sign(owner: string, value: Uint8Array): Promise<string> {
    const canSign = await this.containsKey(owner);
    if (!canSign) {
      throw new Error(`Cannot sign for owner ${owner}`);
    }

    try {
      const walletClient = await this.dynamicWallet.getWalletClient();
      const messageHex = `0x${uint8ArrayToHex(value)}`;
      
      // Use personal_sign RPC method directly
      const signature = await walletClient.request({
        method: 'personal_sign',
        params: [messageHex, this.walletAddress],
      });

      console.log('✍️ Message signed successfully');
      return signature;
    } catch (error) {
      console.error('❌ Failed to sign message:', error);
      throw error;
    }
  }
}

export function createChainSigner(dynamicWallet: DynamicWallet): Signer {
  return new EvmChainSigner(dynamicWallet);
}
```

**KEY LEARNINGS:**
1. **DO NOT** use `connector.signMessage()` - it double-hashes
2. **DO** use `walletClient.request({ method: 'personal_sign' })`
3. Convert `Uint8Array` to hex with `0x` prefix
4. Lowercase all addresses for consistency

---

## 7. CHAIN CONNECTION FLOW

### 7.1 WASM Initialization

**frontend/src/lib/chain/init.ts:**
```typescript
let wasmInitialized = false;

export async function ensureChainInitialized(): Promise<void> {
  if (wasmInitialized) return;

  console.log('🔧 Initializing Linera WASM...');
  
  try {
    const { initializeWasm } = await import('@linera/client');
    await initializeWasm();
    wasmInitialized = true;
    console.log('✅ WASM initialized');
  } catch (error) {
    console.error('❌ WASM initialization failed:', error);
    throw error;
  }
}
```

### 7.2 Connection Manager

**frontend/src/lib/chain/connection.ts:**

```typescript
import type { Signer } from '@linera/client';
import { ensureChainInitialized } from './init';
import { createChainSigner } from './signer';

const FAUCET_URL = import.meta.env.VITE_LINERA_FAUCET_URL;
const APPLICATION_ID = import.meta.env.VITE_LINERA_APP_ID;

class ChainManager {
  private connection: ChainConnection | null = null;
  private appConnection: AppConnection | null = null;

  /**
   * Connect to Conway testnet
   * 
   * Flow:
   * 1. Initialize WASM
   * 2. Connect to faucet
   * 3. Create Linera wallet (gets genesis config)
   * 4. Claim microchain for user's address
   * 5. Create signer and client
   */
  async connect(dynamicWallet: any): Promise<ChainConnection> {
    if (this.connection) return this.connection;

    try {
      console.log('🔗 Connecting to Conway testnet...');
      
      // Step 1: Initialize WASM
      await ensureChainInitialized();
      
      // Step 2: Import Linera client
      const { Faucet, Client } = await import('@linera/client');
      
      // Step 3: Connect to faucet
      const faucet = new Faucet(FAUCET_URL);
      
      // Step 4: Create wallet (gets genesis config from faucet)
      const wallet = await faucet.createWallet();
      
      // Step 5: Get user's address
      const userAddress = dynamicWallet.address?.toLowerCase();
      if (!userAddress) throw new Error('Wallet address not available');
      
      // Step 6: Claim microchain for this user
      // IMPORTANT: Each user gets their OWN microchain
      console.log(`⛓️ Claiming microchain for ${userAddress}...`);
      const chainId = await faucet.claimChain(wallet, userAddress);
      console.log(`✅ Claimed chain: ${chainId}`);
      
      // Step 7: Create signer and client
      const signer = createChainSigner(dynamicWallet);
      const client = await new Client(wallet, signer);
      
      this.connection = {
        client,
        wallet,
        faucet,
        chainId,
        address: userAddress,
        signer,
      };

      console.log('✅ Connected to Conway testnet!');
      return this.connection;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      throw error;
    }
  }

  /**
   * Connect to the AgentHub application
   * 
   * CRITICAL: Use the USER's microchain, NOT the hub chain!
   * 
   * Why? In Linera, users interact with applications through their own
   * microchain. The app ID contains routing info to the hub chain.
   */
  async connectApplication(applicationId?: string): Promise<AppConnection> {
    const appId = applicationId || APPLICATION_ID;
    
    if (!this.connection) {
      throw new Error('Must connect wallet first');
    }

    if (this.appConnection?.applicationId === appId) {
      return this.appConnection;
    }

    try {
      console.log(`📱 Connecting to application: ${appId.slice(0, 16)}...`);
      
      // IMPORTANT: Use the USER's chain, not hub chain
      const userChainId = this.connection.chainId;
      console.log(`⛓️ Opening user's chain: ${userChainId.slice(0, 16)}...`);
      const chain = await this.connection.client.chain(userChainId);
      
      // Get application - app ID includes hub chain routing info
      const application = await chain.application(appId);
      
      this.appConnection = {
        application,
        applicationId: appId,
      };

      console.log('✅ Connected to application!');
      return this.appConnection;
    } catch (error) {
      console.error('❌ Application connection failed:', error);
      throw error;
    }
  }

  disconnect() {
    this.connection = null;
    this.appConnection = null;
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  isAppConnected(): boolean {
    return this.appConnection !== null;
  }

  getConnection(): ChainConnection | null {
    return this.connection;
  }

  getAppConnection(): AppConnection | null {
    return this.appConnection;
  }
}

export const chainManager = new ChainManager();

// Helper functions
export async function connectChain(wallet: any) {
  return chainManager.connect(wallet);
}

export async function connectApp(appId?: string) {
  return chainManager.connectApplication(appId);
}

export async function chainQuery<T>(query: string, variables?: any): Promise<T> {
  const app = chainManager.getAppConnection();
  if (!app) throw new Error('Not connected to application');
  
  const result = await app.application.graphqlQuery(query, variables);
  return result;
}

export async function chainMutate<T>(mutation: string, variables?: any): Promise<T> {
  const app = chainManager.getAppConnection();
  if (!app) throw new Error('Not connected to application');
  
  const result = await app.application.graphqlMutation(mutation, variables);
  return result;
}
```

**CRITICAL ARCHITECTURE LESSON:**

```
Hub Chain (where app is deployed)
   ├─ App ID: e0298eccc11f6feff7c1f442edc0116e2f15665fbed495d055ee504a56531e8a
   │
User A's Microchain ──► application(APP_ID) ──► Interacts with app on hub chain
User B's Microchain ──► application(APP_ID) ──► Interacts with app on hub chain
User C's Microchain ──► application(APP_ID) ──► Interacts with app on hub chain
```

**WHY THIS MATTERS:**
- Users don't directly access the hub chain
- They interact through their OWN microchain
- The app ID routes requests to the hub chain
- This is how Linera achieves scalability

---

## 7.5 AUTO-SIGNING (Session-Based - IMPORTANT!)

### The Problem with Web3 UX
Traditional web3 apps require a wallet signature popup for EVERY transaction:
- User clicks "Follow Strategy" → Popup
- User creates signal → Popup
- User resolves signal → Popup

This creates terrible UX compared to Web2 apps.

### The Solution: Session-Based Auto-Signing (Linera v0.15.8+)
Linera SDK introduces auto-signing where:
1. User signs ONCE when connecting wallet
2. All subsequent operations use an in-memory auto-signer
3. No more popups for the entire session!

### 7.5.1 How Auto-Signing Works

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTO-SIGNING FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User connects wallet                                     │
│     ↓                                                        │
│  2. Create random in-memory auto-signer (PrivateKey)         │
│     ↓                                                        │
│  3. Combine with wallet signer (Composite)                   │
│     ↓                                                        │
│  4. User signs ONCE to add auto-signer as chain owner        │
│     [ONLY POPUP THE USER WILL SEE]                          │
│     ↓                                                        │
│  5. Set auto-signer as default owner                         │
│     ↓                                                        │
│  6. ALL FUTURE OPERATIONS USE AUTO-SIGNER                    │
│     [NO MORE POPUPS!]                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.5.2 Implementation

**frontend/src/lib/chain/signer.ts:**

```typescript
import type { Signer } from '@linera/client';

/**
 * Interface for auto-signer setup result
 */
export interface AutoSignerSetup {
  compositeSigner: Signer;
  autoSignerAddress: string;
  dynamicSigner: EvmChainSigner;
}

/**
 * Create a composite signer with auto-signing support
 * 
 * CRITICAL: Order matters!
 * - autoSigner FIRST (for automatic operations)
 * - dynamicSigner SECOND (fallback for user operations)
 * 
 * Composite tries each signer in order until one has the key
 */
export async function createAutoSignerSetup(
  dynamicWallet: DynamicWallet,
  signerModule: { 
    PrivateKey: { createRandom: () => any };
    Composite: new (...signers: Signer[]) => Signer;
  }
): Promise<AutoSignerSetup> {
  console.log('🔑 Setting up auto-signing...');
  
  // Create the Dynamic wallet signer
  const dynamicSigner = new EvmChainSigner(dynamicWallet);
  
  // Create random in-memory auto-signer
  // This key exists only in memory for this session
  const autoSigner = signerModule.PrivateKey.createRandom();
  const autoSignerAddress = autoSigner.address();
  console.log(`   Auto-signer address: ${autoSignerAddress}`);
  
  // Combine signers: autoSigner FIRST, dynamic SECOND
  const compositeSigner = new signerModule.Composite(autoSigner, dynamicSigner);
  
  console.log('✅ Auto-signer setup complete');
  
  return {
    compositeSigner,
    autoSignerAddress,
    dynamicSigner,
  };
}
```

**frontend/src/lib/chain/connection.ts:**

```typescript
async connect(dynamicWallet: any): Promise<ChainConnection> {
  // ... initialization code ...
  
  // Import Linera client with signer module
  const lineraModule = await import('@linera/client');
  const { Faucet, Client, signer: signerModule } = lineraModule;
  
  // ... faucet connection, wallet creation, chain claiming ...
  
  // Step 7: Set up auto-signing
  const autoSignerSetup = await createAutoSignerSetup(
    dynamicWallet, 
    signerModule
  );
  
  // Step 8: Create client with composite signer
  const client = await new Client(wallet, autoSignerSetup.compositeSigner);
  
  // Step 9: Add auto-signer as chain owner (ONE-TIME signature!)
  const chain = await client.chain(chainId);
  
  try {
    // This is the ONLY wallet popup the user will see!
    await chain.addOwner(autoSignerSetup.autoSignerAddress);
    
    // Set auto-signer as default owner
    await wallet.setOwner(chainId, autoSignerSetup.autoSignerAddress);
    
    console.log('✅ Auto-signing enabled! No more popups.');
  } catch (autoSignError) {
    console.warn('⚠️ Could not enable auto-signing:', autoSignError);
    // Falls back to regular signing - still works, just with popups
  }
  
  // ... rest of connection setup ...
}
```

### 7.5.3 Key Concepts

| Concept | Description |
|---------|-------------|
| **PrivateKey.createRandom()** | Creates random in-memory signer for auto-signing |
| **Composite(signer1, signer2)** | Tries signers in order until one can sign |
| **chain.addOwner(address)** | Adds auto-signer as owner (requires ONE signature) |
| **wallet.setOwner(chainId, address)** | Sets auto-signer as default for operations |

### 7.5.4 Connection State with Auto-Signing

```typescript
interface ChainConnection {
  client: any;
  wallet: any;
  faucet: any;
  chainId: string;
  address: string;
  signer: Signer;
  // Auto-signing additions
  autoSignerAddress: string;      // The auto-signer's address
  isAutoSignEnabled: boolean;     // Whether auto-signing is active
}
```

### 7.5.5 React Hook Usage

```typescript
export function useChain(): UseChainReturn {
  const [state, setState] = useState<ChainState>({
    isConnected: false,
    isConnecting: false,
    chainId: null,
    error: null,
    // Auto-signing state
    isAutoSignEnabled: chainManager.isAutoSignEnabled(),
    autoSignerAddress: chainManager.getAutoSignerAddress(),
  });
  
  // ... rest of hook
}

// In components:
function MyComponent() {
  const { isAutoSignEnabled, autoSignerAddress } = useChain();
  
  return (
    <div>
      {isAutoSignEnabled ? (
        <span className="text-green-400">✅ Auto-signing enabled</span>
      ) : (
        <span className="text-yellow-400">⚠️ Manual signing mode</span>
      )}
    </div>
  );
}
```

### 7.5.6 Security Considerations

**✅ Safe:**
- Auto-signer key is random and session-only
- Key is never stored persistently
- User must approve adding auto-signer as owner
- Auto-signer can only sign for user's own chain

**⚠️ Important:**
- Auto-signer key is lost on page refresh (requires re-connection)
- User signs once per session to enable auto-signing
- If auto-signing setup fails, falls back to manual signing

### 7.5.7 Reference Implementations

For more examples, see:
- **linera-protocol**: [examples/counter/metamask/index.html](https://github.com/linera-io/linera-protocol/blob/main/examples/counter/metamask/index.html)
- **Linera-Arcade**: [frontend/src/lib/linera/lineraAdapter.ts](https://github.com/mohamedwael201193/Linera-Arcade)

---

## 8. GRAPHQL INTEGRATION

### 8.1 Enum Format Issues

**Problem:** Linera's `async-graphql` uses `SCREAMING_CASE` for enums, but frontend might use `PascalCase`.

**Contract Definition:**
```rust
#[derive(async_graphql::Enum)]
pub enum MarketKind {
    Crypto,         // GraphQL: "CRYPTO"
    Sports,         // GraphQL: "SPORTS"
    PredictionApp,  // GraphQL: "PREDICTION_APP"
}
```

**Frontend Solution:**

**frontend/src/lib/chain/operations.ts:**
```typescript
// GraphQL mutation
export const CREATE_STRATEGY = `
  mutation CreateAgentStrategy(
    $name: String!,
    $marketKind: MarketKind!,  # This expects SCREAMING_CASE
    $isPublic: Boolean!
  ) {
    createAgentStrategy(
      name: $name,
      marketKind: $marketKind,
      isPublic: $isPublic
    )
  }
`;

// Frontend function
export const onChainApi = {
  async createStrategy(data: {
    name: string;
    marketKind: string;  // User provides: "Crypto", "Sports", etc.
    isPublic: boolean;
  }) {
    // Convert to GraphQL enum format
    const marketKindMap: Record<string, string> = {
      'Crypto': 'CRYPTO',
      'Sports': 'SPORTS',
      'PredictionApp': 'PREDICTION_APP',
    };
    
    const graphqlData = {
      ...data,
      marketKind: marketKindMap[data.marketKind] || data.marketKind.toUpperCase(),
    };
    
    console.log('🔗 Calling ON-CHAIN createAgentStrategy mutation...', graphqlData);
    const result = await chainMutate<{ createAgentStrategy: number }>(
      CREATE_STRATEGY,
      graphqlData
    );
    return result.createAgentStrategy;
  },
};
```

**Direction Enum:**
```typescript
const directionMap: Record<string, string> = {
  'Long': 'UP',
  'Short': 'DOWN',
  'Over': 'OVER',
  'Under': 'UNDER',
  'Yes': 'YES',
  'No': 'NO',
};
```

### 8.2 Complete Operations API

**frontend/src/lib/chain/operations.ts:**
```typescript
// Ensure app is connected before operations
async function ensureAppConnected(): Promise<void> {
  if (!chainManager.isConnected()) {
    throw new Error('Must connect to Conway testnet first');
  }
  if (!chainManager.isAppConnected()) {
    console.log('📱 Auto-connecting to AgentHub application...');
    await connectApp();
  }
}

export const onChainApi = {
  // Register strategist
  async registerStrategist(displayName: string): Promise<boolean> {
    await ensureAppConnected();
    const result = await chainMutate<{ registerStrategist: boolean }>(
      REGISTER_STRATEGIST,
      { displayName }
    );
    return result.registerStrategist;
  },

  // Create strategy
  async createStrategy(data: {
    name: string;
    description: string;
    marketKind: string;
    baseMarket: string;
    isPublic: boolean;
    isAiControlled: boolean;
  }): Promise<number> {
    await ensureAppConnected();
    
    // Convert enum to SCREAMING_CASE
    const graphqlData = {
      ...data,
      marketKind: marketKindMap[data.marketKind] || data.marketKind.toUpperCase(),
    };
    
    const result = await chainMutate<{ createAgentStrategy: number }>(
      CREATE_STRATEGY,
      graphqlData
    );
    return result.createAgentStrategy;
  },

  // Publish signal
  async publishSignal(data: {
    strategyId: number;
    direction: string;
    horizonSecs: number;
    confidenceBps: number;
    entryValue?: number;
  }): Promise<number> {
    await ensureAppConnected();
    
    // Convert direction
    const graphqlData = {
      ...data,
      direction: data.direction.toUpperCase(),
    };
    
    const result = await chainMutate<{ publishSignal: number }>(
      PUBLISH_SIGNAL,
      graphqlData
    );
    return result.publishSignal;
  },

  // Follow strategy
  async followStrategy(
    strategyId: number,
    autoCopy: boolean = false,
    maxExposureUnits: number = 0
  ): Promise<boolean> {
    await ensureAppConnected();
    const result = await chainMutate<{ followStrategy: boolean }>(
      FOLLOW_STRATEGY,
      { strategyId, autoCopy, maxExposureUnits }
    );
    return result.followStrategy;
  },

  // Unfollow strategy
  async unfollowStrategy(strategyId: number): Promise<boolean> {
    await ensureAppConnected();
    const result = await chainMutate<{ unfollowStrategy: boolean }>(
      UNFOLLOW_STRATEGY,
      { strategyId }
    );
    return result.unfollowStrategy;
  },
};
```

---

## 9. DATA TRANSFORMATION LAYER

### 9.1 The Problem

Backend uses `snake_case`, frontend uses `camelCase`. Also:
- Backend stores prices in cents (integer)
- Frontend displays prices in dollars (float)
- Backend uses `*_bps` (basis points) for percentages
- Frontend displays as regular percentages

### 9.2 Field Mapping

**frontend/src/lib/api.ts:**
```typescript
// Transform snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Field name mappings (backend -> frontend)
const fieldMappings: Record<string, string> = {
  ownerWallet: 'creatorWallet',        // Backend field -> Frontend field
  winRateBps: 'winRate',
  totalPnlBps: 'totalPnl',
  avgPnlBps: 'avgPnl',
  bestWinBps: 'bestWin',
  worstLossBps: 'worstLoss',
  winningSignals: 'wins',
  losingSignals: 'losses',
  walletAddress: 'wallet',
  displayName: 'name',
  followersCount: 'followers',         // CRITICAL: Backend returns followers_count
  entryValue: 'entryPrice',
  resolvedValue: 'exitPrice',
  confidenceBps: 'confidence',
  pnlBps: 'pnlPercent',
};

function transformKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (typeof obj !== 'object') return obj;
  
  const transformed: Record<string, unknown> = {};
  
  for (const key of Object.keys(obj)) {
    let camelKey = snakeToCamel(key);
    
    // Apply field mapping if exists
    if (fieldMappings[camelKey]) {
      camelKey = fieldMappings[camelKey];
    }
    
    let value = transformKeys(obj[key]);
    
    // Transform _bps values to percentages (divide by 100)
    if (key.endsWith('_bps') && typeof value === 'number') {
      value = value / 100;
    }
    
    // Convert price values from cents to dollars
    if ((key === 'entry_value' || key === 'resolved_value') && typeof value === 'number') {
      value = value / 100;
    }
    
    transformed[camelKey] = value;
  }
  
  return transformed;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return transformKeys(data) as T;
}
```

### 9.3 Example Transformations

```typescript
// Backend response:
{
  strategy_id: 12,
  owner_wallet: "0x123",
  display_name: "Test Agent",
  win_rate_bps: 6500,        // 65.00%
  total_pnl_bps: 1250,       // 12.50%
  followers_count: 42,
  entry_value: 4500000,      // $45,000.00 (in cents)
}

// After transformation:
{
  strategyId: 12,
  creatorWallet: "0x123",
  name: "Test Agent",
  winRate: 65.00,            // Divided by 100
  totalPnl: 12.50,           // Divided by 100
  followers: 42,             // Mapped field name
  entryPrice: 45000.00,      // Divided by 100
}
```

---

## 10. DEPLOYMENT

### 10.1 Frontend Deployment (Vercel)

**Steps:**
1. Push code to GitHub
2. Connect GitHub to Vercel
3. Add environment variables in Vercel dashboard:
   ```
   VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
   VITE_LINERA_APP_ID=your_app_id
   VITE_LINERA_CHAIN_ID=your_hub_chain_id
   VITE_API_URL=https://your-backend.onrender.com
   VITE_DYNAMIC_ENV_ID=your_dynamic_id
   ```
4. Deploy!

**vercel.json CRITICAL settings:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

**WHY:** WASM requires these headers for SharedArrayBuffer support.

### 10.2 Backend Deployment (Render)

**Steps:**
1. Create new Web Service on Render
2. Connect GitHub repository
3. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Node
4. Add environment variables:
   ```
   NODE_ENV=production
   PORT=3002
   CRYPTOCOMPARE_API_KEY=your_key
   ```
5. Deploy!

**Data Persistence:**
- Backend uses in-memory DB with file persistence
- Data saved to `data.json` every 30 seconds
- On Render, use persistent disk to retain data across deploys

### 10.3 Post-Deployment Checklist

✅ Frontend loads without errors  
✅ "Connect Wallet" button works  
✅ MetaMask connection successful  
✅ Conway testnet connection successful  
✅ "On-Chain" indicator shows after connection  
✅ Can create agents with wallet signature  
✅ Can publish signals with wallet signature  
✅ Can follow agents with wallet signature  
✅ Prices display correctly (BTC/ETH)  
✅ Live feed updates in real-time  
✅ Rankings show after signals resolve  

---

## 11. COMMON ERRORS & SOLUTIONS

### Error 1: `client.openChain is not a function`

**Problem:** Trying to use non-existent method.

**Solution:**
```typescript
// ❌ Wrong
const chain = await client.openChain(chainId);

// ✅ Correct
const chain = await client.chain(chainId);
const app = await chain.application(appId);
```

### Error 2: `createStrategy` unknown field in GraphQL

**Problem:** Frontend mutation name doesn't match contract.

**Solution:**
```typescript
// ❌ Wrong - no such mutation
mutation createStrategy { ... }

// ✅ Correct - matches contract operation name
mutation createAgentStrategy { ... }
```

### Error 3: Invalid enum value `"Crypto"` for `MarketKind`

**Problem:** GraphQL expects SCREAMING_CASE.

**Solution:**
```typescript
// Convert before sending
const marketKindMap = {
  'Crypto': 'CRYPTO',
  'Sports': 'SPORTS',
  'PredictionApp': 'PREDICTION_APP',
};

const graphqlData = {
  ...data,
  marketKind: marketKindMap[data.marketKind],
};
```

### Error 4: "client is not configured to propose on chain"

**Problem:** Using hub chain ID instead of user's microchain.

**Solution:**
```typescript
// ❌ Wrong - using hub chain
const chain = await client.chain(HUB_CHAIN_ID);

// ✅ Correct - use user's microchain
const chain = await client.chain(connection.chainId);
```

### Error 5: Signature verification failed

**Problem:** Using `signMessage` which double-hashes.

**Solution:**
```typescript
// ❌ Wrong
const signature = await connector.signMessage(message);

// ✅ Correct - use personal_sign
const walletClient = await wallet.getWalletClient();
const signature = await walletClient.request({
  method: 'personal_sign',
  params: [messageHex, walletAddress],
});
```

### Error 6: `NaN` displayed for prices

**Problem:** Backend returns nested object, frontend expects flat number.

**Solution:**
```typescript
// Backend returns:
{ btc: { price: 45000 }, eth: { price: 2500 } }

// Frontend expects:
{ btc: 45000, eth: 2500 }

// Fix in PriceDisplay component:
const btcPrice = typeof prices.btc === 'object' ? prices.btc.price : prices.btc;
```

### Error 7: Follower count shows 0 after following

**Problem:** Stats not initialized for new strategies.

**Solution:**
```typescript
// In backend/db/memory.ts
async getStrategyStats(strategyId: number) {
  // If stats don't exist, create them
  if (!strategyStats.has(strategyId)) {
    const strategy = strategies.get(strategyId);
    if (strategy) {
      return await this.updateStrategyStats(strategyId);
    }
  }
  return strategyStats.get(strategyId) || null;
}
```

### Error 8: WASM initialization failed

**Problem:** Missing CORS headers.

**Solution:**
Add to Vite config and Vercel config:
```typescript
headers: {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
```

---

## 12. TESTING CHECKLIST

### Local Development

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### Test Flow

1. **Connect Wallet**
   - Click "Connect Wallet"
   - Choose MetaMask
   - Approve connection
   - Wait for "On-Chain" indicator
   - Check console: "✅ Connected to Conway testnet!"

2. **Register as Strategist**
   - Go to "My Agents"
   - Click "Become a Strategist"
   - Enter display name
   - Sign wallet popup
   - Check console: "✅ ON-CHAIN registerStrategist result"

3. **Create Agent**
   - Click "+ Create Agent"
   - Fill form:
     - Name: "Test Agent"
     - Description: "Test"
     - Market: Crypto
     - Base Market: "BTC/USD"
     - Public: Yes
     - AI Controlled: No
   - Submit
   - Sign wallet popup
   - Check console: "✅ ON-CHAIN createAgentStrategy result: { createAgentStrategy: 12 }"

4. **Publish Signal**
   - Go to agent detail page
   - Click "Publish Signal"
   - Choose Long or Short
   - Set confidence (0-100%)
   - Set time horizon (3 minutes for testing)
   - Submit
   - Sign wallet popup
   - Check console: "✅ ON-CHAIN publishSignal result: { publishSignal: 1 }"

5. **Follow Agent**
   - From another wallet, visit agent detail
   - Click "Follow Agent"
   - Sign wallet popup
   - Check follower count increases

6. **Wait for Resolution**
   - Wait for signal to expire (3 minutes)
   - Backend auto-resolves every 30 seconds
   - Check live feed for resolved signal
   - Check agent stats updated

7. **Check Rankings**
   - Go to Rankings page
   - Agent should appear after first resolved signal
   - Sort by different criteria

---

## 13. SIGNAL RESOLUTION LOGIC

### How Signal WIN/LOSS is Determined

**IMPORTANT:** Direction comparison must be CASE-INSENSITIVE!

| User Selects | GraphQL Sends | Price Movement | Result |
|--------------|---------------|----------------|--------|
| Long/Up | `UP` | ⬆️ Price goes UP | **WIN** ✅ |
| Long/Up | `UP` | ⬇️ Price goes DOWN | **LOSS** ❌ |
| Short/Down | `DOWN` | ⬇️ Price goes DOWN | **WIN** ✅ |
| Short/Down | `DOWN` | ⬆️ Price goes UP | **LOSS** ❌ |

### Backend Implementation (CORRECT WAY)

**backend/src/db/memory.ts:**
```typescript
function calculateSignalResult(signal: Signal, resolvedValue: number) {
  const entry = signal.entry_value || 0;
  
  // CRITICAL: Case-insensitive comparison
  const direction = signal.direction.toLowerCase();
  
  // Long directions (expecting price to go UP)
  const isLong = direction === 'up' || direction === 'over' || 
                 direction === 'yes' || direction === 'long';
  
  // Short directions (expecting price to go DOWN)
  const isShort = direction === 'down' || direction === 'under' || 
                  direction === 'no' || direction === 'short';

  let result: 'win' | 'lose' | 'push';
  let pnlBps: number;

  if (isLong) {
    // LONG: Win if price went UP
    if (resolvedValue > entry) {
      result = 'win';
      pnlBps = Math.abs(((resolvedValue - entry) * 10000) / entry);
    } else if (resolvedValue < entry) {
      result = 'lose';
      pnlBps = -Math.abs(((resolvedValue - entry) * 10000) / entry);
    } else {
      result = 'push';
      pnlBps = 0;
    }
  } else if (isShort) {
    // SHORT: Win if price went DOWN
    if (resolvedValue < entry) {
      result = 'win';
      pnlBps = Math.abs(((entry - resolvedValue) * 10000) / entry);
    } else if (resolvedValue > entry) {
      result = 'lose';
      pnlBps = -Math.abs(((resolvedValue - entry) * 10000) / entry);
    } else {
      result = 'push';
      pnlBps = 0;
    }
  }

  return { result, pnl_bps: pnlBps };
}
```

### Countdown Timer in SignalCard

**frontend/src/components/cards/SignalCard.tsx:**
```typescript
function useCountdown(expiresAt: string | undefined, isOpen: boolean) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  useEffect(() => {
    if (!expiresAt || !isOpen) return;

    const updateCountdown = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      
      if (diff <= 0) {
        setTimeLeft('Resolving...');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isOpen]);

  return timeLeft;
}
```

---

## 14. DEPLOYMENT URLS

**Production:**
- Frontend: https://agent-hub-navy.vercel.app
- Backend: https://agenthub-backend-8vzy.onrender.com

**Conway Testnet:**
- Faucet: https://faucet.testnet-conway.linera.net
- App ID: `e0298eccc11f6feff7c1f442edc0116e2f15665fbed495d055ee504a56531e8a`
- Hub Chain: `e0714069de69f3e7277e2831cc8e6a4a79dc913cb56e6acccf15e6be3832d291`

---

## 15. KEY TAKEAWAYS FOR NEXT PROJECT

1. **Linera Architecture**
   - Users interact via their OWN microchain
   - App ID routes to hub chain automatically
   - Never use hub chain directly for user operations

2. **Wallet Signing**
   - Use `personal_sign`, not `signMessage`
   - This is CRITICAL for signature verification
   - Test signature immediately after implementation

3. **GraphQL Enums**
   - Linera uses SCREAMING_CASE
   - Always convert: `"Crypto"` → `"CRYPTO"`
   - Create mapping objects for all enums

4. **Data Transformations**
   - Backend: `snake_case`, Frontend: `camelCase`
   - Create transformation layer early
   - Test with real data, not mocks

5. **WASM Setup**
   - Requires specific CORS headers
   - Set in both Vite config and Vercel config
   - Test in production environment

6. **State Management**
   - On-chain for mutations (requires signing)
   - Backend for caching and queries
   - Keep both in sync

7. **Testing Strategy**
   - Test wallet connection first
   - Then test each mutation individually
   - Check console logs at every step
   - Test with multiple wallets

8. **Deployment**
   - Frontend: Vercel (easy WASM support)
   - Backend: Render with persistent disk
   - Set all environment variables
   - Test in production immediately

---

## 16. COMPLETE FILE REFERENCE

### Essential Files

1. **frontend/src/lib/chain/signer.ts** - Wallet adapter
2. **frontend/src/lib/chain/connection.ts** - Chain manager
3. **frontend/src/lib/chain/operations.ts** - GraphQL API
4. **frontend/src/lib/api.ts** - Backend API + transformations
5. **backend/src/db/memory.ts** - Database implementation
6. **contracts/agent_hub/src/contract.rs** - Smart contract logic

### Configuration Files

1. **frontend/vercel.json** - Vercel deployment
2. **frontend/vite.config.ts** - WASM support
3. **frontend/.env** - Environment variables
4. **backend/.env** - Backend configuration

---

## 17. QUICK START COMMANDS

### For New Project (Copy-Paste Ready)

```bash
# ============================================
# STEP 1: CREATE YOUR CHAIN
# ============================================
linera wallet init --with-new-chain --faucet https://faucet.testnet-conway.linera.net

# Get your chain ID (SAVE THIS!)
linera wallet show

# ============================================
# STEP 2: BUILD CONTRACT
# ============================================
cd contracts/agent_hub
cargo build --release --target wasm32-unknown-unknown

# ============================================
# STEP 3: DEPLOY CONTRACT
# ============================================
# Replace YOUR_CHAIN_ID with the chain ID from step 1
linera publish-and-create \
  target/wasm32-unknown-unknown/release/agent_hub_contract.wasm \
  target/wasm32-unknown-unknown/release/agent_hub_service.wasm \
  --json-argument '{"hub_chain_id": "YOUR_CHAIN_ID"}'

# Save the Application ID from output!

# ============================================
# STEP 4: UPDATE ENVIRONMENT
# ============================================
# Edit frontend/.env:
# VITE_LINERA_APP_ID=your_app_id_from_step_3
# VITE_LINERA_CHAIN_ID=your_chain_id_from_step_1
# VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net

# ============================================
# STEP 5: RUN LOCALLY
# ============================================
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
cd frontend && npm install && npm run dev

# ============================================
# STEP 6: DEPLOY TO PRODUCTION
# ============================================
# Frontend: Push to GitHub, connect to Vercel
# Backend: Push to GitHub, connect to Render

# Add env vars in Vercel dashboard:
# - VITE_LINERA_FAUCET_URL
# - VITE_LINERA_APP_ID
# - VITE_LINERA_CHAIN_ID
# - VITE_API_URL (your Render backend URL)
# - VITE_DYNAMIC_ENV_ID (from Dynamic.xyz)
```

---

## 🎉 CONCLUSION

This guideline covers everything needed to build a production-ready Linera dApp with:

✅ **Chain Creation** - How to get your own microchain from faucet  
✅ **Contract Deployment** - The exact `linera publish-and-create` command  
✅ **Smart contract** on Conway testnet  
✅ **Dynamic.xyz wallet** integration with proper signing  
✅ **Auto-signing** for seamless UX (no popups after initial connect)  
✅ **Full-stack architecture** with React + Express  
✅ **GraphQL mutations** with enum conversion  
✅ **Signal resolution logic** with correct WIN/LOSS calculation  
✅ **Countdown timers** for signal expiration  
✅ **Data transformation layer**  
✅ **Real-time updates** with WebSocket  
✅ **Production deployment** on Vercel + Render  

**Follow this guide step-by-step and you'll avoid all the errors we encountered!**

---

*Created: January 3, 2026*  
*Updated: January 10, 2026*  
*Project: AgentHub - Verifiable AI Trading Agents*  
*Production: https://agent-hub-navy.vercel.app*
