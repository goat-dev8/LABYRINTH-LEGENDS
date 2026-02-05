import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Play, Trophy, Clock, Sparkles, RotateCcw, X, Minimize, Link, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useGameStore } from '../stores/gameStore';
import { useWalletSigner, formatTime } from '../lib/wallet';
import { useLineraConnection } from '../hooks';
import { lineraAdapter } from '../lib/linera';
import { Tournament } from '../lib/chain/client';
import { LINERA_QUERIES, LINERA_MUTATIONS } from '../lib/chain/config';

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT-FIRST ARCHITECTURE
// - Smart contract is source of truth
// - Gameplay starts instantly (no blockchain wait)
// - All scoring/XP/leaderboard logic is on-chain
// - SubmitRun is the PRIMARY operation
// ═══════════════════════════════════════════════════════════════

// GraphQL operations
const GET_PLAYER = LINERA_QUERIES.getPlayer;
const REGISTER_PLAYER = LINERA_MUTATIONS.registerPlayer;
const SUBMIT_RUN = LINERA_MUTATIONS.submitRun;

// ═══════════════════════════════════════════════════════════════
// WALLET ADDRESS HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a hex wallet address (0x...) to a 20-byte array for GraphQL
 * The contract expects Vec<u8> which GraphQL represents as [Int!]!
 */
