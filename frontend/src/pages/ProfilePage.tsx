import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDynamicContext, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { Trophy, Gamepad2, Clock, ExternalLink, History, RefreshCw, Flame, Shield, Sword, Crown, Scroll, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { getPlayerRuns } from '../lib/api';
import { formatTime, formatXP, formatRelativeTime, calculateLevel, formatAddress } from '../lib/wallet';
import { useGameStore } from '../stores/gameStore';
import { useLabyrinth } from '../hooks';
import type { GameRun, Player as AppPlayer } from '../types';

export default function ProfilePage() {
  const { primaryWallet } = useDynamicContext();
  const { setPlayer: setGlobalPlayer } = useGameStore();
  
  // Use the new useLabyrinth hook (like Linera-Arcade's useArcade)
  const { 
    player: labyrinthPlayer,
    isRegistered,
    isLoading,
    isConnecting,
    isAppConnected,
    error,
    chainId,
    refreshPlayer,
  } = useLabyrinth();

  const walletAddress = primaryWallet?.address;

  // Sync labyrinth player to global store
  useEffect(() => {
    if (labyrinthPlayer) {
      const appPlayer: AppPlayer = {
        walletAddress: labyrinthPlayer.owner,
        username: labyrinthPlayer.username,
        totalXp: labyrinthPlayer.totalXp || 0,
        practiceRuns: labyrinthPlayer.practiceRuns || 0,
        tournamentRuns: labyrinthPlayer.tournamentRuns || 0,
        tournamentsPlayed: labyrinthPlayer.tournamentsPlayed || 0,
        tournamentsWon: labyrinthPlayer.tournamentsWon || 0,
        registeredAt: labyrinthPlayer.registeredAt 
          ? new Date(labyrinthPlayer.registeredAt).toISOString() 
          : new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      setGlobalPlayer(appPlayer);
    }
  }, [labyrinthPlayer, setGlobalPlayer]);

  // Fetch recent runs from backend
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['playerRuns', walletAddress],
    queryFn: () => getPlayerRuns(walletAddress!, 20),
    enabled: !!walletAddress && isRegistered,
  });

  // Create display player from labyrinth hook data
  const displayPlayer = labyrinthPlayer ? {
    walletAddress: labyrinthPlayer.owner,
    username: labyrinthPlayer.username,
    totalXp: labyrinthPlayer.totalXp || 0,
    practiceRuns: labyrinthPlayer.practiceRuns || 0,
    tournamentRuns: labyrinthPlayer.tournamentRuns || 0,
    tournamentsPlayed: labyrinthPlayer.tournamentsPlayed || 0,
    tournamentsWon: labyrinthPlayer.tournamentsWon || 0,
    bestPracticeTimeMs: 0,
    discordTag: undefined,
    registeredAt: labyrinthPlayer.registeredAt 
      ? new Date(labyrinthPlayer.registeredAt).toISOString() 
      : new Date().toISOString(),
    lastActive: new Date().toISOString(),
  } : null;

  // Not connected state
  if (!primaryWallet) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-dungeon p-8 relative overflow-hidden"
            >
              {/* Decorative torch corners */}
              <div className="absolute top-4 left-4 text-torch-orange animate-torch-flicker">
                <Flame size={24} />
              </div>
              <div className="absolute top-4 right-4 text-torch-orange animate-torch-flicker" style={{ animationDelay: '0.5s' }}>
                <Flame size={24} />
              </div>

              <div className="w-24 h-24 mx-auto rounded-full bg-dungeon-mid border-4 border-gold-600/30 flex items-center justify-center mb-6">
                <Shield size={48} className="text-gold-500" />
              </div>
              
              <h1 className="font-display text-3xl font-bold text-gold-400 mb-3">
                ⚔️ Connect Your Wallet ⚔️
              </h1>
              <p className="text-stone-400 mb-6 font-body">
                Link your wallet to access your adventurer profile, battle records, and legendary achievements.
              </p>
              
              <div className="flex justify-center">
                <DynamicWidget />
              </div>
              
              {/* Bottom decorative line */}
              <div className="mt-8 flex items-center justify-center gap-2">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-600/50" />
                <Crown size={16} className="text-gold-600/50" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-600/50" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !displayPlayer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full border-4 border-gold-600/30 border-t-gold-500 animate-spin mx-auto" />
            <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-torch-orange animate-torch-flicker" size={32} />
          </div>
          <p className="text-gold-400 font-display text-lg">
            Summoning your profile from the blockchain...
          </p>
          <p className="text-stone-500 text-sm mt-2 font-body">
            The ancient records are being retrieved
          </p>
        </motion.div>
      </div>
    );
  }

  // Connecting to Conway state - show while wallet is connected but Linera is still connecting
  if (primaryWallet && (isConnecting || !isAppConnected) && !displayPlayer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-dungeon-darker via-dungeon-dark to-dungeon-darker">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-md mx-auto px-6"
        >
          {/* Animated Chain Icon */}
          <div className="relative mb-8">
            {/* Outer rotating ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 mx-auto"
            >
              <div className="w-full h-full rounded-full border-4 border-gold-600/20 border-t-gold-500 border-r-gold-400/50" />
            </motion.div>
            
            {/* Inner pulsing glow */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-500/20 to-torch-orange/20 blur-md" />
            </motion.div>
            
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Shield className="w-12 h-12 text-gold-500" />
              </motion.div>
            </div>
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gold-400 mb-3">
            Connecting to Linera Conway
          </h2>
          
          {/* Subtitle */}
          <p className="text-stone-400 font-body mb-2">
            Establishing secure blockchain connection
          </p>
          
          {/* Status steps */}
          <div className="mt-6 space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-3 text-sm"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-stone-400">Wallet connected</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-3 text-sm"
            >
              <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
              <span className="text-gold-400">Claiming your chain...</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-3 text-sm"
            >
              <div className="w-2 h-2 rounded-full bg-stone-600" />
              <span className="text-stone-600">Loading profile</span>
            </motion.div>
          </div>

          {/* Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-stone-600 text-xs mt-6 font-body"
          >
            You may need to sign a message to claim your blockchain identity
          </motion.p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-900/30 border border-red-500/40 rounded-xl"
            >
              <p className="text-red-400 text-sm font-body">{error}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // Not registered state
  if (!isLoading && !isRegistered) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-dungeon p-8 relative overflow-hidden"
            >
              {/* Decorative torches */}
              <div className="absolute top-4 left-4 text-torch-orange animate-torch-flicker">
                <Flame size={24} />
              </div>
              <div className="absolute top-4 right-4 text-torch-orange animate-torch-flicker" style={{ animationDelay: '0.5s' }}>
                <Flame size={24} />
              </div>

              <div className="w-24 h-24 mx-auto rounded-full bg-dungeon-mid border-4 border-stone-600/30 flex items-center justify-center mb-6">
                <Scroll size={48} className="text-stone-500" />
              </div>
              
              <h1 className="font-display text-3xl font-bold text-gold-400 mb-3">
                🗡️ Unregistered Adventurer 🗡️
              </h1>
              <p className="text-stone-400 mb-6 font-body">
                Your name has not yet been inscribed in the Hall of Legends. Begin your first quest to create your adventurer profile!
              </p>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <Link to="/play" className="btn-gold-filled w-full flex items-center justify-center gap-2">
                  <Sword size={18} />
                  Begin Your Quest
                </Link>
                {isAppConnected && (
                  <button
                    onClick={() => refreshPlayer()}
                    className="btn-stone w-full flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Search Ancient Records
                  </button>
                )}
              </div>
              
              {/* Bottom decorative line */}
              <div className="mt-8 flex items-center justify-center gap-2">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-600/50" />
                <Sword size={14} className="text-gold-600/50" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-600/50" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!displayPlayer) return null;

  const levelInfo = calculateLevel(displayPlayer.totalXp);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-4xl font-bold text-gold-400 mb-2">
            ⚔️ Adventurer Profile ⚔️
          </h1>
          <p className="text-stone-400 font-body">Your legendary journey through the labyrinth</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="card-gold p-6 text-center relative overflow-hidden">
              {/* Corner torches */}
              <div className="absolute top-3 left-3 text-torch-orange animate-torch-flicker">
                <Flame size={18} />
              </div>
              <div className="absolute top-3 right-3 text-torch-orange animate-torch-flicker" style={{ animationDelay: '0.3s' }}>
                <Flame size={18} />
              </div>

              {/* Avatar */}
              <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-gold-600 to-gold-800 p-1 mb-4 shadow-gold">
                <div className="w-full h-full rounded-full bg-dungeon-dark flex items-center justify-center border-2 border-gold-700/50">
                  <span className="text-5xl font-display font-bold text-gold-400 text-shimmer">
                    {displayPlayer.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Username */}
              <h2 className="font-display text-2xl font-bold text-gold-300 mb-1">
                {displayPlayer.username}
              </h2>
              <p className="text-stone-500 text-sm mb-4 font-mono">
                {formatAddress(displayPlayer.walletAddress)}
              </p>

              {/* Level Badge */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Crown className="text-gold-500" size={22} />
                  <span className="font-display text-2xl font-bold text-gold-400">
                    Level {levelInfo.level}
                  </span>
                </div>
                
                {/* XP Progress Bar */}
                <div className="relative">
                  <div className="w-full h-3 bg-dungeon-darker rounded-full overflow-hidden border border-gold-800/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${levelInfo.progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-gold-700 via-gold-500 to-gold-600"
                    />
                  </div>
                  <p className="text-xs text-stone-500 mt-2 font-body">
                    {levelInfo.nextLevelXp.toLocaleString()} XP to next level
                  </p>
                </div>
              </div>

              {/* Total XP */}
              <div className="p-4 bg-dungeon-darker rounded-lg border border-gold-800/30 mb-4">
                <div className="font-display text-3xl font-bold text-gold-400">
                  {formatXP(displayPlayer.totalXp)}
                </div>
                <div className="text-sm text-stone-500 font-body">Total Experience</div>
              </div>

              {/* Discord */}
              {displayPlayer.discordTag && (
                <div className="p-3 bg-dungeon-darker rounded-lg border border-stone-700/30 flex items-center justify-center gap-2 mb-4">
                  <span className="text-sm text-stone-400">Discord:</span>
                  <span className="text-gold-300 font-medium">{displayPlayer.discordTag}</span>
                </div>
              )}

              {/* Member Since */}
              <div className="flex items-center justify-center gap-2 text-stone-500 text-sm mb-4">
                <Scroll size={14} />
                <span>Joined {new Date(displayPlayer.registeredAt).toLocaleDateString()}</span>
              </div>

              {/* Connection Status */}
              <div className="p-3 bg-dungeon-darker rounded-lg border border-stone-700/30">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Flame 
                    size={14} 
                    className={clsx(
                      isAppConnected ? 'text-torch-orange animate-torch-flicker' : 'text-stone-600'
                    )} 
                  />
                  <span className={clsx(
                    'text-xs font-body',
                    isAppConnected ? 'text-gold-400' : 'text-stone-500'
                  )}>
                    {isAppConnected ? 'Connected to Linera Conway' : 'Connecting to realm...'}
                  </span>
                </div>
                
                {chainId && (
                  <p className="text-stone-600 text-xs font-mono truncate mb-2">
                    Chain: {chainId.slice(0, 8)}...{chainId.slice(-6)}
                  </p>
                )}
                
                {error && (
                  <p className="text-red-400 text-xs mb-2">{error}</p>
                )}
                
                <button
                  onClick={() => refreshPlayer()}
                  disabled={isLoading}
                  className="text-xs text-gold-500 hover:text-gold-400 flex items-center justify-center gap-1 w-full transition-colors"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                  {isLoading ? 'Refreshing...' : 'Refresh from blockchain'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Stats & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Shield className="text-gold-500" size={24} />
                <h2 className="font-display text-2xl font-bold text-gold-400">Battle Statistics</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Gamepad2}
                  value={displayPlayer.practiceRuns}
                  label="Training Sessions"
                  color="gold"
                />
                <StatCard
                  icon={Sword}
                  value={displayPlayer.tournamentRuns}
                  label="Tournament Battles"
                  color="torch"
                />
                <StatCard
                  icon={Crown}
                  value={displayPlayer.tournamentsWon}
                  label="Victories"
                  color="gold"
                />
                <StatCard
                  icon={Clock}
                  value={displayPlayer.bestPracticeTimeMs ? formatTime(displayPlayer.bestPracticeTimeMs) : '--'}
                  label="Fastest Escape"
                  color="stone"
                  isString
                />
              </div>
            </motion.div>

            {/* Tournament Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-dungeon p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Trophy className="text-gold-500" size={24} />
                  <h2 className="font-display text-xl font-bold text-gold-400">Tournament Glory</h2>
                </div>
                <Link to="/tournaments" className="text-sm text-gold-500 hover:text-gold-400 flex items-center gap-1 transition-colors">
                  View All <ExternalLink size={14} />
                </Link>
              </div>
              
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="p-4 bg-dungeon-darker rounded-lg border border-stone-700/30">
                  <div className="font-display text-3xl font-bold text-stone-300">
                    {displayPlayer.tournamentsPlayed}
                  </div>
                  <div className="text-sm text-stone-500 font-body">Tournaments Entered</div>
                </div>
                <div className="p-4 bg-dungeon-darker rounded-lg border border-gold-700/30">
                  <div className="font-display text-3xl font-bold text-gold-400">
                    {displayPlayer.tournamentsWon}
                  </div>
                  <div className="text-sm text-stone-500 font-body">Championships Won</div>
                </div>
                <div className="p-4 bg-dungeon-darker rounded-lg border border-torch-orange/30">
                  <div className="font-display text-3xl font-bold text-torch-orange">
                    {displayPlayer.tournamentsPlayed > 0
                      ? Math.round((displayPlayer.tournamentsWon / displayPlayer.tournamentsPlayed) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-stone-500 font-body">Victory Rate</div>
                </div>
              </div>
            </motion.div>

            {/* Recent Runs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card-dungeon p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <History className="text-gold-500" size={24} />
                <h2 className="font-display text-xl font-bold text-gold-400">Recent Expeditions</h2>
              </div>

              {runsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-gold-600/30 border-t-gold-500 rounded-full animate-spin" />
                </div>
              ) : !runs || runs.length === 0 ? (
                <div className="text-center py-8">
                  <Scroll size={48} className="mx-auto text-stone-600 mb-3" />
                  <p className="text-stone-500 font-body">No expeditions recorded yet.</p>
                  <Link to="/play" className="text-gold-500 hover:text-gold-400 text-sm mt-2 inline-block">
                    Begin your first adventure →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <RunHistoryItem key={run.id} run={run} />
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  isString = false,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  color: 'gold' | 'torch' | 'stone';
  isString?: boolean;
}) {
  const colorClasses = {
    gold: {
      border: 'border-gold-700/40',
      icon: 'text-gold-500',
      value: 'text-gold-400',
    },
    torch: {
      border: 'border-torch-orange/40',
      icon: 'text-torch-orange',
      value: 'text-torch-orange',
    },
    stone: {
      border: 'border-stone-600/40',
      icon: 'text-stone-400',
      value: 'text-stone-300',
    },
  };

  const styles = colorClasses[color];

  return (
    <div className={`card-dungeon p-4 border ${styles.border} hover:border-gold-600/50 transition-colors`}>
      <Icon className={`w-6 h-6 mb-2 ${styles.icon}`} />
      <div className={`font-display text-2xl font-bold ${styles.value}`}>
        {isString ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-stone-500 font-body">{label}</div>
    </div>
  );
}

function RunHistoryItem({ run }: { run: GameRun }) {
  const isTournament = run.mode === 'Tournament';
  
  return (
    <div className="flex items-center justify-between p-3 bg-dungeon-darker rounded-lg border border-stone-700/20 hover:border-gold-700/30 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center border',
            isTournament 
              ? 'bg-gold-900/30 border-gold-700/30' 
              : 'bg-dungeon-mid border-stone-700/30'
          )}
        >
          {isTournament ? (
            <Trophy size={18} className="text-gold-500" />
          ) : (
            <Sword size={18} className="text-stone-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={clsx(
              'text-sm font-medium',
              run.difficulty === 'Easy' && 'text-green-400',
              run.difficulty === 'Medium' && 'text-gold-400',
              run.difficulty === 'Hard' && 'text-torch-orange',
              run.difficulty === 'Nightmare' && 'text-red-400',
            )}>
              {run.difficulty}
            </span>
            <span className="text-stone-600">•</span>
            <span className="text-stone-400 text-sm font-body">
              {run.completed ? '✓ Escaped' : `Level ${run.levelReached}`}
            </span>
          </div>
          <div className="text-xs text-stone-600 font-body">{formatRelativeTime(run.createdAt)}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-gold-400 text-sm">{formatTime(run.timeMs)}</div>
        <div className="text-xs text-torch-orange">+{run.xpEarned} XP</div>
      </div>
    </div>
  );
}
