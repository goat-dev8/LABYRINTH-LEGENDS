/**
 * useLineraConnection Hook
 * 
 * Manages Linera connection state with Dynamic wallet integration.
 * Auto-connects when wallet becomes available.
 * Based on Linera-Arcade's proven approach.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter, type LineraConnection } from '../lib/linera';

// Environment configuration
const FAUCET_URL = import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net';
const APPLICATION_ID = import.meta.env.VITE_LINERA_APP_ID || import.meta.env.VITE_APPLICATION_ID || '';

/**
 * Connection state returned by the hook
 */
export interface LineraConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  isAppConnected: boolean;
  error: string | null;
  connection: LineraConnection | null;
  walletAddress: string | null;
  chainId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
}

/**
 * Hook for managing Linera blockchain connection
 */
export function useLineraConnection(): LineraConnectionState {
  const { primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(lineraAdapter.isConnected());
  const [isAppConnected, setIsAppConnected] = useState(lineraAdapter.isApplicationConnected());
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<LineraConnection | null>(lineraAdapter.getConnection());
  
  const autoConnectAttempted = useRef(false);
  const isConnectingRef = useRef(false);
  
  /**
   * Sync state from adapter
   */
  const syncState = useCallback(() => {
    const newIsConnected = lineraAdapter.isConnected();
    const newIsAppConnected = lineraAdapter.isApplicationConnected();
    const newConnection = lineraAdapter.getConnection();
    
    setIsConnected(prev => prev !== newIsConnected ? newIsConnected : prev);
    setIsAppConnected(prev => prev !== newIsAppConnected ? newIsAppConnected : prev);
    setConnection(prev => prev !== newConnection ? newConnection : prev);
  }, []);
  
  /**
   * Connect to Linera
   */
  const connect = useCallback(async () => {
    if (!primaryWallet) {
      setError('No wallet connected. Please connect your wallet first.');
      return;
    }
    
    if (!APPLICATION_ID) {
      setError('Application ID is not configured. Check VITE_LINERA_APP_ID.');
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('⏳ Connection already in progress...');
      return;
    }
    
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🔗 Connecting to Linera Conway Testnet...');
      
      // Step 1: Connect wallet to Linera network (claims chain, sets up auto-signer)
      await lineraAdapter.connect(primaryWallet, FAUCET_URL);
      
      // Step 2: Connect to deployed application
      await lineraAdapter.connectApplication(APPLICATION_ID);
      
      syncState();
      console.log('✅ Connected to Linera and application!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('❌ Connection failed:', message);
      setError(message);
    } finally {
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [primaryWallet, syncState]);
  
  /**
   * Disconnect from Linera
   */
  const disconnect = useCallback(() => {
    lineraAdapter.disconnect();
    setError(null);
    syncState();
    autoConnectAttempted.current = false;
  }, [syncState]);
  
  /**
   * Retry connection after error
   */
  const retry = useCallback(async () => {
    setError(null);
    await connect();
  }, [connect]);
  
  // Subscribe to adapter state changes
  useEffect(() => {
    const unsubscribe = lineraAdapter.subscribe(syncState);
    return unsubscribe;
  }, [syncState]);
  
  // Auto-connect when wallet becomes available
  useEffect(() => {
    if (isConnected || isConnectingRef.current) return;
    if (autoConnectAttempted.current) return;
    if (!isLoggedIn || !primaryWallet) return;
    
    autoConnectAttempted.current = true;
    console.log('🔄 Auto-connecting to Linera...');
    connect();
  }, [isLoggedIn, primaryWallet, isConnected, connect]);
  
  // Auto-disconnect when user logs out
  useEffect(() => {
    if (!isLoggedIn && isConnected) {
      console.log('👋 User logged out, disconnecting from Linera...');
      disconnect();
    }
  }, [isLoggedIn, isConnected, disconnect]);
  
  // Reset auto-connect flag when wallet changes
  useEffect(() => {
    if (primaryWallet?.address) {
      autoConnectAttempted.current = false;
    }
  }, [primaryWallet?.address]);
  
  return {
    isConnecting,
    isConnected,
    isAppConnected,
    error,
    connection,
    walletAddress: connection?.address ?? primaryWallet?.address?.toLowerCase() ?? null,
    chainId: connection?.chainId ?? null,
    connect,
    disconnect,
    retry,
  };
}
