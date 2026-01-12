# 🎮 LABYRINTH LEGENDS - Linera Blockchain Maze Game

A competitive multiplayer maze game built on Linera blockchain with real-time gameplay, NFT rewards, and on-chain scoring.

## 🏗️ Architecture: How It Connects to Conway Testnet

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              @linera/client (WASM)                       │   │
│  │    ┌──────────────────────────────────────────────┐     │   │
│  │    │ LineraAdapter Singleton                      │     │   │
│  │    │  - Creates wallet from faucet               │     │   │
│  │    │  - Claims chain automatically               │     │   │
│  │    │  - Auto-signs transactions                  │     │   │
│  │    │  - Queries game state via subscriptions     │     │   │
│  │    └──────────────────────────────────────────────┘     │   │
│  └────────────────────────┬────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ WebSocket + GraphQL
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             LINERA FAUCET (Conway Testnet)                     │
│    https://faucet.testnet-conway.linera.net                    │
│                                                                 │
│    Provides:                                                    │
│    - Chain creation & claiming                                  │
│    - Wallet initialization                                      │
│    - Connection to validator network                            │
│    - Token distribution for gas                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               LINERA VALIDATOR NETWORK                          │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │             Your Deployed Application                    │ │
│    │                                                          │ │
│    │  App ID: 14252ed65b362813ef5dc339f76f9db7a2cb775f61b... │ │
│    │  Chain:  5c2c15690694204e8bf3659c87990d2d44c61f857b... │ │
│    │                                                          │ │
│    │  - Maze generation                                       │ │
│    │  - Player movement validation                            │ │
│    │  - Score tracking                                        │ │
│    │  - NFT minting                                           │ │
│    └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Insight: NO Port 8080 Needed!

Unlike traditional setups that require running `linera service --port 8080`, this project uses the **@linera/client WASM SDK** which runs entirely in the browser and connects directly to the faucet URL.

### Connection Flow:
```typescript
// 1. WASM client initializes in browser
const linera = await import("@linera/client");

// 2. Connect to faucet (THE ONLY ENDPOINT NEEDED)
const wallet = await linera.Wallet.connectToFaucet(
  "https://faucet.testnet-conway.linera.net",
  ephemeralSigner
);

// 3. Claim a chain for the user
const chainId = await wallet.claimAndFundChain(
  userAddress,
  userSigner
);

// 4. Connect to deployed application
const app = await wallet.connectApplication(applicationId);

// 5. Make mutations (auto-signed!)
await app.mutate("movePlayer", { direction: "north" });
```

## 📦 Deployed Contract Details

| Property | Value |
|----------|-------|
| **Network** | Conway Testnet |
| **Chain ID** | `5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36` |
| **Application ID** | `14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a` |
| **Faucet URL** | `https://faucet.testnet-conway.linera.net` |

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Step 1: Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/LABYRINTH-LEGENDS.git
cd LABYRINTH-LEGENDS

# Install frontend dependencies
cd frontend
pnpm install

# Install backend dependencies
cd ../backend
pnpm install
```

### Step 2: Configure Environment Variables

**Frontend (`frontend/.env`):**
```env
# Linera Configuration - Conway Testnet
VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
VITE_LINERA_APP_ID=14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a
VITE_APPLICATION_ID=14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a

# Dynamic.xyz Wallet Integration
VITE_DYNAMIC_ENVIRONMENT_ID=38eabbc2-00d5-4d3b-8cc1-1167ad367914

# Backend URL (for real-time multiplayer)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

**Backend (`backend/.env`):**
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT for session management
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Linera Configuration
LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
LINERA_CHAIN_ID=5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36
APPLICATION_ID=14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a
```

### Step 3: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
pnpm dev
# Server starts at http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev
# App opens at http://localhost:5173
```

### Step 4: Test the Connection

1. Open http://localhost:5173 in your browser
2. Click "Connect Wallet" - Dynamic.xyz modal will appear
3. Connect with any supported wallet (MetaMask, etc.)
4. The app will automatically:
   - Initialize the Linera WASM client
   - Create an ephemeral signer for auto-signing
   - Connect to Conway testnet via faucet
   - Link your wallet address to a Linera chain
