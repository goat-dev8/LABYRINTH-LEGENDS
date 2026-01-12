import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import {
  Trophy,
  Users,
  Clock,
  ArrowLeft,
  Play,
  Flame,
  Sword,
  Crown,
  Shield,
  Scroll,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import { getTournament, joinTournament, claimTournamentReward } from '../lib/api';
import { useWalletSigner, formatTime, formatDate } from '../lib/wallet';
import { useSocketStore } from '../stores/socketStore';
import type { LeaderboardEntry } from '../types';

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { primaryWallet } = useDynamicContext();
  const { signMessage, getAddress } = useWalletSigner();
  const queryClient = useQueryClient();
  const { joinTournament: joinSocket, leaveTournament: leaveSocket, setOnLeaderboardUpdate } = useSocketStore();

  const tournamentId = parseInt(id || '0');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
    enabled: !!tournamentId,
  });

  const tournament = data?.tournament;
  const leaderboard = data?.leaderboard || [];

  const [isParticipant, setIsParticipant] = useState(false);
  const [hasReward, setHasReward] = useState(false);

  useEffect(() => {
    const address = getAddress();
    if (address && leaderboard.length > 0) {
      setIsParticipant(leaderboard.some((e) => e.walletAddress.toLowerCase() === address.toLowerCase()));
    }
  }, [leaderboard, getAddress]);

  useEffect(() => {
    if (tournamentId) {
      joinSocket(tournamentId);

      setOnLeaderboardUpdate((event) => {
        if (event.tournamentId === tournamentId) {
          queryClient.setQueryData(['tournament', tournamentId], (old: any) => ({
            ...old,
            leaderboard: event.leaderboard,
          }));
        }
      });

      return () => {
        leaveSocket(tournamentId);
      };
    }
  }, [tournamentId, joinSocket, leaveSocket, setOnLeaderboardUpdate, queryClient]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const address = getAddress();
      if (!address) throw new Error('Wallet not connected');
      if (!tournament) throw new Error('Tournament not found');

      const message = `Join tournament: ${tournament.title}`;
      const signature = await signMessage(message);

      return joinTournament(tournamentId, address, signature);
    },
    onSuccess: (data) => {
      toast.success('Joined the battle! May glory be yours!');
      setIsParticipant(true);
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      navigate(`/play?tournament=${tournamentId}&seed=${data.mazeSeed}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to join tournament');
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const address = getAddress();
      if (!address) throw new Error('Wallet not connected');

      const message = `Claim reward for tournament ${tournamentId}`;
      const signature = await signMessage(message);

      return claimTournamentReward(tournamentId, address, signature);
    },
    onSuccess: (reward) => {
      toast.success(`Claimed ${reward.xpAmount} XP! Your legend grows!`);
      setHasReward(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to claim reward');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-gold-600/30 border-t-gold-500 rounded-full animate-spin mb-4" />
        <p className="text-stone-500 font-body">Summoning tournament details...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-dungeon p-12 text-center max-w-lg mx-auto"
          >
            <Scroll size={56} className="mx-auto text-stone-600 mb-4" />
            <h2 className="text-2xl font-display font-semibold text-gold-400 mb-4">Tournament Not Found</h2>
            <p className="text-stone-500 font-body mb-6">This arena has been lost to the ages...</p>
            <Link to="/tournaments" className="btn-gold inline-flex items-center gap-2">
              <ArrowLeft size={18} />
              Return to Arena List
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const startDate = new Date(tournament.startTime);
  const endDate = new Date(tournament.endTime);
  const now = new Date();

  const getTimeInfo = () => {
    if (tournament.status === 'Upcoming') {
      const diff = startDate.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return { label: 'Battle begins in', value: `${hours}h` };
    }
    if (tournament.status === 'Active') {
      const diff = endDate.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return { label: 'Time remaining', value: `${hours}h` };
    }
    return { label: 'Concluded', value: formatDate(tournament.endTime) };
  };

  const timeInfo = getTimeInfo();

  const getDifficultyStyle = (diff: string) => {
    switch(diff) {
      case 'Easy': return 'text-green-400';
      case 'Medium': return 'text-gold-400';
      case 'Hard': return 'text-torch-orange';
      case 'Nightmare': return 'text-red-400';
      default: return 'text-stone-400';
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-gold-400 mb-6 transition-colors font-body"
          >
            <ArrowLeft size={20} />
            Return to Arena
          </Link>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-dungeon p-6 relative overflow-hidden"
            >
              {/* Corner torches */}
              <div className="absolute top-4 left-4 text-torch-orange animate-torch-flicker">
                <Flame size={20} />
              </div>
              <div className="absolute top-4 right-4 text-torch-orange animate-torch-flicker" style={{ animationDelay: '0.5s' }}>
                <Flame size={20} />
              </div>

              <div className="flex flex-wrap items-start justify-between gap-4 mb-4 pt-4">
                <div>
                  <span
                    className={clsx(
                      'px-3 py-1 text-sm font-semibold rounded-full mb-3 inline-flex items-center gap-1 border',
                      tournament.status === 'Active' && 'bg-green-900/30 text-green-400 border-green-600/30',
                      tournament.status === 'Upcoming' && 'bg-gold-900/30 text-gold-400 border-gold-600/30',
                      tournament.status === 'Ended' && 'bg-dungeon-mid text-stone-500 border-stone-700/30'
                    )}
                  >
                    {tournament.status === 'Active' ? <Sword size={14} /> : tournament.status === 'Upcoming' ? <Clock size={14} /> : <Trophy size={14} />}
                    {tournament.status}
                  </span>
                  <h1 className="font-display text-3xl font-bold text-gold-400">{tournament.title}</h1>
                </div>
                <span className={clsx('text-xl font-display font-bold', getDifficultyStyle(tournament.difficulty))}>
                  {tournament.difficulty}
                </span>
              </div>

              <p className="text-stone-400 mb-6 font-body">
                {tournament.description || 'A treacherous labyrinth awaits those brave enough to enter...'}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-dungeon-darker rounded-lg border border-stone-700/30">
                  <Users className="w-6 h-6 mx-auto mb-2 text-gold-500" />
                  <div className="font-display text-2xl font-bold text-stone-200">
                    {tournament.participantCount}
                  </div>
                  <div className="text-xs text-stone-500 font-body">Warriors</div>
                </div>
                <div className="text-center p-4 bg-dungeon-darker rounded-lg border border-gold-700/30">
                  <Trophy className="w-6 h-6 mx-auto mb-2 text-gold-500" />
                  <div className="font-display text-2xl font-bold text-gold-400">
                    {tournament.xpRewardPool.toLocaleString()}
                  </div>
                  <div className="text-xs text-stone-500 font-body">XP Pool</div>
                </div>
                <div className="text-center p-4 bg-dungeon-darker rounded-lg border border-torch-orange/30">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-torch-orange" />
                  <div className="font-display text-2xl font-bold text-stone-200">{timeInfo.value}</div>
                  <div className="text-xs text-stone-500 font-body">{timeInfo.label}</div>
                </div>
                <div className="text-center p-4 bg-dungeon-darker rounded-lg border border-stone-700/30">
                  <Target className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                  <div className="font-display text-2xl font-bold text-stone-200">
                    {tournament.maxAttemptsPerPlayer || '∞'}
                  </div>
                  <div className="text-xs text-stone-500 font-body">Attempts</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap gap-4">
                {tournament.status === 'Active' && primaryWallet && !isParticipant && (
                  <button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="btn-gold-filled flex items-center gap-2"
                  >
                    <Sword size={18} />
                    {joinMutation.isPending ? 'Entering Arena...' : 'Enter Battle'}
                  </button>
                )}

                {tournament.status === 'Active' && isParticipant && (
                  <Link
                    to={`/play?tournament=${tournamentId}&seed=${tournament.mazeSeed}`}
                    className="btn-gold-filled flex items-center gap-2"
                  >
                    <Play size={18} />
                    Continue Quest
                  </Link>
                )}

                {tournament.status === 'Ended' && hasReward && (
                  <button
                    onClick={() => claimMutation.mutate()}
                    disabled={claimMutation.isPending}
                    className="btn-gold-filled flex items-center gap-2"
                  >
                    <Crown size={18} />
                    {claimMutation.isPending ? 'Claiming...' : 'Claim Victory Reward'}
                  </button>
                )}

                {!primaryWallet && (
                  <p className="text-stone-500 font-body">Connect your wallet to join the battle</p>
                )}
              </div>
            </motion.div>

            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-dungeon p-6"
            >
              <h2 className="font-display text-xl font-bold text-gold-400 mb-4 flex items-center gap-2">
                <Crown className="text-gold-500" />
                Champions Leaderboard
              </h2>

              {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Shield size={48} className="mx-auto text-stone-600 mb-3" />
                  <p className="text-stone-500 font-body">No champions have emerged yet.</p>
                  <p className="text-stone-600 text-sm mt-1">Be the first to conquer this labyrinth!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <LeaderboardRow
                      key={entry.walletAddress}
                      entry={entry}
                      isCurrentUser={
                        getAddress()?.toLowerCase() === entry.walletAddress.toLowerCase()
                      }
                      index={index}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Prize Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-gold p-5"
            >
              <h3 className="font-display font-semibold text-lg mb-4 text-gold-400 flex items-center gap-2">
                <Trophy size={18} />
                Prize Distribution
              </h3>
              <div className="space-y-3">
                {[
                  { rank: 1, emoji: '👑', pct: 30, color: 'text-gold-400' },
                  { rank: 2, emoji: '🥈', pct: 20, color: 'text-stone-300' },
                  { rank: 3, emoji: '🥉', pct: 10, color: 'text-amber-600' },
                  { rank: '4-10', emoji: '🏅', pct: 40 / 7, color: 'text-stone-500' },
                ].map((prize, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{prize.emoji}</span>
                      <span className={clsx('font-body', prize.color)}>
                        {typeof prize.rank === 'number' ? `#${prize.rank}` : prize.rank}
                      </span>
                    </div>
                    <span className="font-display font-semibold text-gold-400">
                      {Math.floor((tournament.xpRewardPool * prize.pct) / 100).toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tournament Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-dungeon p-5"
            >
              <h3 className="font-display font-semibold text-lg mb-4 text-gold-400 flex items-center gap-2">
                <Scroll size={18} />
                Battle Details
              </h3>
              <dl className="space-y-3 text-sm font-body">
                <div className="flex justify-between">
                  <dt className="text-stone-500">Start</dt>
                  <dd className="text-stone-300">{formatDate(tournament.startTime)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">End</dt>
                  <dd className="text-stone-300">{formatDate(tournament.endTime)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Labyrinth Size</dt>
                  <dd className="text-stone-300">
                    {tournament.difficulty === 'Easy' && '6×6'}
                    {tournament.difficulty === 'Medium' && '10×10'}
                    {tournament.difficulty === 'Hard' && '15×15'}
                    {tournament.difficulty === 'Nightmare' && '20×20'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Max Attempts</dt>
                  <dd className="text-stone-300">{tournament.maxAttemptsPerPlayer || 'Unlimited'}</dd>
                </div>
              </dl>
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card-dungeon p-5"
            >
              <h3 className="font-display font-semibold text-lg mb-4 text-gold-400 flex items-center gap-2">
                <Shield size={18} />
                Warrior's Guide
              </h3>
              <ul className="space-y-2 text-sm text-stone-400 font-body">
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">⚔️</span>
                  All warriors face the same labyrinth
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">🏃</span>
                  Fastest escape time claims victory
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">💀</span>
                  Deaths are forgiven, only speed matters
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-600">🎯</span>
                  Practice the difficulty level first
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  index,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  index: number;
}) {
  const rank = entry.rank;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={clsx(
        'flex items-center justify-between p-3 rounded-lg transition-colors border',
        isCurrentUser 
          ? 'bg-gold-900/20 border-gold-600/30' 
          : 'bg-dungeon-darker border-stone-700/20 hover:border-gold-700/30'
      )}
    >
      <div className="flex items-center gap-3">
        <span className={clsx(
          'font-display font-bold w-10 text-center',
          rank === 1 && 'text-gold-400',
          rank === 2 && 'text-stone-300',
          rank === 3 && 'text-amber-600',
          rank > 3 && 'text-stone-500'
        )}>
          {rank <= 3 ? ['👑', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </span>
        <div>
          <div className="font-medium text-stone-200 font-body">
            {entry.username}
            {isCurrentUser && <span className="text-gold-400 ml-2">(You)</span>}
          </div>
          <div className="text-xs text-stone-600 font-body">{entry.totalRuns} attempts</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-lg text-gold-400">{formatTime(entry.bestTimeMs)}</div>
        <div className="text-xs text-torch-orange">{entry.totalXp.toLocaleString()} XP</div>
      </div>
    </motion.div>
  );
}
