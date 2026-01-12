/**
 * Labyrinth API - High-level interface for Labyrinth Legends operations
 * 
 * HYBRID ARCHITECTURE (like Linera-Arcade):
 * - READS: Try backend first → fallback to blockchain → fallback to localStorage
 * - WRITES: Submit to blockchain → sync to backend → save to localStorage
 * 
 * IMPORTANT: Each wallet connection claims a NEW chain from the faucet.
 * We store chainId with registration to track which chain has the player data.
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

const REGISTER_PLAYER = `
  mutation RegisterPlayer($username: String!) {
    registerPlayer(username: $username)
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
   * 1. Submits to blockchain (for authenticity)
   * 2. Syncs to backend (for global visibility)
   * 3. Saves to localStorage (for offline access)
   * 
   * @param username - Display username (3-20 chars, alphanumeric + underscore/hyphen)
   * @returns true if registration was initiated
   */
  async registerPlayer(username: string): Promise<boolean> {
    console.log(`📝 Registering player: ${username}`);
    
    // Step 1: Submit to blockchain
    await lineraAdapter.mutate(REGISTER_PLAYER, { username });
    console.log('✅ Player registered on blockchain');
    
    // Get wallet and chainId
    const wallet = lineraAdapter.getAddress();
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
}

// Export singleton instance
export const labyrinthApi = new LabyrinthApiClass();
