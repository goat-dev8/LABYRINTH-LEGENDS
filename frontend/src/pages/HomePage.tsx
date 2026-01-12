import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Trophy, Users, Zap, ChevronRight, Play, Flame, Shield, Sword, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStats, getTournaments, getRecentRuns } from '../lib/api';
import { formatTime, formatRelativeTime, getDifficultyColor } from '../lib/wallet';
import type { Tournament, GameRun } from '../types';

export default function HomePage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 30000,
  });

  const { data: tournaments } = useQuery({
    queryKey: ['tournaments', 'Active'],
    queryFn: () => getTournaments('Active'),
  });

  const { data: recentRuns } = useQuery({
    queryKey: ['recentRuns'],
    queryFn: () => getRecentRuns(5),
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section with Torch Effects */}
      <section className="relative overflow-hidden">
        {/* Torch glow effects */}
        <div className="absolute top-0 left-10 w-64 h-64 bg-torch-orange/20 blur-[100px] animate-torch-flicker" />
        <div className="absolute top-20 right-10 w-48 h-48 bg-torch-orange/15 blur-[80px] animate-torch-flicker" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-64 bg-gold-500/10 blur-[120px]" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Decorative top element */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-4">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-600/50" />
                <Sword className="w-6 h-6 text-gold-500 rotate-45" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-600/50" />
              </div>
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-4 tracking-wider">
              <span className="text-shimmer">LABYRINTH</span>
            </h1>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-stone-300 tracking-widest">
              LEGENDS
            </h2>
            
            <p className="text-xl md:text-2xl text-stone-400 mb-10 font-body max-w-2xl mx-auto leading-relaxed">
              Descend into the depths. Navigate ancient mazes. 
              <span className="text-gold-400"> Claim your glory on-chain.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/play" className="btn-gold-filled flex items-center gap-3 justify-center text-lg">
                <Play size={22} />
                Enter the Labyrinth
              </Link>
              <Link to="/tournaments" className="btn-gold flex items-center gap-3 justify-center text-lg">
                <Crown size={22} />
                Tournaments
              </Link>
            </div>

            {/* Decorative bottom element */}
            <div className="flex justify-center mt-12">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gold-500 rotate-45" />
                <div className="h-px w-24 bg-gradient-to-r from-gold-600/50 via-gold-400/30 to-transparent" />
                <Flame className="w-5 h-5 text-torch-orange animate-torch-flicker" />
                <div className="h-px w-24 bg-gradient-to-l from-gold-600/50 via-gold-400/30 to-transparent" />
                <div className="w-2 h-2 bg-gold-500 rotate-45" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dungeon-mid/50 to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
          >
            <StatCard icon={Users} value={stats?.totalPlayers || 0} label="Adventurers" accent="gold" />
            <StatCard icon={Crown} value={stats?.totalTournaments || 0} label="Tournaments" accent="torch" />
            <StatCard icon={Gamepad2} value={stats?.totalRuns || 0} label="Total Runs" accent="gold" />
            <StatCard icon={Flame} value={stats?.activeTournaments || 0} label="Active Now" accent="torch" />
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="divider-gold mx-auto max-w-4xl" />

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                <span className="gradient-text">Why Enter the Labyrinth?</span>
              </h2>
              <p className="text-stone-500 max-w-xl mx-auto">Face the challenge. Prove your worth. Earn eternal glory.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              <FeatureCard title="On-Chain Legacy" description="Every run recorded on Linera blockchain. Your victories are eternal and verifiable." icon={<Shield className="w-10 h-10" />} delay={0} />
              <FeatureCard title="Treacherous Depths" description="Navigate dark corridors lit by torch light. Dynamic 3D mazes that test your skill." icon={<Flame className="w-10 h-10" />} delay={0.1} />
              <FeatureCard title="Glory & Rewards" description="Earn XP from every expedition. Top performers claim prizes from the gold pool." icon={<Trophy className="w-10 h-10" />} delay={0.2} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Active Tournaments */}
      {tournaments && tournaments.length > 0 && (
        <section className="py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dungeon-mid/30 to-transparent" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6 text-gold-500" />
                  <h2 className="font-display text-2xl font-bold text-gold-400">Active Tournaments</h2>
                </div>
                <Link to="/tournaments" className="text-sm text-stone-400 hover:text-gold-400 transition-colors flex items-center gap-1 group">
                  View All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.slice(0, 3).map((tournament, index) => (
                  <TournamentCard key={tournament.id} tournament={tournament} index={index} />
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {recentRuns && recentRuns.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div className="flex items-center gap-3 mb-8">
                <Zap className="w-6 h-6 text-torch-orange" />
                <h2 className="font-display text-2xl font-bold text-stone-300">Recent Expeditions</h2>
              </div>
              <div className="card-dungeon p-6">
                <div className="space-y-1">
                  {recentRuns.map((run, index) => (
                    <ActivityItem key={run.id} run={run} index={index} />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-dungeon-mid/80 to-transparent" />
        <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-torch-orange/10 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-48 bg-gold-500/10 blur-[100px]" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-gold-400 text-gold-glow">Ready to Prove Your Worth?</h2>
            <p className="text-stone-400 mb-8 max-w-lg mx-auto">The labyrinth awaits. Will you emerge as a legend?</p>
            <Link to="/play" className="btn-gold-filled text-lg inline-flex items-center gap-3">
              <Sword size={20} />
              Begin Your Journey
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, accent }: { icon: React.ElementType; value: number; label: string; accent: 'gold' | 'torch' }) {
  const accentClasses = { gold: 'text-gold-400 border-gold-700/30', torch: 'text-torch-orange border-torch-orange/30' };
  return (
    <motion.div whileHover={{ y: -4 }} className={`card-dungeon p-6 border ${accentClasses[accent]} text-center group hover:shadow-gold transition-all duration-300`}>
      <Icon className={`w-8 h-8 mx-auto mb-3 ${accentClasses[accent].split(' ')[0]} group-hover:scale-110 transition-transform`} />
      <div className="font-display text-3xl md:text-4xl font-bold text-stone-100 mb-1">{value.toLocaleString()}</div>
      <div className="text-sm text-stone-500 uppercase tracking-wider">{label}</div>
    </motion.div>
  );
}

function FeatureCard({ title, description, icon, delay }: { title: string; description: string; icon: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + delay }} whileHover={{ y: -6 }} className="card-gold p-8 group">
      <div className="text-gold-500 mb-6 group-hover:text-gold-400 transition-colors group-hover:scale-110 transform duration-300">{icon}</div>
      <h3 className="font-display text-xl font-semibold mb-3 text-stone-100 group-hover:text-gold-300 transition-colors">{title}</h3>
      <p className="text-stone-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function TournamentCard({ tournament, index }: { tournament: Tournament; index: number }) {
  const endDate = new Date(tournament.endTime);
  const timeLeft = endDate.getTime() - Date.now();
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + index * 0.1 }}>
      <Link to={`/tournaments/${tournament.id}`} className="card-gold p-6 block group">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display font-semibold text-lg text-stone-100 group-hover:text-gold-400 transition-colors">{tournament.title}</h3>
          <span className={`badge-gold ${getDifficultyColor(tournament.difficulty)}`}>{tournament.difficulty}</span>
        </div>
        <p className="text-sm text-stone-500 mb-5 line-clamp-2">{tournament.description}</p>
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-stone-500 flex items-center gap-1"><Users size={14} />{tournament.participantCount} warriors</span>
          <span className="text-torch-orange flex items-center gap-1"><Flame size={14} className="animate-torch-flicker" />{hoursLeft > 0 ? `${hoursLeft}h left` : 'Ending soon'}</span>
        </div>
        <div className="pt-4 border-t border-dungeon-lighter flex items-center justify-between">
          <span className="text-xs text-stone-600 uppercase tracking-wider">Prize Pool</span>
          <span className="font-display font-semibold text-gold-400 text-gold-glow">{tournament.xpRewardPool.toLocaleString()} XP</span>
        </div>
      </Link>
    </motion.div>
  );
}

function ActivityItem({ run, index }: { run: GameRun; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + index * 0.05 }} className="flex items-center justify-between py-3 border-b border-dungeon-lighter/50 last:border-0 group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-gold">
          <span className="text-sm font-display font-bold text-dungeon-darker">{run.username.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <span className="font-display font-medium text-stone-200">{run.username}</span>
          <span className="text-stone-500 ml-2">{run.completed ? 'conquered' : 'attempted'} a <span className={getDifficultyColor(run.difficulty)}>{run.difficulty}</span> labyrinth</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-gold-400 font-mono text-sm">{formatTime(run.timeMs)}</div>
        <div className="text-xs text-stone-600">{formatRelativeTime(run.createdAt)}</div>
      </div>
    </motion.div>
  );
}
