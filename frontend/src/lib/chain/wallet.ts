/**
 * Labyrinth Legends - Linera Wallet Integration
 * Bridges Dynamic.xyz wallet with Linera operations
 */

import { useState, useCallback, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lineraClient } from './client';
import { LINERA_CONFIG } from './config';

// ============================================
// TYPES
// ============================================

export interface LineraWalletState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  
  // Linera-specific
  chainId: string;
  appId: string;
  lineraEnabled: boolean;
  
  // Player state (from blockchain)
  player: {
    username: string;
    xp: number;
    gamesPlayed: number;
    isRegistered: boolean;
  } | null;
  
  // Error handling
  error: string | null;
}

// ============================================
// HOOK: useLineraWallet
// ============================================

export function useLineraWallet() {
  const { primaryWallet, user, setShowAuthFlow } = useDynamicContext();
  
  const [state, setState] = useState<LineraWalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    chainId: LINERA_CONFIG.chainId,
    appId: LINERA_CONFIG.appId,
    lineraEnabled: LINERA_CONFIG.enabled,
    player: null,
    error: null,
  });

  // Update connection state when wallet changes
  useEffect(() => {
    if (primaryWallet?.address) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        address: primaryWallet.address,
      }));
      
      // Fetch player data from Linera
      if (LINERA_CONFIG.enabled) {
        fetchPlayerData(primaryWallet.address);
      }
    } else {
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        address: null,
        player: null,
      }));
    }
  }, [primaryWallet?.address]);

  // Fetch player data from blockchain
  const fetchPlayerData = useCallback(async (address: string) => {
    try {
      const player = await lineraClient.getPlayer(address);
      
      if (player) {
        setState(prev => ({
          ...prev,
          player: {
            username: player.username,
            xp: player.xp,
            gamesPlayed: player.gamesPlayed,
            isRegistered: true,
          },
        }));
      } else {
        setState(prev => ({
          ...prev,
          player: {
            username: '',
            xp: 0,
            gamesPlayed: 0,
            isRegistered: false,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
      setState(prev => ({
        ...prev,
        player: {
          username: '',
          xp: 0,
          gamesPlayed: 0,
          isRegistered: false,
        },
      }));
    }
  }, []);

  // Connect wallet (opens Dynamic modal)
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    try {
      setShowAuthFlow(true);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
    }
  }, [setShowAuthFlow]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    if (primaryWallet) {
      await (primaryWallet as any).disconnect();
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      address: null,
      player: null,
    }));
  }, [primaryWallet]);

  // Sign a message using Dynamic wallet
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!primaryWallet) {
      throw new Error('No wallet connected');
    }

    const walletClient = await (primaryWallet as any).getWalletClient();
    if (!walletClient) {
      throw new Error('Could not get wallet client');
    }

    // Use personal_sign for signing
    const signature = await walletClient.request({
      method: 'personal_sign',
      params: [
        `0x${Buffer.from(message).toString('hex')}`,
        primaryWallet.address,
      ],
    });

    return signature as string;
  }, [primaryWallet]);

  // Register player on blockchain
  const registerPlayer = useCallback(async (username: string, discordTag?: string) => {
    if (!state.address) {
      throw new Error('No wallet connected');
    }

    await lineraClient.registerPlayer(username, discordTag);
    
    // Refresh player data
    await fetchPlayerData(state.address);
  }, [state.address, fetchPlayerData]);

  // Submit game run to blockchain
  const submitRun = useCallback(async (params: {
    mode: string;
    tournamentId?: number;
    difficulty: string;
    levelReached: number;
    timeMs: number;
    deaths: number;
    completed: boolean;
  }) => {
    if (!state.address) {
      throw new Error('No wallet connected');
    }

    await lineraClient.submitRun(params);
    
    // Refresh player data
    await fetchPlayerData(state.address);
  }, [state.address, fetchPlayerData]);

  // Refresh player data
  const refreshPlayer = useCallback(async () => {
    if (state.address) {
      await fetchPlayerData(state.address);
    }
  }, [state.address, fetchPlayerData]);

  return {
    ...state,
    connect,
    disconnect,
    signMessage,
    registerPlayer,
    submitRun,
    refreshPlayer,
    user,
    wallet: primaryWallet,
  };
}
