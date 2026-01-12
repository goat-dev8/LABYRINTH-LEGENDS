import { motion } from 'framer-motion';
import { 
  Star, Trophy, Zap, Shield, Coins, 
  Flame, Target, TrendingUp, Award 
} from 'lucide-react';
import type { XpBreakdown } from '../types';

interface XpBreakdownDisplayProps {
  breakdown: XpBreakdown;
  isLevelUp?: boolean;
  newLevel?: number;
  achievementsUnlocked?: string[];
}

export default function XpBreakdownDisplay({ 
  breakdown, 
  isLevelUp, 
  newLevel,
  achievementsUnlocked = []
}: XpBreakdownDisplayProps) {
  const items = [
    { label: 'Base XP', value: breakdown.baseXp, icon: <Star size={16} />, color: 'text-gold-400' },
    { label: 'Completion Bonus', value: breakdown.completionBonus, icon: <Trophy size={16} />, color: 'text-green-400', show: breakdown.completionBonus > 0 },
    { label: 'Speed Bonus', value: breakdown.speedBonus, icon: <Zap size={16} />, color: 'text-blue-400', show: breakdown.speedBonus > 0 },
    { label: 'Perfect Run Bonus', value: breakdown.perfectBonus, icon: <Shield size={16} />, color: 'text-purple-400', show: breakdown.perfectBonus > 0 },
    { label: 'Coin Bonus', value: breakdown.coinBonus, icon: <Coins size={16} />, color: 'text-yellow-400', show: breakdown.coinBonus > 0 },
    { label: 'Gem Bonus', value: breakdown.gemBonus, icon: <Star size={16} />, color: 'text-pink-400', show: breakdown.gemBonus > 0 },
    { label: 'Streak Bonus', value: breakdown.streakBonus, icon: <Flame size={16} />, color: 'text-orange-400', show: breakdown.streakBonus > 0 },
    { label: 'First Clear Today', value: breakdown.firstClearBonus, icon: <Target size={16} />, color: 'text-cyan-400', show: breakdown.firstClearBonus > 0 },
    { label: 'Death Penalty', value: -breakdown.deathPenalty, icon: <TrendingUp size={16} />, color: 'text-red-400', show: breakdown.deathPenalty > 0 },
  ].filter(item => item.show !== false);

  const hasMultipliers = breakdown.tournamentMultiplier > 1 || breakdown.levelMultiplier > 1;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="card-dungeon p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 mb-3"
          >
            <Star className="text-dungeon-darker" size={32} />
          </motion.div>
          <h3 className="font-display text-xl text-gold-400 uppercase tracking-wider">XP Earned</h3>
        </div>

        {/* XP Breakdown */}
        <div className="space-y-2 mb-4">
          {items.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              className="flex items-center justify-between py-2 border-b border-stone-800/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className={item.color}>{item.icon}</span>
                <span className="text-stone-300 text-sm">{item.label}</span>
              </div>
              <span className={`font-mono ${item.value >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                {item.value >= 0 ? '+' : ''}{item.value}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Multipliers */}
        {hasMultipliers && (
          <div className="bg-dungeon-dark rounded-lg p-3 mb-4">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-2">Multipliers</div>
            <div className="flex gap-4">
              {breakdown.tournamentMultiplier > 1 && (
                <div className="flex items-center gap-1">
                  <Trophy size={14} className="text-gold-500" />
                  <span className="text-gold-400 text-sm">×{breakdown.tournamentMultiplier.toFixed(1)} Tournament</span>
                </div>
              )}
              {breakdown.levelMultiplier > 1 && (
                <div className="flex items-center gap-1">
                  <TrendingUp size={14} className="text-blue-400" />
                  <span className="text-blue-400 text-sm">×{breakdown.levelMultiplier.toFixed(2)} Level</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/50 to-transparent my-4" />

        {/* Total */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <div className="text-stone-500 text-sm uppercase tracking-wider mb-1">Total XP Earned</div>
          <div className="text-4xl font-bold font-display text-torch-orange">
            +{breakdown.totalXp.toLocaleString()}
          </div>
        </motion.div>

        {/* Level Up */}
        {isLevelUp && newLevel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: 'spring' }}
            className="mt-4 p-4 bg-gradient-to-r from-gold-900/30 to-transparent rounded-lg border border-gold-600/30"
          >
            <div className="flex items-center justify-center gap-3">
              <Award className="text-gold-500" size={24} />
              <div>
                <div className="text-gold-400 font-display uppercase tracking-wider">Level Up!</div>
                <div className="text-stone-400 text-sm">You reached Level {newLevel}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Achievements Unlocked */}
        {achievementsUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-4"
          >
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-2">Achievements Unlocked</div>
            {achievementsUnlocked.map((achievement, i) => (
              <motion.div
                key={achievement}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.1 }}
                className="flex items-center gap-2 p-2 bg-gold-900/20 rounded border border-gold-700/30 mb-2"
              >
                <Trophy className="text-gold-500" size={16} />
                <span className="text-gold-300">{achievement}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