5. Start a game and see transactions execute on-chain!

## 🌐 Deployment

### Deploy Frontend to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project" → Import your GitHub repo
   - Set Root Directory to `frontend`
   - Framework Preset: Vite

3. **Configure Environment Variables in Vercel Dashboard:**
   | Variable | Value |
   |----------|-------|
   | `VITE_LINERA_FAUCET_URL` | `https://faucet.testnet-conway.linera.net` |
   | `VITE_LINERA_APP_ID` | `14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a` |
   | `VITE_APPLICATION_ID` | `14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a` |
   | `VITE_DYNAMIC_ENVIRONMENT_ID` | `38eabbc2-00d5-4d3b-8cc1-1167ad367914` |
   | `VITE_API_URL` | `https://your-backend.onrender.com` |
   | `VITE_WS_URL` | `wss://your-backend.onrender.com` |

4. **Deploy!** The `vercel.json` already has correct CORS headers for WASM.

### Deploy Backend to Render

1. **Create New Web Service on Render:**
   - Go to [render.com](https://render.com)
   - New → Web Service → Connect your GitHub repo
   - Root Directory: `backend`
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `pnpm start`

2. **Configure Environment Variables in Render Dashboard:**
   | Variable | Value |
   |----------|-------|
   | `PORT` | `3001` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` |
   | `JWT_SECRET` | (generate a secure random string) |
   | `LINERA_FAUCET_URL` | `https://faucet.testnet-conway.linera.net` |
   | `LINERA_CHAIN_ID` | `5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36` |
   | `APPLICATION_ID` | `14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a` |

3. **Update Vercel Frontend:**
   - After Render deploys, copy the backend URL (e.g., `https://labyrinth-legends.onrender.com`)
   - Update `VITE_API_URL` and `VITE_WS_URL` in Vercel dashboard
   - Redeploy frontend

## 📁 Project Structure

```
LABYRINTH-LEGENDS/
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── lib/
│   │   │   └── linera/      # Linera integration
│   │   │       ├── lineraAdapter.ts   # Main connection singleton
│   │   │       ├── wasmInit.ts        # WASM initialization
│   │   │       ├── dynamicSigner.ts   # Dynamic wallet bridge
│   │   │       └── index.ts           # Re-exports
│   │   ├── hooks/           # Custom React hooks
│   │   └── pages/           # Route pages
│   ├── .env                 # Environment variables
│   ├── vercel.json          # Vercel deployment config
│   └── vite.config.ts       # Vite config with WASM support
│
├── backend/                  # Express + Socket.IO
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── socket/          # Real-time handlers
│   ├── .env                 # Environment variables
│   └── render.yaml          # Render deployment config
│
└── contract/                 # Linera smart contract (Rust)
    ├── src/
    │   ├── lib.rs           # Contract entry point
    │   ├── state.rs         # On-chain state
    │   └── operations.rs    # Contract operations
    └── Cargo.toml
```

## 🎮 Game Features

- **Real-time Multiplayer:** Compete against other players in the same maze
- **On-chain Scoring:** All scores recorded on Linera blockchain
- **NFT Rewards:** Mint achievement NFTs for completing mazes
- **Procedural Mazes:** Each game generates a unique maze
- **Leaderboards:** Global and per-maze leaderboards

## 🔧 Troubleshooting

### WASM Not Loading
Ensure your server sends these headers:
```
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

### "Failed to connect to faucet"
- Check your internet connection
- Verify the faucet URL is correct
- Conway testnet may be temporarily down - check Linera Discord

### Dynamic Wallet Not Connecting
- Verify `VITE_DYNAMIC_ENVIRONMENT_ID` is correct
- Check Dynamic.xyz dashboard for allowed origins

### Backend WebSocket Issues
- Ensure `FRONTEND_URL` in backend matches your frontend domain
- Check CORS configuration in backend

## 📚 Resources

- [Linera Documentation](https://linera.dev/docs)
- [Linera-Arcade Reference](https://github.com/mohamedwael201193/Linera-Arcade)
- [Dynamic.xyz Docs](https://docs.dynamic.xyz)
- [Conway Testnet Faucet](https://faucet.testnet-conway.linera.net)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the Linera ecosystem
