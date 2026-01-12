import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, Difficulty, GameMode } from '../types';

interface GameState {
  // Player
  player: Player | null;
  isRegistered: boolean;
  
  // Game settings
  selectedDifficulty: Difficulty;
  selectedMode: GameMode;
  currentTournamentId: number | null;
  
  // Game state
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  deaths: number;
  levelReached: number;
  
  // UI state
  showRegistrationModal: boolean;
  showGameOverModal: boolean;
  lastRunXp: number;
  
  // Actions
  setPlayer: (player: Player | null) => void;
  setIsRegistered: (registered: boolean) => void;
  setSelectedDifficulty: (difficulty: Difficulty) => void;
  setSelectedMode: (mode: GameMode) => void;
  setCurrentTournamentId: (id: number | null) => void;
  
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (completed: boolean, time: number, deaths: number, levelReached: number) => void;
  resetGame: () => void;
  
  setShowRegistrationModal: (show: boolean) => void;
  setShowGameOverModal: (show: boolean) => void;
  setLastRunXp: (xp: number) => void;
  
  updateTime: (time: number) => void;
  incrementDeaths: () => void;
  setLevelReached: (level: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // Initial state
      player: null,
      isRegistered: false,
      selectedDifficulty: 'Medium',
      selectedMode: 'Practice',
      currentTournamentId: null,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      deaths: 0,
      levelReached: 1,
      showRegistrationModal: false,
      showGameOverModal: false,
      lastRunXp: 0,
      
      // Actions
      setPlayer: (player) => set({ player, isRegistered: !!player }),
      setIsRegistered: (isRegistered) => set({ isRegistered }),
      setSelectedDifficulty: (selectedDifficulty) => set({ selectedDifficulty }),
      setSelectedMode: (selectedMode) => set({ selectedMode }),
      setCurrentTournamentId: (currentTournamentId) => set({ currentTournamentId }),
      
      startGame: () => set({
        isPlaying: true,
        isPaused: false,
        currentTime: 0,
        deaths: 0,
        levelReached: 1,
        showGameOverModal: false,
      }),
      
      pauseGame: () => set({ isPaused: true }),
      resumeGame: () => set({ isPaused: false }),
      
      endGame: (_completed, time, deaths, levelReached) => set({
        isPlaying: false,
        isPaused: false,
        currentTime: time,
        deaths,
        levelReached,
        showGameOverModal: true,
      }),
      
      resetGame: () => set({
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        deaths: 0,
        levelReached: 1,
        showGameOverModal: false,
      }),
      
      setShowRegistrationModal: (showRegistrationModal) => set({ showRegistrationModal }),
      setShowGameOverModal: (showGameOverModal) => set({ showGameOverModal }),
      setLastRunXp: (lastRunXp) => set({ lastRunXp }),
      
      updateTime: (currentTime) => set({ currentTime }),
      incrementDeaths: () => set((state) => ({ deaths: state.deaths + 1 })),
      setLevelReached: (levelReached) => set({ levelReached }),
    }),
    {
      name: 'labyrinth-game-store',
      partialize: (state) => ({
        selectedDifficulty: state.selectedDifficulty,
        selectedMode: state.selectedMode,
      }),
    }
  )
);
