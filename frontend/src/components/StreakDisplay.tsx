import { motion } from 'framer-motion';
import { Flame, Calendar, TrendingUp } from 'lucide-react';

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  compact?: boolean;
}

export default function StreakDisplay({ 
  currentStreak, 
  longestStreak, 
  lastPlayedDate,
  compact = false 
}: StreakDisplayProps) {
  // Calculate streak status
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const isStreakActive = lastPlayedDate === today || lastPlayedDate === yesterday;
  const playedToday = lastPlayedDate === today;

  // Streak bonus percentage
  const streakBonus = Math.min(currentStreak * 2, 50);

  // Get flame intensity based on streak
  const getFlameColor = () => {
    if (currentStreak >= 30) return 'text-red-400';
    if (currentStreak >= 14) return 'text-orange-400';
    if (currentStreak >= 7) return 'text-yellow-400';
    return 'text-amber-500';
  };

  const getStreakMessage = () => {
    if (currentStreak >= 30) return '🔥 On Fire!';
    if (currentStreak >= 14) return '🎯 Dedicated!';
    if (currentStreak >= 7) return '⚡ Nice streak!';
    if (currentStreak >= 3) return '👍 Keep going!';
    return 'Build your streak!';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <motion.div
          animate={isStreakActive && currentStreak > 0 ? { 
            scale: [1, 1.1, 1],
          } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Flame 
            className={isStreakActive ? getFlameColor() : 'text-stone-600'} 
            size={20} 
          />
        </motion.div>
        <span className={`font-bold ${isStreakActive && currentStreak > 0 ? 'text-orange-400' : 'text-stone-500'}`}>
          {currentStreak} day{currentStreak !== 1 ? 's' : ''}
        </span>
        {streakBonus > 0 && isStreakActive && (
          <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
            +{streakBonus}% XP
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="card-dungeon p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm text-stone-500 uppercase tracking-wider mb-1">Daily Streak</h3>
          <div className="flex items-center gap-3">
            <motion.div
              animate={isStreakActive && currentStreak > 0 ? { 
                scale: [1, 1.15, 1],
                rotate: [0, -5, 5, 0]
              } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Flame 
                className={isStreakActive ? getFlameColor() : 'text-stone-600'} 
                size={36} 
              />
            </motion.div>
            <div>
              <div className={`text-3xl font-bold font-display ${isStreakActive && currentStreak > 0 ? 'text-orange-400' : 'text-stone-500'}`}>
                {currentStreak}
              </div>
              <div className="text-stone-400 text-sm">
                {currentStreak === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>
        </div>

        {/* Streak bonus indicator */}
        {streakBonus > 0 && isStreakActive && (
          <div className="bg-green-900/30 border border-green-700/30 rounded-lg px-3 py-2 text-center">
            <div className="text-green-400 text-lg font-bold">+{streakBonus}%</div>
            <div className="text-green-500/70 text-xs">XP Bonus</div>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-3">
        {playedToday ? (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Played today!
          </span>
        ) : isStreakActive ? (
          <span className="flex items-center gap-1 text-yellow-400 text-sm">
            <Calendar size={14} />
            Play today to keep streak!
          </span>
        ) : (
          <span className="flex items-center gap-1 text-stone-500 text-sm">
            <Calendar size={14} />
            Start a new streak!
          </span>
        )}
      </div>

      {/* Message */}
      <div className="text-sm text-stone-400 mb-4">{getStreakMessage()}</div>

      {/* Stats row */}
      <div className="flex gap-4 pt-3 border-t border-stone-800/50">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-gold-500" />
          <span className="text-stone-500 text-sm">Best:</span>
          <span className="text-gold-400 font-bold">{longestStreak} days</span>
        </div>
      </div>

      {/* Streak milestones */}
      <div className="mt-4">
        <div className="text-xs text-stone-600 mb-2">Streak Milestones</div>
        <div className="flex gap-1">
          {[3, 7, 14, 30].map((milestone) => (
            <div 
              key={milestone}
              className={`
                flex-1 h-2 rounded-full
                ${currentStreak >= milestone ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-stone-800'}
              `}
              title={`${milestone} days`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-stone-600 mt-1">
          <span>3</span>
          <span>7</span>
          <span>14</span>
          <span>30</span>
        </div>
      </div>
    </div>
  );
}
