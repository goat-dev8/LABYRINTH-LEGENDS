import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Play, Trophy, Clock, Sparkles, RotateCcw, X, Minimize, Link, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useGameStore } from '../stores/gameStore';
import { useWalletSigner, formatTime } from '../lib/wallet';
import { getPlayer } from '../lib/api';
import { useLineraConnection } from '../hooks';
import { lineraAdapter } from '../lib/linera';

// GraphQL query to check player on blockchain
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

// Simpler registration check
const IS_REGISTERED = `
  query IsRegistered($owner: String!) {
    isRegistered(owner: $owner)
  }
`;

// GraphQL mutation for registering player on blockchain (auto-signed, no popup!)
const REGISTER_PLAYER = `
  mutation RegisterPlayer($username: String!) {
    registerPlayer(username: $username)
  }
`;

// GraphQL mutation for submitting game run to blockchain
const SUBMIT_RUN = `
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
`;

// API URL for backend
const API_URL = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) || 'http://localhost:3001';

// Helper: Sync player to backend (fire and forget)
function syncPlayerToBackendHelper(address: string, username: string, chainId: string) {
  fetch(`${API_URL}/api/players/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: address.toLowerCase(),
      username,
      chain_id: chainId,
    }),
  })
    .then(() => console.log('✅ Player synced to backend'))
    .catch(err => console.warn('⚠️ Failed to sync player to backend:', err));
}

// XP Calculation matching contract formula:
// Base XP by difficulty: Easy=75, Medium=100, Hard=125, Nightmare=150
// + Completion bonus (100% of base if completed)
// + Time bonus (up to 100% of base for fast completion, under 2 min)
// - Death penalty (10% per death, max 50%)
function calculateXpMatchingContract(level: number, timeMs: number, deaths: number, completed: boolean = true): number {
  // Determine difficulty based on level (matching submitToBlockchain)
  const difficulty = level <= 3 ? 'EASY' : level <= 6 ? 'MEDIUM' : level <= 9 ? 'HARD' : 'NIGHTMARE';
  
  // Base XP by difficulty (matching contract lib.rs)
  const baseXpMap: Record<string, number> = { 'EASY': 75, 'MEDIUM': 100, 'HARD': 125, 'NIGHTMARE': 150 };
  const baseXp = baseXpMap[difficulty] || 75;
  
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

// Helper: Sync score to backend (fire and forget)
function syncScoreToBackendHelper(address: string, time: number, deathCount: number, level: number, chainId?: string, coins: number = 0, gems: number = 0, stars: number = 0, gameScore: number = 0) {
  // Use contract-matching XP calculation
  const xpEarned = calculateXpMatchingContract(level, time, deathCount, true);
  
  fetch(`${API_URL}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: address.toLowerCase(),
      game_type: 'ASTRAY_MAZE',
      score: gameScore > 0 ? gameScore : Math.max(0, level * 1000 - time - deathCount * 100 + coins * 50 + gems * 200 + stars * 500),
      xp_earned: xpEarned,
      time_ms: Math.floor(time),  // Send time to backend for best time tracking
      level_reached: level,
      deaths: deathCount,
      bonus_data: level,
      chain_id: chainId,
      coins_collected: coins,
      gems_collected: gems,
      stars_collected: stars,
    }),
  })
    .then(() => console.log('✅ Score synced to backend'))
    .catch(err => console.warn('⚠️ Failed to sync score to backend:', err));
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

