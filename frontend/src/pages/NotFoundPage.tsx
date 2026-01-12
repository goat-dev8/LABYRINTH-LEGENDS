import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="max-w-md mx-auto">
        {/* Dungeon 404 Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-64 h-64 mx-auto mb-8"
        >
          {/* Stone border layers */}
          <div className="absolute inset-0 border-4 border-gold-600/50 rounded-lg bg-dungeon-darker/50" />
          <div className="absolute inset-3 border-2 border-gold-700/40 rounded" />
          <div className="absolute inset-6 border border-dungeon-light/30 rounded" />
          
          {/* Corner torches */}
          <div className="absolute -top-3 -left-3 text-2xl animate-torch-flicker">🔥</div>
          <div className="absolute -top-3 -right-3 text-2xl animate-torch-flicker" style={{ animationDelay: '0.3s' }}>🔥</div>
          <div className="absolute -bottom-3 -left-3 text-2xl animate-torch-flicker" style={{ animationDelay: '0.6s' }}>🔥</div>
          <div className="absolute -bottom-3 -right-3 text-2xl animate-torch-flicker" style={{ animationDelay: '0.9s' }}>🔥</div>
          
          {/* 404 Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl mb-2">💀</span>
            <span className="font-display text-5xl font-bold text-gold-400 text-gold-glow">404</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="font-display text-3xl font-bold text-gold-300 mb-4">
            Lost in the Depths
          </h1>
          <p className="text-stone-400 mb-8 font-body">
            The chamber you seek has crumbled into the abyss, or perhaps it never existed at all...
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link 
            to="/" 
            className="btn-gold-filled flex items-center gap-2 justify-center"
          >
            <Home size={20} />
            Return to Sanctuary
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-stone flex items-center gap-2 justify-center"
          >
            <ArrowLeft size={20} />
            Retrace Steps
          </button>
        </motion.div>

        {/* Decorative footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-stone-600 text-sm font-body"
        >
          <span>⚔️</span>
          <span className="mx-3">•</span>
          <span>The path ahead is shrouded in darkness</span>
          <span className="mx-3">•</span>
          <span>⚔️</span>
        </motion.div>
      </div>
    </div>
  );
}
