import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Trophy, Star, Flame, Target, Clock, Skull, 
  Award, TrendingUp, Calendar, Crown, Shield, Coins
} from 'lucide-react';
import clsx from 'clsx';

import { useWalletSigner } from '../lib/wallet';
import { 
  getLevelTitle,
  ACHIEVEMENTS,
} from '../config/gameConfig';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchPlayerStats(wallet: string) {
  const res = await fetch(`${API_BASE}/api/players/${wallet}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  const json = await res.json();
  return json.data;
}

async function fetchPlayerAchievements(wallet: string) {
  const res = await fetch(`${API_BASE}/api/players/${wallet}/achievements`);
  if (!res.ok) throw new Error('Failed to fetch achievements');
  const json = await res.json();
  return json.data;
}

async function fetchDailyChallenges() {
  const res = await fetch(`${API_BASE}/api/challenges/daily`);
  if (!res.ok) throw new Error('Failed to fetch challenges');
  const json = await res.json();
  return json.data;
}

export default function StatsPage() {
  const { getAddress } = useWalletSigner();
  const walletAddress = getAddress();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['playerStats', walletAddress],
    queryFn: () => fetchPlayerStats(walletAddress!),
    enabled: !!walletAddress,
  });

  const { data: achievements } = useQuery({
    queryKey: ['playerAchievements', walletAddress],
    queryFn: () => fetchPlayerAchievements(walletAddress!),
    enabled: !!walletAddress,
  });

  const { data: challenges } = useQuery({
    queryKey: ['dailyChallenges'],
    queryFn: fetchDailyChallenges,
  });

  if (!walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-dungeon p-8 text-center">
          <Shield className="mx-auto mb-4 text-gold-500" size={48} />
          <h2 className="font-display text-2xl text-gold-400 mb-2">Connect Wallet</h2>
          <p className="text-stone-400">Connect your wallet to view your stats</p>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold-600/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-400 mb-2">
            ⚔️ Battle Statistics ⚔️
          </h1>
          <p className="text-stone-400 font-body">Your journey through the labyrinth</p>
        </motion.div>

        {/* Level Progress Card */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gold p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Level Badge */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-600 to-gold-800 flex items-center justify-center border-4 border-gold-500 shadow-gold">
                  <span className="text-3xl font-bold font-display text-dungeon-darker">
                    {stats.level}
                  </span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-dungeon-darker px-3 py-1 rounded-full border border-gold-600">
                  <span className="text-xs text-gold-400 font-display whitespace-nowrap">
                    {getLevelTitle(stats.level)}
                  </span>
                </div>
              </div>

              {/* XP Progress */}
              <div className="flex-1 w-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-stone-400 font-body">Level Progress</span>
                  <span className="text-gold-400 font-mono">
                    {stats.xpProgress.toLocaleString()} / {stats.xpRequired.toLocaleString()} XP
                  </span>
                </div>
                <div className="h-4 bg-dungeon-dark rounded-full overflow-hidden border border-gold-800/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.xpPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-gold-600 to-gold-400"
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-stone-500 text-sm">Level {stats.level}</span>
                  <span className="text-torch-orange font-semibold">
                    {stats.totalXp.toLocaleString()} Total XP
                  </span>
                  <span className="text-stone-500 text-sm">Level {stats.level + 1}</span>
                </div>
              </div>

              {/* Division Badge */}
              <div className="text-center">
                <div className="text-4xl mb-1">{stats.divisionIcon}</div>
                <div className="text-gold-400 font-display">{stats.division}</div>
                <div className="text-stone-500 text-sm">{stats.elo} ELO</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<Target className="text-gold-500" />} 
            label="Total Runs" 
            value={stats?.totalRuns || 0} 
          />
          <StatCard 
            icon={<Trophy className="text-gold-500" />} 
            label="Perfect Runs" 
            value={stats?.perfectRuns || 0} 
          />
          <StatCard 
            icon={<Skull className="text-red-500" />} 
            label="Total Deaths" 
            value={stats?.totalDeaths || 0} 
          />
          <StatCard 
            icon={<Clock className="text-blue-400" />} 
            label="Best Time" 
            value={stats?.bestPracticeTimeMs ? formatTime(stats.bestPracticeTimeMs) : '--:--'} 
          />
          <StatCard 
            icon={<Flame className="text-torch-orange" />} 
            label="Current Streak" 
            value={`${stats?.currentStreak || 0} days`} 
          />
          <StatCard 
            icon={<TrendingUp className="text-green-500" />} 
            label="Longest Streak" 
            value={`${stats?.longestStreak || 0} days`} 
          />
          <StatCard 
            icon={<Coins className="text-yellow-400" />} 
            label="Coins Collected" 
            value={stats?.totalCoinsCollected || 0} 
          />
          <StatCard 
            icon={<Star className="text-purple-400" />} 
            label="Gems Collected" 
            value={stats?.totalGemsCollected || 0} 
          />
        </div>

        {/* Tournament Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-dungeon p-6 mb-8"
        >
          <h2 className="font-display text-xl text-gold-400 mb-4 flex items-center gap-2">
            <Crown className="text-gold-500" />
            Tournament Glory
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-dungeon-dark rounded-lg">
              <div className="text-3xl font-bold text-gold-400">{stats?.tournamentsPlayed || 0}</div>
              <div className="text-stone-500 text-sm">Tournaments Played</div>
            </div>
            <div className="text-center p-4 bg-dungeon-dark rounded-lg">
              <div className="text-3xl font-bold text-gold-400">{stats?.tournamentsWon || 0}</div>
              <div className="text-stone-500 text-sm">Championships Won</div>
            </div>
            <div className="text-center p-4 bg-dungeon-dark rounded-lg">
              <div className="text-3xl font-bold text-gold-400">{stats?.winRate || 0}%</div>
              <div className="text-stone-500 text-sm">Win Rate</div>
            </div>
          </div>
        </motion.div>

        {/* Daily Challenges */}
        {challenges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-dungeon p-6 mb-8"
          >
            <h2 className="font-display text-xl text-gold-400 mb-4 flex items-center gap-2">
              <Calendar className="text-torch-orange" />
              Daily Challenges
              <span className="text-stone-500 text-sm ml-auto font-body">Resets at midnight UTC</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {challenges.challenges.map((challenge: any) => (
                <div 
                  key={challenge.id}
                  className="p-4 bg-dungeon-dark rounded-lg border border-gold-800/30 hover:border-gold-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{challenge.icon}</span>
                    <div>
                      <div className="font-display text-gold-300">{challenge.title}</div>
                      <div className="text-stone-500 text-sm">{challenge.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-800">
                    <span className="text-torch-orange font-semibold">+{challenge.xpReward} XP</span>
                    <span className="text-stone-600 text-sm">Not started</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-dungeon p-6"
        >
          <h2 className="font-display text-xl text-gold-400 mb-4 flex items-center gap-2">
            <Award className="text-gold-500" />
            Achievements
            <span className="text-stone-500 text-sm ml-auto font-body">
              {achievements?.unlockedCount || 0} / {achievements?.totalCount || ACHIEVEMENTS.length} Unlocked
            </span>
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACHIEVEMENTS.slice(0, 12).map((achievement) => {
              const isUnlocked = achievements?.unlocked?.some((a: any) => a.id === achievement.id);
              return (
                <div 
                  key={achievement.id}
                  className={clsx(
                    'p-4 rounded-lg border transition-all',
                    isUnlocked 
                      ? 'bg-gold-900/20 border-gold-600/50' 
                      : 'bg-dungeon-dark border-stone-800 opacity-60'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'text-2xl',
                      !isUnlocked && 'grayscale'
                    )}>
                      {achievement.icon}
                    </span>
                    <div>
                      <div className={clsx(
                        'font-display',
                        isUnlocked ? 'text-gold-300' : 'text-stone-500'
                      )}>
                        {achievement.title}
                      </div>
                      <div className="text-stone-500 text-sm">{achievement.description}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className={clsx(
                      'text-sm font-semibold',
                      isUnlocked ? 'text-torch-orange' : 'text-stone-600'
                    )}>
                      +{achievement.xpReward} XP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-dungeon p-4 text-center"
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gold-400 font-display">{value}</div>
      <div className="text-stone-500 text-sm font-body">{label}</div>
    </motion.div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
}
