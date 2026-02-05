import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, Users, Sparkles, Target, Award, Flame, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { lineraAdapter } from '../lib/linera';
import { useLineraConnection } from '../hooks';
import { LINERA_QUERIES, LINERA_MUTATIONS } from '../lib/chain/config';

// API URL for backend fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Tournament type from blockchain
interface BlockchainTournament {
  id: number;
  title: string;
  description: string;
  mazeSeed: string;
  difficulty: string;
  startTime: string;  // Timestamp in microseconds
  endTime: string;    // Timestamp in microseconds
  status: string;
  participantCount: number;
  totalRuns: number;
  xpRewardPool: number;
}

interface LeaderboardEntry {
  walletAddress: number[];
  username: string;
  bestTimeMs: number;
  totalRuns: number;
  totalXp: number;
  rank: number;
}

// Calculate time remaining for tournament
function useCountdown(endTime: number) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = endTime - Date.now();
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      total: difference,
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  return timeLeft;
}

// Format time in ms to display string
function formatTime(ms: number): string {
  if (!ms || ms === 0) return '--:--';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }
  return `${secs}.${hundredths.toString().padStart(2, '0')}s`;
}

export default function TournamentsPage() {
  const { isAppConnected } = useLineraConnection();
  const [tournament, setTournament] = useState<BlockchainTournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Refetch tournament data (reusable function)
  const refetchTournamentData = async () => {
    if (!isAppConnected) return;
    
    try {
      const tournamentResult = await lineraAdapter.query<{ activeTournament: BlockchainTournament | null }>(
        LINERA_QUERIES.getActiveTournament
      );
      
      if (tournamentResult.activeTournament) {
        const t = tournamentResult.activeTournament;
        setTournament(t);
        console.log(`🔄 Tournament refreshed: ${t.participantCount} participants, ${t.totalRuns} runs`);

        // Refresh leaderboard too
        const leaderboardResult = await lineraAdapter.query<{ leaderboard: LeaderboardEntry[] }>(
          LINERA_QUERIES.getLeaderboard,
          { tournamentId: t.id, limit: 10 }
        );
        if (leaderboardResult.leaderboard) {
          setLeaderboard(leaderboardResult.leaderboard);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to refetch tournament:', error);
    }
  };

  // Subscribe to block notifications for auto-refetch
  useEffect(() => {
    if (!isAppConnected) return;
    
    const unsubscribe = lineraAdapter.subscribe(() => {
      console.log('🔔 Block notification - refetching tournament...');
      refetchTournamentData();
    });
    
    return () => unsubscribe();
  }, [isAppConnected]);

  // Fetch tournament data: blockchain first (always returns data), backend fallback
  useEffect(() => {
    async function fetchTournamentData() {
      setLoading(true);
      setError(null);

      try {
        // PRIMARY: Try blockchain if connected
        if (isAppConnected) {
          console.log('📡 Fetching tournament from blockchain...');
          
          // Get active tournament
          const tournamentResult = await lineraAdapter.query<{ activeTournament: BlockchainTournament | null }>(
            LINERA_QUERIES.getActiveTournament
          );
          
          console.log('📦 Blockchain query result:', JSON.stringify(tournamentResult, null, 2));

          if (tournamentResult.activeTournament) {
            const t = tournamentResult.activeTournament;
            setTournament(t);
            console.log('✅ Tournament loaded from blockchain:', t.title);

            // Get leaderboard for this tournament
            const leaderboardResult = await lineraAdapter.query<{ leaderboard: LeaderboardEntry[] }>(
              LINERA_QUERIES.getLeaderboard,
              { tournamentId: t.id, limit: 10 }
            );

            if (leaderboardResult.leaderboard) {
              setLeaderboard(leaderboardResult.leaderboard);
              console.log('✅ Leaderboard loaded:', leaderboardResult.leaderboard.length, 'entries');
            }
            
            setLoading(false);
            return;
          } else {
            // No tournament exists on-chain - bootstrap it
            console.log('⚠️ No tournament on-chain, bootstrapping...');
            try {
              // Bootstrap must go to hub chain directly (not cross-chain)
              await lineraAdapter.mutateHub(LINERA_MUTATIONS.bootstrapTournament, {});
              console.log('✅ Bootstrap mutation sent to hub, waiting for block notification...');
              // Block notification system will auto-refetch
              setLoading(false);
              return;
            } catch (bootstrapError) {
              console.warn('Bootstrap failed:', bootstrapError);
              // Stay in loading - don't fall back to backend when connected
              setLoading(false);
              return;
            }
          }
        }

        // FALLBACK: Use backend cache or default tournament ONLY when NOT connected
        console.log('📡 Using backend/default tournament data (not connected to Linera)...');
        
        // Try backend first
        try {
          const response = await fetch(`${API_URL}/api/tournaments`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.tournaments?.length > 0) {
              const activeTournament = data.data.tournaments.find((t: any) => t.status === 'Active');
              if (activeTournament) {
                setTournament({
                  id: activeTournament.id,
                  title: activeTournament.title,
                  description: activeTournament.description || '',
                  mazeSeed: activeTournament.mazeSeed || '',
                  difficulty: activeTournament.difficulty || 'Medium',
                  startTime: new Date(activeTournament.startTime).getTime() * 1000 + '',
                  endTime: new Date(activeTournament.endTime).getTime() * 1000 + '',
                  status: activeTournament.status,
                  participantCount: activeTournament.participantCount || 0,
                  totalRuns: activeTournament.totalRuns || 0,
                  xpRewardPool: activeTournament.xpRewardPool || 10000,
                });
                setLoading(false);
                return;
              }
            }
          }
        } catch (backendError) {
          console.warn('Backend fallback failed:', backendError);
        }

        // FINAL FALLBACK: Default tournament data (if blockchain unavailable)
        // NOTE: participantCount and totalRuns are 0 until blockchain updates
        const now = Date.now();
        setTournament({
          id: 1,
          title: "Labyrinth Legends Championship",
          description: "15-day tournament - Navigate the maze faster than anyone else!",
          mazeSeed: "labyrinth_legends_championship",
          difficulty: "Medium",
          startTime: ((now - (2 * 24 * 60 * 60 * 1000)) * 1000).toString(),
          endTime: ((now + (13 * 24 * 60 * 60 * 1000)) * 1000).toString(),
          status: "Active",
          participantCount: 0,  // Real value comes from blockchain
          totalRuns: 0,         // Real value comes from blockchain
          xpRewardPool: 10000,
        });

      } catch (err) {
        console.error('Failed to fetch tournament:', err);
        setError('Failed to load tournament data');
      } finally {
        setLoading(false);
      }
    }

    fetchTournamentData();
  }, [isAppConnected]);

  // Calculate end time from tournament data (convert microseconds to ms)
  const tournamentEndTime = tournament 
    ? parseInt(tournament.endTime) / 1000 
    : Date.now() + (13 * 24 * 60 * 60 * 1000);
  
  const countdown = useCountdown(tournamentEndTime);

  // Get top player from leaderboard
  const topPlayer = leaderboard.length > 0 ? leaderboard[0] : null;

  // Tournament stats
  const tournamentStats = {
    participants: tournament?.participantCount || 0,
    totalRuns: tournament?.totalRuns || 0,
    topTime: topPlayer ? formatTime(topPlayer.bestTimeMs) : "--:--",
    topPlayer: topPlayer?.username || "---",
    xpPool: tournament?.xpRewardPool?.toLocaleString() || "10,000",
  };

  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gold-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="text-gold-500" size={32} />
            <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-400">
              ⚔️ Tournament Arena ⚔️
            </h1>
          </div>
          <p className="text-stone-400 font-body text-lg">
            Compete for glory and legendary XP rewards
          </p>
        </motion.div>

        {/* Active Tournament Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-gold-500/50 bg-gradient-to-br from-dungeon-darker via-dungeon-dark to-dungeon-darker">
            {/* Active badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-500/20 border border-green-500/50 rounded-full px-3 py-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-semibold">LIVE</span>
            </div>

            {/* Animated torches */}
            <div className="absolute top-4 left-4 text-torch-orange">
              <Flame size={24} className="animate-torch-flicker" />
            </div>

            <div className="p-8 md:p-12">
              {/* Tournament Title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-gold-500/20 border border-gold-500/30 rounded-full px-4 py-1 mb-4">
                  <Star className="text-gold-400" size={16} />
                  <span className="text-gold-400 text-sm font-semibold">15-DAY CHAMPIONSHIP</span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-gold-400 via-gold-300 to-gold-400 bg-clip-text text-transparent">
                    Labyrinth Legends Championship
                  </span>
                </h2>
                <p className="text-stone-400">Navigate the maze faster than anyone else!</p>
              </div>

              {/* Countdown Timer */}
              <div className="flex justify-center gap-4 mb-8">
                <div className="bg-dungeon-darker/80 rounded-xl p-4 min-w-[80px] text-center border border-gold-600/30">
                  <div className="text-3xl md:text-4xl font-bold text-gold-400">{countdown.days}</div>
                  <div className="text-xs text-stone-500 uppercase tracking-wider">Days</div>
                </div>
                <div className="bg-dungeon-darker/80 rounded-xl p-4 min-w-[80px] text-center border border-gold-600/30">
                  <div className="text-3xl md:text-4xl font-bold text-gold-400">{countdown.hours.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-stone-500 uppercase tracking-wider">Hours</div>
                </div>
                <div className="bg-dungeon-darker/80 rounded-xl p-4 min-w-[80px] text-center border border-gold-600/30">
                  <div className="text-3xl md:text-4xl font-bold text-gold-400">{countdown.minutes.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-stone-500 uppercase tracking-wider">Mins</div>
                </div>
                <div className="bg-dungeon-darker/80 rounded-xl p-4 min-w-[80px] text-center border border-gold-600/30">
                  <div className="text-3xl md:text-4xl font-bold text-neon-cyan">{countdown.seconds.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-stone-500 uppercase tracking-wider">Secs</div>
                </div>
              </div>

              {/* Tournament Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-dungeon-darker/50 rounded-lg p-4 text-center border border-stone-700/50">
                  <Users className="text-neon-cyan mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">{tournamentStats.participants}</div>
                  <div className="text-xs text-stone-500">Participants</div>
                </div>
                <div className="bg-dungeon-darker/50 rounded-lg p-4 text-center border border-stone-700/50">
                  <Target className="text-neon-purple mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">{tournamentStats.totalRuns}</div>
                  <div className="text-xs text-stone-500">Total Runs</div>
                </div>
                <div className="bg-dungeon-darker/50 rounded-lg p-4 text-center border border-stone-700/50">
                  <Clock className="text-green-400 mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">{tournamentStats.topTime}</div>
                  <div className="text-xs text-stone-500">Best Time</div>
                </div>
                <div className="bg-dungeon-darker/50 rounded-lg p-4 text-center border border-stone-700/50">
                  <Award className="text-gold-400 mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-gold-400">{tournamentStats.xpPool}</div>
                  <div className="text-xs text-stone-500">XP Pool</div>
                </div>
              </div>

              {/* Current Leader */}
              <div className="bg-gradient-to-r from-gold-500/10 to-transparent rounded-lg p-4 mb-8 border border-gold-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center text-xl font-bold text-dungeon-darker">
                    👑
                  </div>
                  <div>
                    <div className="text-xs text-gold-400 uppercase tracking-wider">Current Leader</div>
                    <div className="text-xl font-bold text-white">{tournamentStats.topPlayer}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-stone-500">Best Time</div>
                    <div className="text-xl font-bold text-green-400">{tournamentStats.topTime}</div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/play"
                  className="btn-gold-filled px-8 py-4 flex items-center gap-2 text-lg w-full sm:w-auto justify-center"
                >
                  <Sparkles size={20} />
                  Enter Tournament
                </Link>
                <Link
                  to="/leaderboard"
                  className="btn-stone px-8 py-4 flex items-center gap-2 text-lg w-full sm:w-auto justify-center"
                >
                  <Trophy size={20} />
                  View Leaderboard
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Prize Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <h3 className="font-display text-2xl font-bold text-center mb-6 text-gold-400">
            🏆 Prize Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { rank: "1st", xp: "4,000", color: "from-gold-400 to-gold-600" },
              { rank: "2nd", xp: "2,500", color: "from-stone-300 to-stone-500" },
              { rank: "3rd", xp: "1,500", color: "from-amber-600 to-amber-800" },
              { rank: "4th", xp: "1,200", color: "from-stone-500 to-stone-700" },
              { rank: "5th", xp: "800", color: "from-stone-600 to-stone-800" },
            ].map((prize, i) => (
              <motion.div
                key={prize.rank}
                whileHover={{ scale: 1.05 }}
                className="bg-dungeon-darker/50 rounded-lg p-4 text-center border border-stone-700/50"
              >
                <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br ${prize.color} flex items-center justify-center font-bold text-dungeon-darker`}>
                  {i + 1}
                </div>
                <div className="text-lg font-bold text-white">{prize.rank}</div>
                <div className="text-gold-400 font-semibold">{prize.xp} XP</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto mt-12 text-center"
        >
          <h3 className="font-display text-xl font-bold mb-4 text-stone-300">How Tournaments Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-stone-400">
            <div className="p-4">
              <div className="text-3xl mb-2">🎮</div>
              <h4 className="font-semibold text-white mb-1">Play the Maze</h4>
              <p>Complete the labyrinth as fast as possible. Every run counts!</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">⏱️</div>
              <h4 className="font-semibold text-white mb-1">Beat the Clock</h4>
              <p>Your best time determines your leaderboard position.</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">🏆</div>
              <h4 className="font-semibold text-white mb-1">Win Rewards</h4>
              <p>Top 5 players earn XP rewards when the tournament ends.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
