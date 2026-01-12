import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type {
  GameRun,
  RunSubmittedEvent,
  LeaderboardUpdateEvent,
  TournamentStatusChangeEvent,
  Tournament,
} from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  activityFeed: GameRun[];
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  identify: (walletAddress: string) => void;
  joinTournament: (tournamentId: number) => void;
  leaveTournament: (tournamentId: number) => void;
  requestActivity: () => void;
  
  // Event handlers (can be set by components)
  onRunSubmitted?: (event: RunSubmittedEvent) => void;
  onLeaderboardUpdate?: (event: LeaderboardUpdateEvent) => void;
  onTournamentStatusChange?: (event: TournamentStatusChangeEvent) => void;
  onTournamentCreated?: (tournament: Tournament) => void;
  
  setOnRunSubmitted: (handler: (event: RunSubmittedEvent) => void) => void;
  setOnLeaderboardUpdate: (handler: (event: LeaderboardUpdateEvent) => void) => void;
  setOnTournamentStatusChange: (handler: (event: TournamentStatusChangeEvent) => void) => void;
  setOnTournamentCreated: (handler: (tournament: Tournament) => void) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  activityFeed: [],
  
  connect: () => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      set({ connected: true });
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      set({ connected: false });
    });
    
    socket.on('activityFeed', (runs: GameRun[]) => {
      set({ activityFeed: runs });
    });
    
    socket.on('runSubmitted', (event: RunSubmittedEvent) => {
      const { onRunSubmitted, activityFeed } = get();
      
      // Add to activity feed (mock run object)
      const newRun: GameRun = {
        id: event.runId,
        walletAddress: event.walletAddress,
        username: event.username,
        mode: event.mode,
        timeMs: event.timeMs,
        xpEarned: event.xpEarned,
        difficulty: 'Medium', // Default, actual value from event if available
        levelReached: 1,
        deaths: 0,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      
      set({ activityFeed: [newRun, ...activityFeed].slice(0, 20) });
      onRunSubmitted?.(event);
    });
    
    socket.on('leaderboardUpdate', (event: LeaderboardUpdateEvent) => {
      get().onLeaderboardUpdate?.(event);
    });
    
    socket.on('tournamentStatusChange', (event: TournamentStatusChangeEvent) => {
      get().onTournamentStatusChange?.(event);
    });
    
    socket.on('tournamentCreated', (tournament: Tournament) => {
      get().onTournamentCreated?.(tournament);
    });
    
    set({ socket });
  },
  
  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },
  
  identify: (walletAddress: string) => {
    get().socket?.emit('identify', walletAddress);
  },
  
  joinTournament: (tournamentId: number) => {
    get().socket?.emit('joinTournament', tournamentId);
  },
  
  leaveTournament: (tournamentId: number) => {
    get().socket?.emit('leaveTournament', tournamentId);
  },
  
  requestActivity: () => {
    get().socket?.emit('requestActivity');
  },
  
  setOnRunSubmitted: (handler) => set({ onRunSubmitted: handler }),
  setOnLeaderboardUpdate: (handler) => set({ onLeaderboardUpdate: handler }),
  setOnTournamentStatusChange: (handler) => set({ onTournamentStatusChange: handler }),
  setOnTournamentCreated: (handler) => set({ onTournamentCreated: handler }),
}));
