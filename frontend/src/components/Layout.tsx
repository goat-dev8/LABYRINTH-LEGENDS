import { Outlet, Link, useLocation } from 'react-router-dom';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { motion } from 'framer-motion';
import { Home, Gamepad2, Trophy, Medal, User, WifiOff, Flame, BarChart3 } from 'lucide-react';
import { useSocketStore } from '../stores/socketStore';
import clsx from 'clsx';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/play', icon: Gamepad2, label: 'Play' },
  { path: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { path: '/leaderboard', icon: Medal, label: 'Leaderboard' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
  const location = useLocation();
  const { connected } = useSocketStore();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Dungeon Theme */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dungeon-dark/95 backdrop-blur-md border-b border-gold-900/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded bg-gradient-to-br from-gold-500 to-gold-700 p-0.5 shadow-gold">
                <div className="w-full h-full bg-dungeon-darker rounded flex items-center justify-center">
                  <span className="text-xl font-display font-bold text-gold-400">L</span>
                </div>
              </div>
              <span className="font-display font-bold text-xl hidden sm:block tracking-wider">
                <span className="text-gold-400">LABYRINTH</span>
                <span className="text-stone-400 ml-2">LEGENDS</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'px-4 py-2 rounded font-display text-sm uppercase tracking-wider transition-all duration-200',
                      'flex items-center gap-2',
                      isActive
                        ? 'bg-gold-900/30 text-gold-400 border border-gold-700/30'
                        : 'text-stone-400 hover:text-gold-300 hover:bg-dungeon-mid'
                    )}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div
                className={clsx(
                  'flex items-center gap-1.5 text-xs font-display uppercase tracking-wider',
                  connected ? 'text-emerald-400' : 'text-red-400'
                )}
                title={connected ? 'Connected to server' : 'Disconnected'}
              >
                {connected ? (
                  <>
                    <Flame size={14} className="animate-torch-flicker" />
                    <span className="hidden sm:inline">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={14} />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>

              {/* Dynamic wallet widget */}
              <DynamicWidget />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-16 pb-20 md:pb-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile bottom nav - Dungeon Theme */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dungeon-dark/95 backdrop-blur-md border-t border-gold-900/30 z-50">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded transition-all',
                  isActive
                    ? 'text-gold-400'
                    : 'text-stone-500 hover:text-gold-300'
                )}
              >
                <item.icon size={20} />
                <span className="text-xs font-display uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer (desktop only) - Dungeon Theme */}
      <footer className="hidden md:block border-t border-dungeon-lighter/30 py-4 bg-dungeon-darker">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm">
          <span className="text-stone-600 font-display tracking-wider">Built on Linera Conway Testnet</span>
          <div className="flex items-center gap-6">
            <a
              href="https://linera.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 hover:text-gold-400 transition-colors font-display tracking-wider"
            >
              Linera
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 hover:text-gold-400 transition-colors font-display tracking-wider"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
