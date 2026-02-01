import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Crown, Flame, Shield, Scroll, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { getPracticeLeaderboard } from '../lib/api';
import { useWalletSigner, formatTime, formatXP } from '../lib/wallet';
import { useLineraConnection } from '../hooks';
import { lineraAdapter } from '../lib/linera';
import { LINERA_QUERIES } from '../lib/chain/config';
import type { LeaderboardEntry } from '../types';

// Blockchain leaderboard entry type
interface BlockchainLeaderboardEntry {
  walletAddress: number[];
  username: string;
  bestTimeMs: number;
  totalRuns: number;
  totalXp: number;
  rank: number;
}

// Convert wallet bytes to hex string
function bytesToHex(bytes: number[]): string {
  return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LeaderboardPage() {
  const { getAddress } = useWalletSigner();
  const { isAppConnected } = useLineraConnection();
  const currentAddress = getAddress();
  
  const [blockchainLeaderboard, setBlockchainLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [loadingBlockchain, setLoadingBlockchain] = useState(false);

  // Fetch from blockchain first when connected
  useEffect(() => {
    async function fetchBlockchainLeaderboard() {
      if (!isAppConnected) return;
      
      setLoadingBlockchain(true);
      try {
        console.log('📡 Fetching leaderboard from blockchain...');
        
        // Get active tournament first
        const tournamentResult = await lineraAdapter.query<{ activeTournament: { id: number } | null }>(
          LINERA_QUERIES.getActiveTournament
        );

        if (tournamentResult.activeTournament) {
          const tournamentId = tournamentResult.activeTournament.id;
          
          // Get leaderboard for this tournament
          const result = await lineraAdapter.query<{ leaderboard: BlockchainLeaderboardEntry[] }>(
            LINERA_QUERIES.getLeaderboard,
            { tournamentId, limit: 100 }
          );

          if (result.leaderboard && result.leaderboard.length > 0) {
            // Convert blockchain format to UI format
            const converted: LeaderboardEntry[] = result.leaderboard.map((entry, index) => ({
              rank: entry.rank || index + 1,
              walletAddress: bytesToHex(entry.walletAddress),
              username: entry.username,
              bestTimeMs: entry.bestTimeMs,
              totalRuns: entry.totalRuns,
              totalXp: entry.totalXp,
            }));
            
            setBlockchainLeaderboard(converted);
            console.log('✅ Blockchain leaderboard loaded:', converted.length, 'entries');
          }
        }
      } catch (error) {
        console.warn('Blockchain leaderboard fetch failed:', error);
      } finally {
        setLoadingBlockchain(false);
      }
    }

    fetchBlockchainLeaderboard();
  }, [isAppConnected]);

  // Backend fallback query
  const { data: backendLeaderboard, isLoading: isLoadingBackend } = useQuery({
    queryKey: ['practiceLeaderboard'],
    queryFn: () => getPracticeLeaderboard(100),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Use blockchain data if available, fallback to backend
  const leaderboard = blockchainLeaderboard || backendLeaderboard;
  const isLoading = loadingBlockchain || (!blockchainLeaderboard && isLoadingBackend);

  // Find current user's rank
  const userEntry = leaderboard?.find(
    (e) => currentAddress && e.walletAddress.toLowerCase() === currentAddress.toLowerCase()
  );

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-600/50" />
            <Crown className="text-gold-500" size={32} />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-600/50" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-400 mb-3">
            ⚔️ Hall of Champions ⚔️
          </h1>
          <p className="text-stone-400 font-body text-lg">
            The greatest adventurers who conquered the labyrinth
          </p>
        </motion.div>

        {/* User Rank Card (if on leaderboard) */}
        {userEntry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gold p-6 mb-10 max-w-2xl mx-auto relative overflow-hidden"
          >
            {/* Corner torches */}
            <div className="absolute top-3 left-3 text-torch-orange animate-torch-flicker">
              <Flame size={16} />
            </div>
            <div className="absolute top-3 right-3 text-torch-orange animate-torch-flicker" style={{ animationDelay: '0.5s' }}>
              <Flame size={16} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-600 to-gold-800 flex items-center justify-center border-2 border-gold-500 shadow-gold">
                  <span className="text-2xl font-bold font-display text-dungeon-darker">
                    #{userEntry.rank}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-stone-400 font-body">Your Standing</div>
                  <div className="font-display text-2xl font-bold text-gold-300">{userEntry.username}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl text-gold-400">
                  {userEntry.bestTimeMs > 0 ? formatTime(userEntry.bestTimeMs) : '--:--'}
                </div>
                <div className="text-sm text-torch-orange">{userEntry.totalXp.toLocaleString()} XP</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Top 3 Podium */}
        {leaderboard && leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center items-end gap-4 md:gap-6 mb-12"
          >
            {/* 2nd Place */}
            <PodiumCard entry={leaderboard[1]} position={2} />
            {/* 1st Place */}
            <PodiumCard entry={leaderboard[0]} position={1} />
            {/* 3rd Place */}
            <PodiumCard entry={leaderboard[2]} position={3} />
          </motion.div>
        )}

        {/* Full Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-dungeon overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-dungeon-dark text-sm font-semibold text-gold-500/80 border-b border-gold-800/30 font-display">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-5">Champion</div>
            <div className="col-span-2 text-right">Best Time</div>
            <div className="col-span-2 text-right">Battles</div>
            <div className="col-span-2 text-right">Experience</div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-gold-600/30 border-t-gold-500 rounded-full animate-spin mb-4" />
              <p className="text-stone-500 font-body">Retrieving champions from ancient records...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!leaderboard || leaderboard.length === 0) && (
            <div className="text-center py-12">
              <Scroll size={48} className="mx-auto mb-4 text-stone-600" />
              <p className="text-stone-500 font-body">No champions have emerged yet.</p>
              <p className="text-stone-600 text-sm mt-1">Be the first to conquer the labyrinth!</p>
            </div>
          )}

          {/* Table Body */}
          {leaderboard && leaderboard.length > 0 && (
            <div className="divide-y divide-stone-800/50">
              {leaderboard.map((entry, index) => {
                const isCurrentUser =
                  currentAddress && entry.walletAddress.toLowerCase() === currentAddress.toLowerCase();
                const rank = entry.rank;

                return (
                  <motion.div
                    key={entry.walletAddress}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={clsx(
                      'grid grid-cols-12 gap-4 p-4 items-center transition-colors',
                      isCurrentUser
                        ? 'bg-gold-900/20 border-l-2 border-gold-500'
                        : 'hover:bg-dungeon-dark/50'
                    )}
                  >
                    {/* Rank */}
                    <div className={clsx(
                      'col-span-1 text-center font-display font-bold',
                      rank === 1 && 'text-gold-400',
                      rank === 2 && 'text-stone-300',
                      rank === 3 && 'text-amber-600',
                      rank > 3 && 'text-stone-500'
                    )}>
                      {rank <= 3 ? (
                        <span className="text-lg">{rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}</span>
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    {/* Player */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border',
                        rank === 1 && 'bg-gradient-to-br from-gold-600 to-gold-800 border-gold-500',
                        rank === 2 && 'bg-gradient-to-br from-stone-400 to-stone-600 border-stone-300',
                        rank === 3 && 'bg-gradient-to-br from-amber-600 to-amber-800 border-amber-500',
                        rank > 3 && 'bg-dungeon-mid border-stone-700'
                      )}>
                        <span className={clsx(
                          'text-sm font-bold font-display',
                          rank <= 3 ? 'text-dungeon-darker' : 'text-stone-400'
                        )}>
                          {entry.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-stone-200 truncate font-body">
                          {entry.username}
                          {isCurrentUser && (
                            <span className="text-gold-400 ml-2 text-sm">(You)</span>
                          )}
                        </div>
                        <div className="text-xs text-stone-600 font-mono truncate">
                          {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                        </div>
                      </div>
                    </div>

                    {/* Best Time */}
                    <div className="col-span-2 text-right">
                      <span className="font-mono text-gold-400">
                        {entry.bestTimeMs > 0 ? formatTime(entry.bestTimeMs) : '--:--'}
                      </span>
                    </div>

                    {/* Runs */}
                    <div className="col-span-2 text-right text-stone-400 font-body">{entry.totalRuns}</div>

                    {/* XP */}
                    <div className="col-span-2 text-right">
                      <span className="text-torch-orange font-semibold">{formatXP(entry.totalXp)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Bottom decorative element */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-3 mt-10"
        >
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-gold-600/30" />
          <Shield className="text-gold-600/40" size={20} />
          <div className="h-px w-20 bg-gradient-to-l from-transparent to-gold-600/30" />
        </motion.div>
      </div>
    </div>
  );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const config = {
    1: {
      height: 'h-36',
      bg: 'from-gold-600 via-gold-500 to-gold-700',
      border: 'border-gold-400',
      glow: 'shadow-gold',
      icon: '👑',
      iconSize: 'text-4xl',
      textColor: 'text-gold-400',
    },
    2: {
      height: 'h-28',
      bg: 'from-stone-400 via-stone-300 to-stone-500',
      border: 'border-stone-300',
      glow: '',
      icon: '🥈',
      iconSize: 'text-3xl',
      textColor: 'text-stone-300',
    },
    3: {
      height: 'h-24',
      bg: 'from-amber-700 via-amber-600 to-amber-800',
      border: 'border-amber-500',
      glow: '',
      icon: '🥉',
      iconSize: 'text-3xl',
      textColor: 'text-amber-500',
    },
  }[position];

  return (
    <div className={clsx(
      'text-center', 
      position === 1 ? 'order-2' : position === 2 ? 'order-1' : 'order-3'
    )}>
      {/* Avatar & Info */}
      <motion.div 
        className="mb-3"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: position === 1 ? 0.2 : position === 2 ? 0.3 : 0.4 }}
      >
        <div
          className={clsx(
            'mx-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br flex items-center justify-center border-2',
            config.bg,
            config.border,
            config.glow
          )}
        >
          <span className="text-2xl md:text-3xl font-bold font-display text-dungeon-darker">
            {entry.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className={clsx('font-semibold mt-2 truncate max-w-24 md:max-w-28 font-display', config.textColor)}>
          {entry.username}
        </div>
        <div className="font-mono text-sm text-gold-400/80">
          {entry.bestTimeMs > 0 ? formatTime(entry.bestTimeMs) : '--:--'}
        </div>
        <div className="text-xs text-torch-orange">{entry.totalXp.toLocaleString()} XP</div>
      </motion.div>

      {/* Podium */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: 'auto' }}
        transition={{ delay: position === 1 ? 0.1 : position === 2 ? 0.15 : 0.2, duration: 0.4 }}
        className={clsx(
          'w-24 md:w-28 rounded-t-lg flex items-center justify-center',
          config.height,
          'bg-gradient-to-t',
          config.bg,
          'border-t-2 border-x-2',
          config.border
        )}
      >
        <span className={config.iconSize}>{config.icon}</span>
      </motion.div>
    </div>
  );
}
