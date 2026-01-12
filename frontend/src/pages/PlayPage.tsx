import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Play, Pause, RotateCcw, Settings, Clock, Skull, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import { useGameStore } from '../stores/gameStore';
import { useWalletSigner, formatTime } from '../lib/wallet';
import { submitRun, getPlayer, registerPlayer } from '../lib/api';
import type { Difficulty } from '../types';

// Dynamically import game engine
let LabyrinthGame: any = null;

const DIFFICULTIES: { value: Difficulty; label: string; description: string; icon: string }[] = [
  { value: 'Easy', label: 'Easy', description: '6×6 maze • Beginner friendly', icon: '🕯️' },
  { value: 'Medium', label: 'Medium', description: '10×10 maze • Balanced challenge', icon: '⚔️' },
  { value: 'Hard', label: 'Hard', description: '15×15 maze • For veterans', icon: '🔥' },
  { value: 'Nightmare', label: 'Nightmare', description: '20×20 maze • Ultimate test', icon: '💀' },
];

// Get difficulty colors for dungeon theme
function getDungeonDifficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-400';
    case 'Medium':
      return 'text-gold-400';
    case 'Hard':
      return 'text-torch-orange';
    case 'Nightmare':
      return 'text-torch-red';
    default:
      return 'text-gold-400';
  }
}

