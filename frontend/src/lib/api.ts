import type {
  Player,
  Tournament,
  GameRun,
  LeaderboardEntry,
  TournamentParticipant,
  TournamentReward,
  ApiResponse,
  Difficulty,
  GameMode,
  TournamentStatus,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.error || 'API request failed');
  }

  return json.data;
}

// ===== Player API =====

export async function getPlayer(walletAddress: string): Promise<Player | null> {
  try {
    const data = await fetchApi<{ player: Player }>(`/api/players/${walletAddress}`);
    return data.player;
  } catch {
    return null;
  }
}

export async function registerPlayer(
  walletAddress: string,
  username: string,
  signature: string,
  discordTag?: string
): Promise<Player> {
  const data = await fetchApi<{ player: Player }>('/api/players/register', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, username, signature, discordTag }),
  });
  return data.player;
}

export async function getPlayerRuns(walletAddress: string, limit = 50): Promise<GameRun[]> {
  const data = await fetchApi<{ runs: GameRun[] }>(
    `/api/players/${walletAddress}/runs?limit=${limit}`
  );
  return data.runs;
}

// ===== Tournament API =====

export async function getTournaments(status?: TournamentStatus): Promise<Tournament[]> {
  const url = status ? `/api/tournaments?status=${status}` : '/api/tournaments';
  const data = await fetchApi<{ tournaments: Tournament[] }>(url);
  return data.tournaments;
}

export async function getTournament(id: number): Promise<{
  tournament: Tournament;
  leaderboard: LeaderboardEntry[];
}> {
  const data = await fetchApi<{
    tournament: Tournament;
    leaderboard: LeaderboardEntry[];
  }>(`/api/tournaments/${id}`);
  return data;
}

export async function createTournament(params: {
  title: string;
  description?: string;
  difficulty: Difficulty;
  startTime: string;
  endTime: string;
  maxAttemptsPerPlayer?: number;
  xpRewardPool?: number;
  creatorWallet: string;
  signature: string;
}): Promise<Tournament> {
  const data = await fetchApi<{ tournament: Tournament }>('/api/tournaments', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.tournament;
}

export async function joinTournament(
  tournamentId: number,
  walletAddress: string,
  signature: string
): Promise<{ tournamentId: number; participant: TournamentParticipant; mazeSeed: string }> {
  const data = await fetchApi<{
    tournamentId: number;
    participant: TournamentParticipant;
    mazeSeed: string;
  }>(`/api/tournaments/${tournamentId}/join`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress, signature }),
  });
  return data;
}

export async function getTournamentLeaderboard(tournamentId: number): Promise<LeaderboardEntry[]> {
  const data = await fetchApi<{ leaderboard: LeaderboardEntry[] }>(
    `/api/tournaments/${tournamentId}/leaderboard`
  );
  return data.leaderboard;
}

export async function claimTournamentReward(
  tournamentId: number,
  walletAddress: string,
  signature: string
): Promise<TournamentReward> {
  const data = await fetchApi<{ reward: TournamentReward }>(
    `/api/tournaments/${tournamentId}/claim`,
    {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature }),
    }
  );
  return data.reward;
}

// ===== Game Run API =====

export async function submitRun(params: {
  walletAddress: string;
  signature: string;
  mode: GameMode;
  tournamentId?: number;
  difficulty: Difficulty;
  levelReached: number;
  timeMs: number;
  deaths: number;
  completed: boolean;
  mazeSeed?: string;
}): Promise<GameRun> {
  const data = await fetchApi<{ run: GameRun }>('/api/runs', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.run;
}

export async function getRecentRuns(limit = 20): Promise<GameRun[]> {
  const data = await fetchApi<{ runs: GameRun[] }>(`/api/runs?limit=${limit}`);
  return data.runs;
}

// ===== Leaderboard API =====

export async function getPracticeLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const data = await fetchApi<{ leaderboard: LeaderboardEntry[] }>(
    `/api/leaderboard?limit=${limit}`
  );
  return data.leaderboard;
}

// ===== Stats API =====

export async function getStats(): Promise<{
  totalPlayers: number;
  totalTournaments: number;
  totalRuns: number;
  activeTournaments: number;
}> {
  return fetchApi('/api/stats');
}

// ===== Verification API =====

export async function verifySignature(
  message: string,
  signature: string,
  walletAddress: string
): Promise<boolean> {
  const data = await fetchApi<{ valid: boolean }>('/api/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature, walletAddress }),
  });
  return data.valid;
}