// Helper: Load registration from localStorage
function loadRegistrationFromLocalStorage(address: string): { username: string; registeredAt: string } | null {
  try {
    const data = localStorage.getItem(REGISTRATION_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.walletAddress?.toLowerCase() === address.toLowerCase()) {
      return { username: parsed.username, registeredAt: parsed.registeredAt };
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
  }
  return null;
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
  const [gemsCollected, setGemsCollected] = useState(0);
  const [starsCollected, setStarsCollected] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

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
          setGemsCollected(data.gems || 0);
          setStarsCollected(data.stars || 0);
          setMaxCombo(data.maxCombo || 0);
          
          // Auto-submit score every 3 levels (don't await, let it run in background)
          if (data.level % 3 === 0 && isRegistered) {
            handleSubmitScore(data.time, 0, data.level, data.coins || 0, data.gems || 0, data.stars || 0, data.score || 0);
          }
          break;
          
        case 'coinCollected':
          setCoinsCollected(data.total || 0);
          setGameScore(data.score || gameScore);
          break;
          
        case 'gemCollected':
          setGemsCollected(data.total || 0);
          setGameScore(data.score || gameScore);
          break;
          
        case 'starCollected':
          setStarsCollected(data.total || 0);
          setGameScore(data.score || gameScore);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isRegistered, gameScore]);

  // Check player registration on wallet connect - checks localStorage, backend, AND blockchain
  useEffect(() => {
    async function checkRegistration() {
      const address = getAddress();
      if (!address) return;
      
      // Skip if already registered (prevents overwriting after just registering)
      if (isRegistered) {
        console.log('✅ Player already registered, skipping check');
        return;
      }

      // FIRST: Check localStorage (instant, works offline)
      const localReg = loadRegistrationFromLocalStorage(address);
      if (localReg) {
        console.log('✅ Player found in localStorage:', localReg.username);
        setPlayer({
          walletAddress: address,
          username: localReg.username,
          totalXp: 0,
          practiceRuns: 0,
          tournamentRuns: 0,
          tournamentsPlayed: 0,
          tournamentsWon: 0,
          registeredAt: localReg.registeredAt,
          lastActive: new Date().toISOString(),
        });
        return;
      }

      // SECOND: Try backend (fast, cached)
      try {
        const existingPlayer = await getPlayer(address);
        if (existingPlayer) {
          console.log('✅ Player found in backend');
          setPlayer(existingPlayer);
          // Also save to localStorage for offline access
          saveRegistrationToLocalStorage(address, existingPlayer.username);
          return;
        }
      } catch (error) {
        console.log('Player not in backend, checking blockchain...');
      }
      
      // If backend doesn't have player, check blockchain directly
      if (isAppConnected) {
        try {
          // First try detailed player query
          console.log('🔍 Checking blockchain for player:', address.toLowerCase());
          const result = await lineraAdapter.query<{ player: { owner: string; username: string; totalXp: number; practiceRuns: number } | null }>(
            GET_PLAYER,
            { owner: address.toLowerCase() }
          );
          
          if (result.player) {
            console.log('✅ Player found on blockchain:', result.player.username);
            setPlayer({
              walletAddress: address,
              username: result.player.username,
              totalXp: result.player.totalXp || 0,
              practiceRuns: result.player.practiceRuns || 0,
              tournamentRuns: 0,
              tournamentsPlayed: 0,
              tournamentsWon: 0,
              registeredAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            });
            
            // Sync to backend in background
            const chainIdValue = lineraAdapter.getChainId();
            if (chainIdValue) {
              syncPlayerToBackendHelper(address, result.player.username, chainIdValue);
            }
            return;
          }
          
          // If player query returned null, try simple isRegistered check
          const regCheck = await lineraAdapter.query<{ isRegistered: boolean }>(
            IS_REGISTERED,
            { owner: address.toLowerCase() }
          );
          
          if (regCheck.isRegistered) {
            console.log('⚠️ Player is registered but data not available yet');
            // User is registered but data not synced - create minimal profile
            setPlayer({
              walletAddress: address,
              username: `Player_${address.slice(2, 8)}`,
              totalXp: 0,
              practiceRuns: 0,
              tournamentRuns: 0,
              tournamentsPlayed: 0,
              tournamentsWon: 0,
              registeredAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            });
          } else {
            console.log('📝 Player not registered on blockchain');
          }
        } catch (error) {
          console.log('Player not registered on blockchain yet:', error);
        }
      }
    }

    if (primaryWallet && !isRegistered) {
      checkRegistration();
    }
  }, [primaryWallet, getAddress, setPlayer, isAppConnected, isRegistered]);

  // Handle registration - uses Linera blockchain with auto-signing (NO wallet popup!)
  const handleRegister = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    // Validate username format
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

    // Check if Linera is connected for blockchain registration
    if (!isAppConnected) {
      toast.error('Waiting for blockchain connection...');
      return;
    }

    setRegistering(true);
    try {
      console.log(`📝 Registering player on Linera: ${username}`);
      
      // Step 1: Register on Linera blockchain (AUTO-SIGNED - no wallet popup!)
      await lineraAdapter.mutate(REGISTER_PLAYER, { username: username.trim() });
      console.log('✅ Player registered on blockchain');
      
      // Step 2: Sync to backend (async, for leaderboards) - chainId used as auth
      const chainIdValue = lineraAdapter.getChainId();
      if (chainIdValue) {
        // Fire and forget - backend sync for leaderboards  
        syncPlayerToBackendHelper(address, username.trim(), chainIdValue);
      }

      // Update local state
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
      
      // Save to localStorage for persistence (works even if blockchain is unreachable)
      saveRegistrationToLocalStorage(address, username.trim());
      
      setShowRegistrationModal(false);
      toast.success('Registration successful! 🎮 (On-chain)');
    } catch (error) {
      console.error('Registration error:', error);
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast.error(message);
    } finally {
      setRegistering(false);
    }
  };

  // Handle score submission - uses Linera blockchain with auto-signing (NO popup!)
  const handleSubmitScore = async (time: number, deathCount: number, level: number, coins: number = 0, gems: number = 0, stars: number = 0, score: number = 0) => {
    const address = getAddress();
    if (!address || !isRegistered) return;

    setSubmittingRun(true);
    try {
      // PRIMARY: Submit to Linera blockchain (auto-signed, no popup!)
      if (isAppConnected) {
        submitToBlockchain(time, deathCount, level, score).catch(err => {
          console.error('Blockchain submit error (non-blocking):', err);
        });
      }
      
      // SECONDARY: Sync to backend (no signature needed, just API call)
      const chainIdValue = lineraAdapter.getChainId();
      syncScoreToBackendHelper(address, time, deathCount, level, chainIdValue || undefined, coins, gems, stars, score);
      
    } catch (error) {
      console.error('Failed to submit score:', error);
    } finally {
      setSubmittingRun(false);
    }
  };
  
  // Submit score to Linera blockchain
  const submitToBlockchain = async (time: number, deathCount: number, level: number, _score: number = 0) => {
    const address = getAddress();
    if (!address || !isAppConnected) {
      console.warn('⚠️ Cannot submit to blockchain - not connected');
      return;
    }
    
    setSubmittingToChain(true);
    try {
      console.log('📤 Submitting run to Linera blockchain (auto-signed)...');
      // XP is calculated by the contract, but we estimate for display
      const xpEarned = calculateXpMatchingContract(level, time, deathCount, true);
      const difficulty = level <= 3 ? 'EASY' : level <= 6 ? 'MEDIUM' : level <= 9 ? 'HARD' : 'NIGHTMARE';
      
      await lineraAdapter.mutate(
        SUBMIT_RUN,
        {
          mode: 'PRACTICE',
          tournamentId: null,
          difficulty,
          levelReached: level,
          timeMs: Math.floor(time),
          deaths: deathCount,
          completed: true,
        }
      );
      
      console.log('✅ Run saved on blockchain!');
      setLastRunXp(xpEarned);
      toast.success(`+${xpEarned} XP earned! 🎉 (On-chain)`, { duration: 3000 });
    } catch (error) {
      console.error('Failed to submit to blockchain:', error);
      // Still show XP based on contract-matching calculation
      const xpEarned = calculateXpMatchingContract(level, time, deathCount, true);
      setLastRunXp(xpEarned);
      toast.success(`+${xpEarned} XP! ⚠️ Chain sync pending`, { duration: 3000 });
    } finally {
      setSubmittingToChain(false);
    }
  };

  // Handle play button
  const handlePlay = () => {
    if (!primaryWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isRegistered) {
      setShowRegistrationModal(true);
      return;
    }

    setGameStarted(true);
    setIsFullscreen(true);
    startGame();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Exit game
  const handleExitGame = () => {
    setIsFullscreen(false);
    setGameStarted(false);
    resetGame();
  };

  // Handle restart
  const handleRestart = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setCurrentLevel(1);
    setGameTime(0);
    setGameScore(0);
    setCoinsCollected(0);
    setGemsCollected(0);
    setStarsCollected(0);
    setMaxCombo(0);
    resetGame();
  };

  // Handle manual score submit
  const handleManualSubmit = () => {
    if (gameTime > 0) {
      handleSubmitScore(gameTime, 0, currentLevel, coinsCollected, gemsCollected, starsCollected, gameScore);
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
                  <span className="font-mono text-lg text-purple-400">💎 {gemsCollected}</span>
                  <span className="font-mono text-lg text-cyan-400">⭐ {starsCollected}</span>
                  {maxCombo >= 2 && <span className="font-mono text-lg text-orange-400">🔥 {maxCombo}x</span>}
                </div>
                {/* Blockchain Status */}
                <div className="flex items-center gap-1.5">
                  <Link size={16} className={isAppConnected ? 'text-green-400' : 'text-gray-500'} />
                  <span className={`text-xs ${isAppConnected ? 'text-green-400' : 'text-gray-500'}`}>
                    {isAppConnected ? 'On-Chain' : 'Offline'}
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
                <span className="font-mono text-lg text-neon-yellow">🪙 {coinsCollected} 💎 {gemsCollected}</span>
              </div>
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
                <h4 className="font-semibold text-white mb-2">Scoring</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Complete levels to increase difficulty</li>
                  <li>Your progress is recorded on Linera blockchain</li>
                  <li>Scores auto-submit every 3 levels</li>
                </ul>
              </div>
            </div>
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
