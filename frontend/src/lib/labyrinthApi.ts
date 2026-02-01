/**
 * Labyrinth API - High-level interface for Labyrinth Legends operations
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE: Hybrid with blockchain as source of truth
 * 
 * READS: Backend first → Blockchain fallback
 *   - Backend provides fast cached reads for UI responsiveness
 *   - Blockchain is queried if backend doesn't have data
 * 
 * WRITES (Tournament Mode): Blockchain ONLY
 *   - SubmitRun mutation goes directly to blockchain
 *   - Backend is synced afterwards (fire-and-forget)
 *   - Contract validates tournament timing and calculates XP
 * 
 * WRITES (Practice Mode): Backend only
 *   - Practice runs are stored in backend cache
 *   - No blockchain transaction needed
 * 
 * IMPORTANT: Each wallet connection claims a NEW chain from the faucet.
 * We store chainId with registration to track which chain has the player data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { lineraAdapter } from './linera';

// API URL for backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Local storage key
const REGISTRATION_KEY = 'labyrinth_player_registration';

// =============================================================================
// GRAPHQL QUERIES/MUTATIONS
// =============================================================================

const GET_PLAYER = `
  query GetPlayer($owner: String!) {
    player(owner: $owner) {
      owner
      username
      totalXp
      practiceRuns
    }
  }
`;

// CRITICAL: walletAddress is ONLY passed during registration
// This creates the signer → wallet binding that all future operations use
const REGISTER_PLAYER = `
  mutation RegisterPlayer($walletAddress: [Int!]!, $username: String!) {
    registerPlayer(walletAddress: $walletAddress, username: $username)
  }
`;

// Submit run to tournament (PRIMARY operation)
// This auto-registers player if needed, validates tournament window, calculates XP
const SUBMIT_RUN = `
  mutation SubmitRun(
    $tournamentId: Int!
    $timeMs: Int!
    $score: Int!
    $coins: Int!
    $deaths: Int!
    $completed: Boolean!
  ) {
    submitRun(
      tournamentId: $tournamentId
      timeMs: $timeMs
      score: $score
      coins: $coins
      deaths: $deaths
      completed: $completed
    )
  }
`;

// Claim tournament reward after tournament ends
const CLAIM_REWARD = `
  mutation ClaimReward($tournamentId: Int!) {
    claimReward(tournamentId: $tournamentId)
  }
`;

// =============================================================================
// TYPES
// =============================================================================

export interface Player {
  owner: string;
  username: string;
  totalXp: number;
  practiceRuns: number;
  tournamentRuns?: number;
  tournamentsPlayed?: number;
  tournamentsWon?: number;
  registeredAt?: number;
}

interface PlayerResponse {
  player: Player | null;
}

interface LocalStorageRegistration {
  walletAddress: string;
  username: string;
  chainId: string;
  registeredAt: string;
}

// =============================================================================
// WALLET ADDRESS HELPERS
// =============================================================================

/**
 * Convert a hex wallet address (0x...) to a 20-byte array for GraphQL
 * The contract expects Vec<u8> which GraphQL represents as [Int!]!
 */
