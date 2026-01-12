/**
 * useLabyrinth Hook
 * 
 * Manages player data and operations for Labyrinth Legends.
 * Uses useLineraConnection for blockchain connectivity.
 * 
 * Based on Linera-Arcade's useArcade hook pattern:
 * - Auto-loads player when app connects
 * - Tries backend first, falls back to blockchain
 * - Syncs to backend after blockchain writes
 */

import { useState, useEffect, useCallback } from 'react';
import { useLineraConnection } from './useLineraConnection';
import { labyrinthApi, type Player } from '../lib/labyrinthApi';

/**
 * Labyrinth state returned by the hook
 */
export interface LabyrinthState {
  // Player data
  player: Player | null;
  isRegistered: boolean;
  
  // Loading/error states
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Connection info (from useLineraConnection)
  isConnected: boolean;
  isAppConnected: boolean;
  walletAddress: string | null;
  chainId: string | null;
  
  // Actions
  loadPlayer: () => Promise<void>;
  registerPlayer: (username: string) => Promise<boolean>;
  refreshPlayer: () => Promise<void>;
  syncToBackend: () => Promise<boolean>;
}

/**
 * Hook for player operations
 */
export function useLabyrinth(): LabyrinthState {
  // Get connection state
  const { 
    isConnecting,
    isConnected, 
    isAppConnected, 
    walletAddress,
    chainId,
    error: connectionError 
  } = useLineraConnection();
  
  // Local state
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  /**
   * Load player data (backend first, then blockchain)
   */
  const loadPlayer = useCallback(async () => {
    if (!isAppConnected || !walletAddress) {
      console.log('⏳ Cannot load player - not connected');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Loading player data...');
      const playerData = await labyrinthApi.getPlayer(walletAddress);
      setPlayer(playerData);
      
      if (playerData) {
        console.log('✅ Player loaded:', playerData.username);
      } else {
        console.log('📝 Player not registered yet');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load player';
      console.error('❌ Failed to load player:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAppConnected, walletAddress]);
  
  /**
   * Register a new player
   */
  const registerPlayer = useCallback(async (username: string): Promise<boolean> => {
    if (!isAppConnected) {
      setError('Not connected to application');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`📝 Registering player: ${username}`);
      await labyrinthApi.registerPlayer(username);
      
      // Reload player data after registration
      await loadPlayer();
      console.log('✅ Player registered successfully!');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register';
      console.error('❌ Registration failed:', message);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAppConnected, loadPlayer]);
  
  /**
   * Refresh player data
   */
  const refreshPlayer = useCallback(async () => {
    await loadPlayer();
  }, [loadPlayer]);

  /**
   * Manually sync to backend
   */
  const syncToBackend = useCallback(async (): Promise<boolean> => {
    if (!isAppConnected) {
      setError('Not connected to application');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await labyrinthApi.syncToBackend();
      await loadPlayer(); // Refresh data
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync';
      console.error('❌ Sync failed:', message);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAppConnected, loadPlayer]);
  
  // Auto-load player when app connects (only once)
  useEffect(() => {
    if (isAppConnected && walletAddress && !hasLoaded && !isLoading) {
      console.log('🔄 App connected, auto-loading player...');
      setHasLoaded(true);
      loadPlayer();
    }
  }, [isAppConnected, walletAddress, hasLoaded, isLoading, loadPlayer]);
  
  // Clear player when disconnected
  useEffect(() => {
    if (!isConnected) {
      setPlayer(null);
      setError(null);
      setHasLoaded(false);
    }
  }, [isConnected]);
  
  // Combine errors
  const combinedError = error || connectionError;
  
  return {
    // Player data
    player,
    isRegistered: player !== null,
    
    // Loading states
    isLoading,
    isConnecting,
    error: combinedError,
    
    // Connection info
    isConnected,
    isAppConnected,
    walletAddress,
    chainId,
    
    // Actions
    loadPlayer,
    registerPlayer,
    refreshPlayer,
    syncToBackend,
  };
}
