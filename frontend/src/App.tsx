import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AstrayPlayPage from './pages/AstrayPlayPage';
import TournamentsPage from './pages/TournamentsPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import StatsPage from './pages/StatsPage';
import NotFoundPage from './pages/NotFoundPage';

import { useSocketStore } from './stores/socketStore';
import { useLineraConnection } from './hooks';

export default function App() {
  const { connect, disconnect } = useSocketStore();
  const { isConnecting, isConnected, isAppConnected, error } = useLineraConnection();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <>
      {/* Linera Connection Status Banner */}
      {isConnecting && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-dark-800 border-b border-dark-600 p-2 text-center">
          <span className="text-neon-cyan text-sm animate-pulse">
            🔄 Connecting to Linera Conway Testnet...
          </span>
        </div>
      )}
      
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-900/80 border-b border-red-500 p-2 text-center">
          <span className="text-red-200 text-sm">
            ⚠️ Linera: {error}
          </span>
        </div>
      )}
      
      {isConnected && isAppConnected && !isConnecting && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-900/50 border-b border-green-500/50 p-1 text-center">
          <span className="text-green-300 text-xs">
            ✅ Connected to Linera Conway Testnet
          </span>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="play" element={<AstrayPlayPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="tournaments/:id" element={<TournamentDetailPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}