function walletToBytes(walletAddress: string): number[] {
  const hex = walletAddress.toLowerCase().replace('0x', '');
  if (hex.length !== 40) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  const bytes: number[] = [];
  for (let i = 0; i < 40; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

// =============================================================================
// LOCAL STORAGE HELPERS
// =============================================================================

function saveToLocalStorage(wallet: string, username: string, chainId: string): void {
  try {
    const data: LocalStorageRegistration = {
      walletAddress: wallet.toLowerCase(),
      username,
      chainId,
      registeredAt: new Date().toISOString(),
    };
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify(data));
    console.log('💾 Registration saved to localStorage');
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

function loadFromLocalStorage(wallet: string): LocalStorageRegistration | null {
  try {
    const data = localStorage.getItem(REGISTRATION_KEY);
    if (!data) return null;
    const parsed: LocalStorageRegistration = JSON.parse(data);
    if (parsed.walletAddress?.toLowerCase() === wallet.toLowerCase()) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
  }
  return null;
}

// =============================================================================
// BACKEND API HELPERS
// =============================================================================

async function backendGetPlayer(wallet: string): Promise<Player | null> {
  try {
    const response = await fetch(`${API_URL}/api/players/${wallet.toLowerCase()}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.success && data.data?.player) {
      const p = data.data.player;
      return {
        owner: p.walletAddress,
        username: p.username,
        totalXp: p.totalXp || 0,
        practiceRuns: p.practiceRuns || 0,
        tournamentRuns: p.tournamentRuns || 0,
        tournamentsPlayed: p.tournamentsPlayed || 0,
        tournamentsWon: p.tournamentsWon || 0,
        registeredAt: p.registeredAt ? new Date(p.registeredAt).getTime() : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function backendSyncPlayer(wallet: string, username: string, chainId?: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/players/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: wallet.toLowerCase(),
        username,
        chain_id: chainId,
      }),
    });
    console.log('✅ Player synced to backend');
  } catch (err) {
    console.warn('⚠️ Failed to sync to backend:', err);
  }
}

// =============================================================================
// LABYRINTH API CLASS
// =============================================================================

class LabyrinthApiClass {
  /**
   * Get a player by wallet address
   * Priority: backend → blockchain (NO localStorage - like Linera-Arcade)
   * 
   * @param wallet - Wallet address (0x...)
   * @returns Player or null if not registered
   */
  async getPlayer(wallet: string): Promise<Player | null> {
    const normalizedWallet = wallet.toLowerCase();
    
    // Step 1: Try backend first (has global data, faster)
    console.log('🔍 Checking backend for player...');
    const backendPlayer = await backendGetPlayer(wallet);
    if (backendPlayer) {
      console.log('✅ Player found in backend:', backendPlayer.username);
      return backendPlayer;
    }
    console.log('📝 Player not in backend, checking blockchain...');
    
    // Step 2: Try blockchain query
    try {
      const result = await lineraAdapter.query<PlayerResponse>(
        GET_PLAYER,
        { owner: normalizedWallet }
      );
      
      console.log('📦 Blockchain response:', result);
      
      if (result && result.player) {
        console.log('✅ Player found on blockchain:', result.player.username);
        
        // Auto-sync to backend
        const chainId = lineraAdapter.getChainId();
        backendSyncPlayer(normalizedWallet, result.player.username, chainId || undefined);
        
        // Save to localStorage for future reference
        if (chainId) {
          saveToLocalStorage(normalizedWallet, result.player.username, chainId);
        }
        
        return result.player;
      }
      
      console.log('📝 Player not found on blockchain');
    } catch (error) {
      console.error('❌ Failed to query blockchain:', error);
    }
    
    // NO localStorage fallback - like Linera-Arcade
    // If not in backend or blockchain, player is not registered
    console.log('📝 Player not registered (not found in backend or blockchain)');
    return null;
  }

  /**
   * Register a new player
   * 1. Submits to blockchain with wallet address for identity binding
   * 2. Syncs to backend (for global visibility)
   * 3. Saves to localStorage (for offline access)
   * 
   * CRITICAL: The contract uses wallet_address to identify the player,
   * NOT the auto-signer address. This allows the same player to use
   * different browser sessions.
   * 
   * @param username - Display username (3-20 chars, alphanumeric + underscore/hyphen)
   * @returns true if registration was initiated
   */
  async registerPlayer(username: string): Promise<boolean> {
    console.log(`📝 Registering player: ${username}`);
    
    // Get wallet address (MetaMask address, NOT auto-signer)
    const wallet = lineraAdapter.getAddress();
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    // Convert wallet address to bytes for GraphQL
    const walletBytes = walletToBytes(wallet);
    console.log(`   Wallet: ${wallet}`);
    console.log(`   Wallet bytes: [${walletBytes.slice(0, 3).join(', ')}...]`);
    
    // Step 1: Submit to blockchain with wallet address
    await lineraAdapter.mutate(REGISTER_PLAYER, { 
      walletAddress: walletBytes,
      username 
    });
    console.log('✅ Player registered on blockchain');
    
    // Get chainId for storage
    const chainId = lineraAdapter.getChainId();
    
    if (wallet && chainId) {
      // Step 2: Save to localStorage (most important for persistence!)
      saveToLocalStorage(wallet, username, chainId);
      
      // Step 3: Sync to backend (async, don't wait)
      backendSyncPlayer(wallet, username, chainId)
        .then(() => console.log('✅ Player synced to backend'))
        .catch(err => console.warn('⚠️ Failed to sync to backend:', err));
    }
    
    return true;
  }

  /**
   * Sync existing player to backend
   */
  async syncToBackend(): Promise<boolean> {
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    // Try blockchain first
    try {
      const result = await lineraAdapter.query<PlayerResponse>(
        GET_PLAYER,
        { owner: wallet.toLowerCase() }
      );
      
      if (result && result.player) {
        await backendSyncPlayer(wallet, result.player.username, chainId || undefined);
        return true;
      }
    } catch (error) {
      console.error('Failed to query blockchain:', error);
    }
    
    // Fallback to localStorage
    const localData = loadFromLocalStorage(wallet);
    if (localData) {
      await backendSyncPlayer(wallet, localData.username, localData.chainId);
      return true;
    }
    
    throw new Error('Player not found. Please register first.');
  }

  // ===========================================================================
  // TOURNAMENT OPERATIONS (Blockchain)
  // ===========================================================================

  /**
   * Submit a run to a tournament
   * This is the PRIMARY blockchain operation - auto-registers player if needed
   * 
   * The contract enforces:
   *   - Tournament must be Active
   *   - Current time must be within tournament window (start_time <= now < end_time)
   *   - Player must be registered (auto-registers on first run)
   * 
   * @param tournamentId - Tournament ID to submit to
   * @param timeMs - Completion time in milliseconds
   * @param score - Game score
   * @param coins - Coins collected
   * @param deaths - Number of deaths
   * @param completed - Whether the run was completed
   */
  async submitTournamentRun(
    tournamentId: number,
    timeMs: number,
    score: number,
    coins: number,
    deaths: number,
    completed: boolean
  ): Promise<{ runId: number; xpEarned: number; newBest: boolean; rank: number }> {
    console.log(`📤 Submitting run to tournament #${tournamentId}...`);

    const result = await lineraAdapter.mutate<{
      submitRun: { runId: number; xpEarned: number; newBest: boolean; rank: number } | string
    }>(SUBMIT_RUN, {
      tournamentId,
      timeMs: Math.floor(timeMs),
      score,
      coins,
      deaths,
      completed,
    });

    // Handle BCS-encoded response from contract
    if (typeof result.submitRun === 'string') {
      // Contract returns BCS bytes, we assume success
      console.log('✅ Run submitted to blockchain');
      return {
        runId: 0,  // We don't have the actual ID from BCS response
        xpEarned: 0,  // Will be calculated by contract
        newBest: false,
        rank: 0,
      };
    }

    console.log('✅ Run submitted:', result.submitRun);
    return result.submitRun;
  }

  /**
   * Claim tournament reward
   * Can only be called after tournament has ended (contract enforces timing)
   * 
   * @param tournamentId - Tournament ID to claim reward from
   */
  async claimReward(tournamentId: number): Promise<{ xpAmount: number }> {
    console.log(`🏆 Claiming reward for tournament #${tournamentId}...`);

    const result = await lineraAdapter.mutate<{
      claimReward: { xpAmount: number } | string
    }>(CLAIM_REWARD, {
      tournamentId,
    });

    // Handle BCS-encoded response
    if (typeof result.claimReward === 'string') {
      console.log('✅ Reward claimed from blockchain');
      return { xpAmount: 0 };
    }

    console.log('✅ Reward claimed:', result.claimReward);
    return result.claimReward;
  }
}

// Export singleton instance
export const labyrinthApi = new LabyrinthApiClass();