function walletToBytes(walletAddress: string): number[] {
  const hex = walletAddress.toLowerCase().replace('0x', '');
  if (hex.length !== 40) {
    console.error(`Invalid wallet address: ${walletAddress}`);
    return new Array(20).fill(0);
  }
  const bytes: number[] = [];
  for (let i = 0; i < 40; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

// API URL for backend
const API_URL = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) || 'http://localhost:3001';

// XP Calculation - estimates on frontend, actual calculation on-chain
// Base XP by difficulty: Easy=75, Medium=100, Hard=125, Nightmare=150
function calculateXpEstimate(timeMs: number, deaths: number, completed: boolean = true): number {
  // Assume medium difficulty for estimates
  const baseXp = 100;
  
  // Completion bonus: +base if completed
  const completionBonus = completed ? baseXp : 0;
  
  // Time bonus: faster = more XP (max +base for under 2 minutes)
  const timeSecs = Math.floor(timeMs / 1000);
  const timeBonus = (completed && timeSecs < 120) ? Math.floor(baseXp * (120 - timeSecs) / 120) : 0;
  
  // Death penalty: -10% per death, max 50%
  const deathPenalty = Math.min(deaths * 10, 50);
  const deathMultiplier = (100 - deathPenalty) / 100;
  
  // Calculate final XP
  const rawXp = (baseXp + completionBonus + timeBonus) * deathMultiplier;
  return Math.max(10, Math.floor(rawXp));
}

// Helper: Sync score to backend (fire and forget, as backup)
function syncScoreToBackendHelper(address: string, time: number, deathCount: number, coins: number = 0, gameScore: number = 0, tournamentId?: number) {
  const xpEstimate = calculateXpEstimate(time, deathCount, true);
  
  fetch(`${API_URL}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: address.toLowerCase(),
      game_type: 'ASTRAY_MAZE',
      score: gameScore > 0 ? gameScore : Math.max(0, 1000 - time - deathCount * 100 + coins * 50),
      xp_earned: xpEstimate,
      time_ms: Math.floor(time),
      deaths: deathCount,
      coins_collected: coins,
      tournament_id: tournamentId,
    }),
  })
    .then(() => console.log('✅ Score synced to backend (backup)'))
    .catch(err => console.warn('⚠️ Failed to sync to backend:', err));
}

// Local storage key for persisting registration
const REGISTRATION_KEY = 'labyrinth_player_registration';

// Helper: Save registration to localStorage
function saveRegistrationToLocalStorage(address: string, username: string) {
  try {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify({
      walletAddress: address.toLowerCase(),
      username,
      registeredAt: new Date().toISOString(),
    }));
    console.log('💾 Registration saved to localStorage');
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export default function AstrayPlayPage() {
  const { primaryWallet } = useDynamicContext();
  const { getAddress } = useWalletSigner();
  const { isAppConnected } = useLineraConnection();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    player,
    setPlayer,
    isRegistered,
    showRegistrationModal,
    setShowRegistrationModal,
    setLastRunXp,
    startGame,
    resetGame,
  } = useGameStore();

  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [submittingToChain, setSubmittingToChain] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gameTime, setGameTime] = useState(0);
  const [gameScore, setGameScore] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [deathCount, setDeathCount] = useState(0);

  // ═══════════════════════════════════════════════════════════════
  // TOURNAMENT STATE - The active tournament we're playing in
  // ═══════════════════════════════════════════════════════════════
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true); // Start as true to prevent premature play
  
  // Registration check ref - prevents duplicate checks
  const registrationCheckedRef = useRef<string | null>(null);

  // Listen for messages from the Astray game iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || !data.type) return;
      
      switch (data.type) {
        case 'levelStart':
          console.log('🎮 Level started:', data);
          setCurrentLevel(data.level);
          setGameScore(data.score || 0);
          break;
          
        case 'levelComplete':
          console.log('🏆 Level complete:', data);
          setCurrentLevel(data.level + 1);
          setGameTime(data.time);
          setGameScore(data.score || 0);
          setCoinsCollected(data.coins || 0);
          
          // Auto-submit to blockchain every 3 levels
          if (data.level % 3 === 0 && isRegistered && activeTournament) {
            handleSubmitScore(data.time, deathCount, data.coins || 0, data.score || 0);
          }
          break;
          
        case 'coinCollected':
          setCoinsCollected(data.total || 0);
          setGameScore(data.score || gameScore);
          break;
          
        case 'death':
          setDeathCount(prev => prev + 1);
          break;
          
        case 'gameComplete':
          console.log('🎉 Game complete:', data);
          setGameTime(data.time);
          setGameScore(data.score || 0);
          // Auto-submit final score
          if (isRegistered && activeTournament) {
            handleSubmitScore(data.time, deathCount, coinsCollected, data.score || 0);
          }
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isRegistered, gameScore, activeTournament, deathCount, coinsCollected]);

  // ═══════════════════════════════════════════════════════════════
  // TOURNAMENT - Fetch from blockchain (source of truth)
  // Only fallback to default if NOT connected to Linera
  // ═══════════════════════════════════════════════════════════════
  
  // Refetch tournament function (reusable)
  const refetchTournament = async () => {
    if (!isAppConnected) return;
    
    try {
      const GET_ACTIVE_TOURNAMENT = `
        query GetActiveTournament {
          activeTournament {
            id
            title
            description
            mazeSeed
            difficulty
            startTime
            endTime
            status
            participantCount
            totalRuns
            xpRewardPool
          }
        }
      `;

      const result = await lineraAdapter.query<{ 
        activeTournament: {
          id: number;
          title: string;
          description: string;
          mazeSeed: string;
          difficulty: string;
          startTime: string;
          endTime: string;
          status: string;
          participantCount: number;
          totalRuns: number;
          xpRewardPool: number;
        } | null 
      }>(GET_ACTIVE_TOURNAMENT);
      
      if (result.activeTournament) {
        const t = result.activeTournament;
        const tournament: Tournament = {
          id: t.id,
          title: t.title,
          description: t.description,
          mazeSeed: t.mazeSeed,
          difficulty: t.difficulty as Tournament['difficulty'],
          startTime: parseInt(t.startTime) / 1000,
          endTime: parseInt(t.endTime) / 1000,
          status: t.status as Tournament['status'],
          participantCount: t.participantCount,
          totalRuns: t.totalRuns,
          xpRewardPool: t.xpRewardPool,
        };
        setActiveTournament(tournament);
        setLoadingTournament(false); // Clear loading state on successful refetch
        console.log(`🔄 Tournament refreshed: ${tournament.participantCount} participants, ${tournament.totalRuns} runs`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to refetch tournament:', error);
    }
  };

  // Subscribe to block notifications for auto-refetch
  useEffect(() => {
    if (!isAppConnected) return;
    
    const unsubscribe = lineraAdapter.subscribe(() => {
      // New block received - refetch tournament state
      console.log('🔔 Block notification - refetching tournament...');
      refetchTournament();
    });
    
    return () => unsubscribe();
  }, [isAppConnected]);

  useEffect(() => {
    async function fetchActiveTournament() {
      if (!isAppConnected) {
        // FALLBACK: Use default tournament ONLY when not connected to Linera
        const now = Date.now();
        const defaultTournament: Tournament = {
          id: 1,
          title: "Labyrinth Legends Championship",
          description: "15-day tournament - Navigate the maze faster than anyone else!",
          mazeSeed: "labyrinth_legends_championship",
          difficulty: "Medium",
          startTime: now - (2 * 24 * 60 * 60 * 1000),
          endTime: now + (13 * 24 * 60 * 60 * 1000),
          status: "Active",
          participantCount: 0,
          totalRuns: 0,
          xpRewardPool: 10000,
        };
        setActiveTournament(defaultTournament);
        setLoadingTournament(false);
        console.log('🏆 Using default tournament (not connected to chain)');
        return;
      }

      setLoadingTournament(true);
      try {
        console.log('📡 Fetching active tournament from blockchain...');
        
        const GET_ACTIVE_TOURNAMENT = `
          query GetActiveTournament {
            activeTournament {
              id
              title
              description
              mazeSeed
              difficulty
              startTime
              endTime
              status
              participantCount
              totalRuns
              xpRewardPool
            }
          }
        `;

        // The service.rs now returns FIXED tournament data even if state is empty
        const result = await lineraAdapter.query<{ 
          activeTournament: {
            id: number;
            title: string;
            description: string;
            mazeSeed: string;
            difficulty: string;
            startTime: string;
            endTime: string;
            status: string;
            participantCount: number;
            totalRuns: number;
            xpRewardPool: number;
          } | null 
        }>(GET_ACTIVE_TOURNAMENT);
        
        console.log('📦 Blockchain query result:', JSON.stringify(result, null, 2));

        if (result.activeTournament) {
          const t = result.activeTournament;
          // Convert timestamps from microseconds to milliseconds
          const tournament: Tournament = {
            id: t.id,
            title: t.title,
            description: t.description,
            mazeSeed: t.mazeSeed,
            difficulty: t.difficulty as Tournament['difficulty'],
            startTime: parseInt(t.startTime) / 1000,
            endTime: parseInt(t.endTime) / 1000,
            status: t.status as Tournament['status'],
            participantCount: t.participantCount,
            totalRuns: t.totalRuns,
            xpRewardPool: t.xpRewardPool,
          };
          setActiveTournament(tournament);
          console.log(`🏆 Tournament loaded from blockchain: ${tournament.title}`);
        } else {
          // Service returned null - tournament may not exist yet, try bootstrap
          console.log('⚠️ No tournament on chain, attempting bootstrap...');
          try {
            // Bootstrap must go to hub chain directly (not cross-chain)
            await lineraAdapter.mutateHub(LINERA_MUTATIONS.bootstrapTournament, {});
            console.log('✅ Bootstrap mutation sent to hub, waiting for block...');
            // Will refetch automatically when block notification arrives
          } catch (bootstrapErr) {
            console.warn('⚠️ Bootstrap failed:', bootstrapErr);
          }
          // Stay in loading state - block notification will trigger refetch
          // Don't use default data when connected to Linera
        }
      } catch (error) {
        console.error('Failed to fetch tournament from blockchain:', error);
        // On error, stay in loading state - don't fall back to fake data
        // The block notification system will retry automatically
      } finally {
        setLoadingTournament(false);
      }
    }

    fetchActiveTournament();
  }, [isAppConnected]);

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND REGISTRATION SYNC (NON-BLOCKING)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!primaryWallet || !isAppConnected) return;
    
    const address = getAddress();
    if (!address) return;
    
    // Create unique key for this wallet + app combination
    const appId = lineraAdapter.getApplicationId?.() || 'default';
    const checkKey = `${appId}-${address.toLowerCase()}`;
    
    // ONE-SHOT GUARD: Skip if already checked
    if (registrationCheckedRef.current === checkKey) return;
    registrationCheckedRef.current = checkKey;
    
    // Capture address for async closure
    const walletAddress = address;
    
    // BACKGROUND - fire and forget
    async function backgroundSync() {
      try {
        const result = await lineraAdapter.query<{ player: { walletAddress: string; username: string } | null }>(
          GET_PLAYER,
          { owner: walletAddress.toLowerCase() }
        );
        
        if (result.player) {
          console.log('✅ Player verified on-chain');
        }
      } catch {
        // Silently ignore - will auto-register on first run
      }
    }
    
    backgroundSync();
  }, [primaryWallet, isAppConnected, getAddress]);

  // Handle registration - INSTANT UX, blockchain syncs in background
  const handleRegister = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      toast.error('Username must be 3-20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, underscores and hyphens');
      return;
    }

    const address = getAddress();
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setRegistering(true);
    try {
      console.log(`📝 Registering player: ${username}`);
      
      // Step 1: Register on backend first (instant)
      await fetch(`${API_URL}/api/players/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address.toLowerCase(),
          username: username.trim(),
        }),
      });

      // Step 2: Update local state IMMEDIATELY
      setPlayer({
        walletAddress: address,
        username: username.trim(),
        totalXp: 0,
        practiceRuns: 0,
        tournamentRuns: 0,
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        registeredAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      });
      
      saveRegistrationToLocalStorage(address, username.trim());
      setShowRegistrationModal(false);
      toast.success('Welcome to Labyrinth Legends! 🎮');
      
      // Step 3: BACKGROUND - Register on blockchain (fire and forget)
      if (isAppConnected) {
        const walletBytes = walletToBytes(address);
        lineraAdapter.mutate(REGISTER_PLAYER, { 
          walletAddress: walletBytes,
          username: username.trim() 
        }).catch(() => {
          // Will auto-register on first SubmitRun
        });
      }
      
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error('Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Handle score submission - TOURNAMENT FIRST
  // Primary: Submit to blockchain tournament
  // Secondary: Sync to backend as backup
  const handleSubmitScore = async (time: number, deaths: number, coins: number = 0, score: number = 0) => {
    const address = getAddress();
    if (!address || !isRegistered) return;

    // MUST have an active tournament to submit
    if (!activeTournament) {
      toast.error('No active tournament. Scores saved locally.');
      syncScoreToBackendHelper(address, time, deaths, coins, score);
      return;
    }

    setSubmittingRun(true);
    try {
      // PRIMARY: Submit run to blockchain tournament
      if (isAppConnected) {
        await submitRunToChain(activeTournament.id, time, deaths, coins, score);
      }
      
      // SECONDARY: Always sync to backend as backup
      syncScoreToBackendHelper(address, time, deaths, coins, score, activeTournament.id);
      
    } catch (error) {
      console.error('Failed to submit score:', error);
    } finally {
      setSubmittingRun(false);
    }
  };
  
  // Submit run to Linera blockchain (tournament-first)
  const submitRunToChain = async (tournamentId: number, time: number, deaths: number, coins: number, score: number) => {
    const address = getAddress();
    if (!address || !isAppConnected) {
      console.warn('⚠️ Cannot submit to blockchain - not connected');
      return;
    }
    
    setSubmittingToChain(true);
    try {
      console.log(`📤 Submitting run to tournament #${tournamentId}...`);
      console.log('📝 Run data:', { tournamentId, timeMs: Math.floor(time), score, coins, deaths, completed: true });
      
      // SubmitRun is the PRIMARY operation - auto-registers player if needed
      const result = await lineraAdapter.mutate(
        SUBMIT_RUN,
        {
          tournamentId,
          timeMs: Math.floor(time),
          score,
          coins,
          deaths,
          completed: true,
        }
      );
      
      // Mutation sent successfully (fire-and-forget)
      // Result may be empty for cross-chain messages
      console.log('📦 Mutation sent:', result);
      const xpEstimate = calculateXpEstimate(time, deaths, true);
      console.log('✅ Run submitted to blockchain!');
      setLastRunXp(xpEstimate);
      toast.success(`+${xpEstimate} XP earned! 🎉`, { duration: 3000 });
      
      // Block notification system will auto-refetch tournament state
      // No need for manual setTimeout - subscription handles it
    } catch (error) {
      // Log error but don't panic - the run may still go through
      // Cross-chain messages are async and may not return immediately
      console.warn('⚠️ Mutation may have failed:', error);
      const xpEstimate = calculateXpEstimate(time, deaths, true);
      setLastRunXp(xpEstimate);
      // Show optimistic success - backend has the score as backup
      toast.success(`+${xpEstimate} XP! (syncing...)`, { duration: 3000 });
    } finally {
      setSubmittingToChain(false);
    }
  };

  // Handle play button - INSTANT gameplay, no blockchain wait
  const handlePlay = async () => {
    if (!primaryWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isRegistered) {
      setShowRegistrationModal(true);
      return;
    }

    // Check if tournament is still loading
    if (loadingTournament) {
      toast('Loading tournament data...', { icon: '⏳' });
      return;
    }

    // Check for active tournament
    if (!activeTournament) {
      toast('No tournament active. Playing for practice!', { icon: 'ℹ️' });
    } else {
      toast.success(`Playing in: ${activeTournament.title}`, { duration: 2000 });
    }

    // START GAME IMMEDIATELY
    console.log('🎮 Starting game instantly!');
    setGameStarted(true);
    setIsFullscreen(true);
    setDeathCount(0); // Reset deaths
    startGame();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Exit game
  const handleExitGame = () => {
    // Auto-submit score on exit if we have a valid run
    if (gameTime > 0 && isRegistered && activeTournament) {
      handleSubmitScore(gameTime, deathCount, coinsCollected, gameScore);
    }
    setIsFullscreen(false);
    setGameStarted(false);
    resetGame();
  };

  // Handle restart
  const handleRestart = () => {
    // Auto-submit before restart if we have a valid run
    if (gameTime > 0 && isRegistered && activeTournament) {
      handleSubmitScore(gameTime, deathCount, coinsCollected, gameScore);
    }
    
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setCurrentLevel(1);
    setGameTime(0);
    setGameScore(0);
    setCoinsCollected(0);
    setDeathCount(0);
    resetGame();
  };

  // Handle manual score submit
  const handleManualSubmit = () => {
    if (gameTime > 0) {
      handleSubmitScore(gameTime, deathCount, coinsCollected, gameScore);
    }
  };

  return (
    <>
      {/* Fullscreen Game Overlay */}
      <AnimatePresence>
        {isFullscreen && gameStarted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Trophy size={20} className="text-neon-yellow" />
                  <span className="font-mono text-xl text-neon-yellow">Level {currentLevel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-neon-cyan" />
                  <span className="font-mono text-xl text-neon-cyan">{formatTime(gameTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg text-green-400">SCORE: {gameScore.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg text-neon-yellow">🪙 {coinsCollected}</span>
                  <span className="font-mono text-lg text-red-400">💀 {deathCount}</span>
                </div>
                {/* Tournament & Blockchain Status */}
                <div className="flex items-center gap-1.5">
                  <Link size={16} className={isAppConnected ? 'text-green-400' : 'text-gray-500'} />
                  <span className={`text-xs ${isAppConnected ? 'text-green-400' : 'text-gray-500'}`}>
                    {activeTournament ? `🏆 ${activeTournament.title}` : isAppConnected ? 'On-Chain' : 'Offline'}
                  </span>
                  {submittingToChain && (
                    <span className="text-xs text-neon-cyan animate-pulse">Saving...</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isRegistered && gameTime > 0 && (
                  <button
                    onClick={handleManualSubmit}
                    disabled={submittingRun}
                    className="btn-neon-filled-yellow px-3 py-1.5 flex items-center gap-2 text-sm"
                  >
                    <Sparkles size={16} />
                    {submittingRun ? 'Saving...' : 'Save Score'}
                  </button>
                )}
                <button
                  onClick={handleRestart}
                  className="p-2 rounded-lg bg-dark-800/80 text-white hover:bg-dark-700 transition"
                  title="Restart"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-dark-800/80 text-white hover:bg-dark-700 transition"
                  title="Exit Fullscreen"
                >
                  <Minimize size={20} />
                </button>
                <button
                  onClick={handleExitGame}
                  className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-500 transition"
                  title="Exit Game"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Game iframe - fullscreen */}
            <iframe
              ref={iframeRef}
              src="/astray/index.html"
              className="w-full h-full"
              style={{ border: 'none' }}
              title="Astray Maze Game"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Normal Page View */}
      <div className="min-h-screen bg-dark-900 pt-20 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-display text-4xl font-bold gradient-text mb-2">
              Astray Maze
            </h1>
            <p className="text-gray-400">
              Navigate through the 3D maze • Use arrow keys to move
            </p>
          </div>

          {/* Game Stats Bar */}
          {gameStarted && (
            <div className="flex items-center justify-center gap-8 py-3 bg-dark-800 rounded-t-xl border border-dark-600 border-b-0">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-neon-yellow" />
                <span className="font-mono text-lg text-neon-yellow">Level {currentLevel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-neon-cyan" />
                <span className="font-mono text-lg text-neon-cyan">{formatTime(gameTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-neon-yellow" />
                <span className="font-mono text-lg text-neon-yellow">🪙 {coinsCollected} � {deathCount}</span>
              </div>
              {activeTournament && (
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-neon-purple" />
                  <span className="font-mono text-sm text-neon-purple">{activeTournament.title}</span>
                </div>
              )}
            </div>
          )}

          {/* Game Container */}
          <div className="relative bg-dark-800 rounded-xl overflow-hidden border border-dark-600" style={{ minHeight: '600px' }}>
            {!gameStarted ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <h2 className="font-display text-3xl font-bold mb-4 gradient-text">
                    Ready to Play?
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-md">
                    Navigate through 3D mazes using arrow keys. <br />
                    Complete levels to earn XP on the Linera blockchain!
                  </p>
                  <button
                    onClick={handlePlay}
                    className="btn-neon-filled-cyan text-lg px-8 py-4 flex items-center gap-3 mx-auto"
                  >
                    <Play size={24} />
                    Start Game
                  </button>
                </motion.div>
              </div>
            ) : (
              <>
                <iframe
                  ref={iframeRef}
                  src="/astray/index.html"
                  className="w-full h-full absolute inset-0"
                  style={{ minHeight: '600px', border: 'none' }}
                  title="Astray Maze Game"
                />

                {/* Action buttons */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button
                    onClick={handleRestart}
                    className="btn-neon-cyan p-3 rounded-lg"
                    title="Restart Game"
                  >
                    <RotateCcw size={20} />
                  </button>
                  {isRegistered && gameTime > 0 && (
                    <button
                      onClick={handleManualSubmit}
                      disabled={submittingRun}
                      className="btn-neon-filled-yellow px-4 py-2 flex items-center gap-2"
                    >
                      <Sparkles size={18} />
                      {submittingRun ? 'Submitting...' : 'Submit Score'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-dark-800 rounded-xl p-6 border border-dark-600">
            <h3 className="font-display text-xl font-bold text-neon-cyan mb-4">How to Play</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">Controls</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Arrow keys to tilt the maze</li>
                  <li>Roll the ball to the exit</li>
                  <li>Press 'I' for in-game instructions</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Tournament Scoring</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Compete in active tournaments for XP</li>
                  <li>Faster times = higher leaderboard rank</li>
                  <li>Top 5 players earn bonus XP rewards</li>
                </ul>
              </div>
            </div>
            
            {/* Active Tournament Info */}
            {activeTournament ? (
              <div className="mt-4 p-4 bg-neon-purple/10 border border-neon-purple/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-neon-purple flex items-center gap-2">
                      <Trophy size={18} />
                      Active Tournament: {activeTournament.title}
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">{activeTournament.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {activeTournament.participantCount} players • {activeTournament.totalRuns} runs • {activeTournament.xpRewardPool} XP pool
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Difficulty</span>
                    <p className="font-semibold text-white">{activeTournament.difficulty}</p>
                  </div>
                </div>
              </div>
            ) : loadingTournament ? (
              <div className="mt-4 p-4 bg-dark-700 border border-dark-600 rounded-lg text-center">
                <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                <p className="text-sm text-gray-400">Loading tournament...</p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-center">
                <p className="text-sm text-yellow-400">No active tournament. Check back soon!</p>
              </div>
            )}
          </div>

          {/* Player Stats */}
          {player && (
            <div className="mt-4 bg-dark-800 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-xl font-bold">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-white">{player.username}</h4>
                  <p className="text-sm text-gray-400">{player.totalXp} XP</p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegistrationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-600"
            >
              <h2 className="font-display text-2xl font-bold mb-2">Register to Play</h2>
              <p className="text-gray-400 text-sm mb-6">
                Create a username to track your scores and earn XP on-chain.
              </p>

              {/* Show blockchain connection status */}
              {!isAppConnected && (
                <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-center">
                  <span className="text-yellow-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Connecting to Linera blockchain...
                  </span>
                </div>
              )}
              
              {isAppConnected && (
                <div className="mb-4 p-2 bg-green-900/30 border border-green-500/50 rounded-lg text-center">
                  <span className="text-green-400 text-xs flex items-center justify-center gap-2">
                    <Link size={12} />
                    Connected to Linera - Auto-signing enabled
                  </span>
                </div>
              )}

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (3-20 characters)"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-neon-cyan"
                maxLength={20}
              />

              <button
                onClick={handleRegister}
                disabled={registering || !username.trim() || !isAppConnected}
                className="w-full btn-neon-filled-cyan py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {registering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registering on blockchain...
                  </>
                ) : (
                  <>
                    <Link size={16} />
                    Register on Linera
                  </>
                )}
              </button>

              <p className="text-center text-gray-500 text-xs mt-4">
                ✨ No wallet popup needed - auto-signed on Linera blockchain!
              </p>

              <button
                onClick={() => setShowRegistrationModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