export default function PlayPage() {
  const { primaryWallet } = useDynamicContext();
  const { signMessage, getAddress } = useWalletSigner();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);

  const {
    player,
    setPlayer,
    isRegistered,
    selectedDifficulty,
    setSelectedDifficulty,
    selectedMode,
    isPlaying,
    isPaused,
    currentTime,
    deaths,
    showRegistrationModal,
    setShowRegistrationModal,
    showGameOverModal,
    setShowGameOverModal,
    lastRunXp,
    setLastRunXp,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    updateTime,
    incrementDeaths,
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [, setSubmittingRun] = useState(false);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [gameEngineError, setGameEngineError] = useState<string | null>(null);

  // Load game engine
  useEffect(() => {
    async function loadGameEngine() {
      try {
        // @ts-ignore - game-engine module doesn't have types
        const gameModule = await import('@labyrinth-legends/game-engine');
        LabyrinthGame = gameModule.LabyrinthGame;
        setGameLoaded(true);
      } catch (error) {
        console.error('Failed to load game engine:', error);
        setGameEngineError('Failed to load game engine. Please refresh the page.');
      }
    }
    loadGameEngine();
  }, []);

  // Check player registration on wallet connect
  useEffect(() => {
    async function checkRegistration() {
      const address = getAddress();
      if (address) {
        const existingPlayer = await getPlayer(address);
        if (existingPlayer) {
          setPlayer(existingPlayer);
        }
      } else {
        setPlayer(null);
      }
    }
    checkRegistration();
  }, [primaryWallet, getAddress, setPlayer]);

  // Handle registration
  const handleRegister = async () => {
    const address = getAddress();
    if (!address || !username.trim()) {
      toast.error('Please connect wallet and enter username');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      toast.error('Username must be 3-20 characters');
      return;
    }

    setRegistering(true);
    try {
      const message = `Register for Labyrinth Legends with username: ${username}`;
      const signature = await signMessage(message);
      const newPlayer = await registerPlayer(address, username, signature);
      setPlayer(newPlayer);
      setShowRegistrationModal(false);
      toast.success('Registration successful!');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  // Initialize game
  const initializeGame = useCallback(() => {
    if (!gameContainerRef.current || !LabyrinthGame || !gameLoaded) return;

    // Clean up existing game
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy();
    }

    const game = new LabyrinthGame(gameContainerRef.current, {
      difficulty: selectedDifficulty.toLowerCase(),
      seed: selectedMode === 'Tournament' ? `tournament-seed` : undefined,
    });

    // Set up callbacks
    game.onRunStart = () => {
      startGame();
    };

    game.onRunComplete = (data: { time: number; deaths: number; completed: boolean }) => {
      handleGameComplete(data.time, data.deaths, data.completed);
    };

    game.onDeath = () => {
      incrementDeaths();
    };

    game.onTimeUpdate = (time: number) => {
      updateTime(time);
    };

    gameInstanceRef.current = game;
    
    // Start the game immediately and update UI state
    startGame();
    game.start();
  }, [selectedDifficulty, selectedMode, gameLoaded, startGame, incrementDeaths, updateTime]);

  // Handle game completion
  const handleGameComplete = async (time: number, deaths: number, completed: boolean) => {
    endGame(completed, time, deaths, 1);

    if (!isRegistered || !player) {
      setShowRegistrationModal(true);
      return;
    }

    setSubmittingRun(true);
    try {
      const address = getAddress();
      if (!address) throw new Error('Wallet not connected');

      const message = `Submit run: ${selectedMode} ${selectedDifficulty} ${time}ms`;
      const signature = await signMessage(message);

      const run = await submitRun({
        walletAddress: address,
        signature,
        mode: selectedMode,
        difficulty: selectedDifficulty,
        levelReached: 1,
        timeMs: time,
        deaths,
        completed,
      });

      setLastRunXp(run.xpEarned);
      setShowGameOverModal(true);
      toast.success(`+${run.xpEarned} XP earned!`);
    } catch (error: any) {
      console.error('Submit run error:', error);
      toast.error(error.message || 'Failed to submit run');
      setShowGameOverModal(true);
    } finally {
      setSubmittingRun(false);
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

    initializeGame();
  };

  // Handle pause/resume
  const handlePauseResume = () => {
    if (!gameInstanceRef.current) return;

    if (isPaused) {
      gameInstanceRef.current.resume();
      resumeGame();
    } else {
      gameInstanceRef.current.pause();
      pauseGame();
    }
  };

  // Handle restart
  const handleRestart = () => {
    setShowGameOverModal(false);
    resetGame();
    initializeGame();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.dispose();
      }
    };
  }, []);

  if (gameEngineError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card-dungeon p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-torch-red mb-4 font-display text-lg">{gameEngineError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-gold"
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl font-bold text-gold-400 text-gold-glow mb-2"
        >
          ⚔️ The Labyrinth ⚔️
        </motion.h1>
        <p className="text-stone-400 font-body">
          Navigate the treacherous maze and prove your worth
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Game Area */}
        <div className="lg:col-span-2">
          <div className="card-dungeon overflow-hidden border-2 border-dungeon-light/30">
            {/* Torch corners */}
            <div className="absolute -top-1 -left-1 text-2xl animate-torch-flicker">🔥</div>
            <div className="absolute -top-1 -right-1 text-2xl animate-torch-flicker" style={{ animationDelay: '0.5s' }}>🔥</div>

            {/* Game Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-gold-600/30 bg-gradient-to-r from-dungeon-darker via-dungeon-dark to-dungeon-darker">
              <div className="flex items-center gap-4">
                <span className={clsx('font-display font-semibold', getDungeonDifficultyColor(selectedDifficulty))}>
                  {selectedDifficulty}
                </span>
                <span className="text-stone-600">|</span>
                <span className="text-stone-400 font-body">{selectedMode} Mode</span>
              </div>
              <div className="flex items-center gap-2">
                {isPlaying && (
                  <>
                    <button
                      onClick={handlePauseResume}
                      className="p-2 hover:bg-gold-500/20 rounded-lg transition-colors text-gold-400 hover:text-gold-300"
                      title={isPaused ? 'Resume' : 'Pause'}
                    >
                      {isPaused ? <Play size={20} /> : <Pause size={20} />}
                    </button>
                    <button
                      onClick={handleRestart}
                      className="p-2 hover:bg-gold-500/20 rounded-lg transition-colors text-gold-400 hover:text-gold-300"
                      title="Restart"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-gold-500/20 rounded-lg transition-colors text-gold-400 hover:text-gold-300"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* Game Stats Bar */}
            {isPlaying && (
              <div className="flex items-center justify-center gap-8 py-3 bg-dungeon-darker border-b border-gold-600/20">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-gold-400" />
                  <span className="font-mono text-lg text-gold-300">{formatTime(currentTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Skull size={18} className="text-torch-red" />
                  <span className="font-mono text-lg text-torch-red">{deaths}</span>
                </div>
              </div>
            )}

            {/* Game Container */}
            <div
              ref={gameContainerRef}
              className="relative aspect-square bg-gradient-to-b from-dungeon-darker to-black"
              style={{ minHeight: '400px' }}
            >
              {!isPlaying && !gameLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-gold-400/30 border-t-gold-400 rounded-full animate-spin"></div>
                    <span className="text-gold-400/60 font-body">Loading game engine...</span>
                  </div>
                </div>
              )}

              {!isPlaying && gameLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dungeon-darker/90 backdrop-blur-sm">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="text-6xl mb-4 animate-pulse">🏰</div>
                    <h2 className="font-display text-3xl font-bold mb-2 text-gold-400">
                      Ready, Adventurer?
                    </h2>
                    <p className="text-stone-400 mb-6 font-body">
                      Enter the labyrinth and face your destiny
                    </p>
                    <motion.button
                      onClick={handlePlay}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="btn-gold-filled text-lg px-8 py-4 flex items-center gap-3 mx-auto shadow-gold"
                    >
                      <Play size={24} />
                      Enter the Maze
                    </motion.button>
                  </motion.div>
                </div>
              )}

              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-dungeon-darker/90 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <div className="text-5xl mb-4">⏸️</div>
                    <h2 className="font-display text-2xl font-bold text-gold-400 mb-4">PAUSED</h2>
                    <button onClick={handlePauseResume} className="btn-gold">
                      <Play size={18} className="inline mr-2" />
                      Resume Quest
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls hint */}
            <div className="p-4 border-t border-gold-600/20 text-center text-sm text-stone-500 bg-dungeon-darker/50">
              <span className="hidden md:inline">⌨️ Use WASD or Arrow keys to tilt the maze</span>
              <span className="md:hidden">📱 Tilt your device or swipe to move</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Player Card */}
          {player && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card-gold p-5 relative overflow-hidden"
            >
              {/* Decorative torch */}
              <div className="absolute -top-2 -right-2 text-xl animate-torch-flicker">🔥</div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border-2 border-gold-300 shadow-gold">
                  <span className="text-2xl font-bold text-dungeon-darker">
                    {player.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-display font-semibold text-gold-300 text-lg">{player.username}</div>
                  <div className="text-sm text-gold-500/80 font-body flex items-center gap-1">
                    <Sparkles size={14} />
                    {player.totalXp.toLocaleString()} XP
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-dungeon-darker/50 rounded-lg p-3 border border-gold-600/20">
                  <div className="text-2xl font-display font-bold text-gold-400">
                    {player.practiceRuns}
                  </div>
                  <div className="text-xs text-stone-500">Practice Runs</div>
                </div>
                <div className="bg-dungeon-darker/50 rounded-lg p-3 border border-torch-orange/20">
                  <div className="text-2xl font-display font-bold text-torch-orange">
                    {player.tournamentRuns}
                  </div>
                  <div className="text-xs text-stone-500">Tournament Runs</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Difficulty Selection */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="card-dungeon p-5"
          >
            <h3 className="font-display font-semibold text-lg mb-4 text-gold-400 flex items-center gap-2">
              <span>⚔️</span> Choose Your Challenge
            </h3>
            <div className="space-y-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.value}
                  onClick={() => setSelectedDifficulty(diff.value)}
                  disabled={isPlaying}
                  className={clsx(
                    'w-full p-3 rounded-lg text-left transition-all group',
                    selectedDifficulty === diff.value
                      ? 'bg-gold-500/20 border-2 border-gold-500 shadow-gold'
                      : 'bg-dungeon-mid/50 border border-dungeon-light/30 hover:border-gold-500/50 hover:bg-dungeon-mid',
                    isPlaying && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{diff.icon}</span>
                    <span className={clsx('font-display font-semibold', getDungeonDifficultyColor(diff.value))}>
                      {diff.label}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1 pl-7">{diff.description}</div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* How to Play */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card-dungeon p-5"
          >
            <h3 className="font-display font-semibold text-lg mb-4 text-gold-400 flex items-center gap-2">
              <span>📜</span> Adventurer's Guide
            </h3>
            <ul className="space-y-3 text-sm text-stone-400 font-body">
              <li className="flex items-start gap-3">
                <span className="text-gold-500 font-bold">I.</span>
                <span>Tilt the maze to roll the golden orb</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold-500 font-bold">II.</span>
                <span>Navigate to the glowing portal</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold-500 font-bold">III.</span>
                <span>Beware of treacherous pits below</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold-500 font-bold">IV.</span>
                <span>Swift completion brings greater glory!</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <Modal onClose={() => setShowSettings(false)} title="⚙️ Settings">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-stone-400 mb-2 font-body">Game Mode</label>
                <select
                  className="w-full px-4 py-3 bg-dungeon-mid border border-gold-600/30 rounded-lg text-stone-300 font-body focus:border-gold-500 focus:outline-none"
                  disabled
                  value={selectedMode}
                >
                  <option value="Practice">Practice</option>
                  <option value="Tournament">Tournament (Join from Tournaments page)</option>
                </select>
              </div>
              <p className="text-sm text-stone-500 font-body">
                🔮 More settings coming soon: sound, controls, graphics quality
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegistrationModal && (
          <Modal onClose={() => setShowRegistrationModal(false)} title="📝 Register as Adventurer">
            <div className="space-y-4">
              <p className="text-stone-400 font-body">
                Choose your name to track your conquests and earn glory on-chain.
              </p>
              <input
                type="text"
                className="w-full px-4 py-3 bg-dungeon-mid border border-gold-600/30 rounded-lg text-stone-200 font-body placeholder-stone-500 focus:border-gold-500 focus:outline-none"
                placeholder="Enter your name (3-20 characters)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
              />
              <button
                onClick={handleRegister}
                disabled={registering || username.length < 3}
                className="btn-gold-filled w-full disabled:opacity-50"
              >
                {registering ? '⏳ Signing...' : '✍️ Register & Sign'}
              </button>
              <p className="text-xs text-stone-500 text-center font-body">
                🔐 You'll sign a message with your wallet to verify ownership
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOverModal && (
          <Modal onClose={() => setShowGameOverModal(false)} title="🏆 Quest Complete!">
            <div className="text-center space-y-6">
              <div className="flex justify-center gap-8">
                <div className="bg-dungeon-mid/50 rounded-lg p-4 border border-gold-600/20">
                  <Clock size={32} className="text-gold-400 mx-auto mb-2" />
                  <div className="font-mono text-2xl text-gold-300">{formatTime(currentTime)}</div>
                  <div className="text-xs text-stone-500">Time</div>
                </div>
                <div className="bg-dungeon-mid/50 rounded-lg p-4 border border-torch-red/20">
                  <Skull size={32} className="text-torch-red mx-auto mb-2" />
                  <div className="font-mono text-2xl text-torch-red">{deaths}</div>
                  <div className="text-xs text-stone-500">Deaths</div>
                </div>
              </div>

              {lastRunXp > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center gap-2 text-gold-400 bg-gold-500/10 rounded-lg py-3 border border-gold-500/30"
                >
                  <Sparkles size={24} className="animate-pulse" />
                  <span className="font-display text-3xl font-bold">+{lastRunXp} XP</span>
                  <Sparkles size={24} className="animate-pulse" />
                </motion.div>
              )}

              <div className="flex gap-4">
                <button onClick={handleRestart} className="btn-gold flex-1 flex items-center justify-center gap-2">
                  <RotateCcw size={18} />
                  Play Again
                </button>
                <button
                  onClick={() => setShowGameOverModal(false)}
                  className="btn-stone flex-1"
                >
                  Done
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Modal component with dungeon theme
function Modal({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="card-dungeon p-6 w-full max-w-md border-2 border-gold-600/30 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold-500/50"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold-500/50"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold-500/50"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold-500/50"></div>
        
        <h2 className="font-display text-xl font-bold mb-4 text-gold-400">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
