import { motion } from 'framer-motion';
import { Trophy, Sword, Shield, Crown, Flame, Clock, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TournamentsPage() {
  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gold-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-torch-orange/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="text-gold-500" size={32} />
            <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-400">
              ⚔️ Tournament Arena ⚔️
            </h1>
          </div>
          <p className="text-stone-400 font-body text-lg">
            Epic battles and legendary glory await
          </p>
        </motion.div>

        {/* Coming Soon Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="card-gold p-8 md:p-12 text-center relative overflow-hidden">
            {/* Animated torches */}
            <div className="absolute top-4 left-4 text-torch-orange">
              <Flame size={24} className="animate-torch-flicker" />
            </div>
            <div className="absolute top-4 right-4 text-torch-orange">
              <Flame size={24} className="animate-torch-flicker" />
            </div>

            {/* Shield icon with crown */}
            <motion.div 
              animate={{ 
                y: [0, -8, 0],
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative w-32 h-32 mx-auto mb-8"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 to-gold-700/20 rounded-full blur-xl" />
              <div className="relative w-full h-full flex items-center justify-center">
                <Shield size={80} className="text-gold-600/30 absolute" />
                <Crown size={40} className="text-gold-500 relative z-10" />
              </div>
              {/* Rotating ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-gold-600/20 border-dashed"
              />
            </motion.div>

            {/* Main content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                <span className="bg-gradient-to-r from-gold-400 via-gold-300 to-gold-400 bg-clip-text text-transparent">
                  Coming Soon
                </span>
              </h2>
              
              <p className="text-stone-400 font-body text-lg mb-8 max-w-md mx-auto leading-relaxed">
                The Tournament Arena is being forged by master craftsmen. 
                Soon, brave warriors will compete for glory and legendary rewards!
              </p>

              {/* Feature previews */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-dungeon-darker/50 rounded-lg border border-gold-800/30"
                >
                  <Users size={24} className="text-gold-500 mx-auto mb-2" />
                  <h4 className="font-display text-sm text-gold-400 mb-1">Multiplayer Battles</h4>
                  <p className="text-xs text-stone-500">Compete against champions worldwide</p>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-dungeon-darker/50 rounded-lg border border-gold-800/30"
                >
                  <Trophy size={24} className="text-gold-500 mx-auto mb-2" />
                  <h4 className="font-display text-sm text-gold-400 mb-1">XP Prizes</h4>
                  <p className="text-xs text-stone-500">Win massive XP rewards on-chain</p>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-dungeon-darker/50 rounded-lg border border-gold-800/30"
                >
                  <Clock size={24} className="text-gold-500 mx-auto mb-2" />
                  <h4 className="font-display text-sm text-gold-400 mb-1">Timed Events</h4>
                  <p className="text-xs text-stone-500">Daily and weekly championships</p>
                </motion.div>
              </div>

              {/* Call to action */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/play"
                  className="btn-gold-filled px-8 py-3 flex items-center gap-2"
                >
                  <Sparkles size={18} />
                  Practice Now
                </Link>
                <Link
                  to="/leaderboard"
                  className="btn-stone px-8 py-3 flex items-center gap-2"
                >
                  <Trophy size={18} />
                  View Leaderboard
                </Link>
              </div>
            </motion.div>

            {/* Bottom decoration */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-3 mt-10 pt-6 border-t border-gold-800/30"
            >
              <Sword className="text-gold-600/40" size={16} />
              <span className="text-stone-500 text-sm font-body">
                Prepare yourself for glory
              </span>
              <Sword className="text-gold-600/40 transform scale-x-[-1]" size={16} />
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom decoration */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-3 mt-12"
        >
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-gold-600/30" />
          <Shield className="text-gold-600/40" size={20} />
          <div className="h-px w-20 bg-gradient-to-l from-transparent to-gold-600/30" />
        </motion.div>
      </div>
    </div>
  );
}
