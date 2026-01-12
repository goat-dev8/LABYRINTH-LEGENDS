/**
 * Game Event Hooks
 * Utility functions for React integration
 */

/**
 * Create a game instance with React-friendly hooks
 */
export function createGameHooks(game) {
  return {
    // Start a run
    start: (config) => game.start(config),
    
    // Pause/resume
    pause: () => game.pause(),
    resume: () => game.resume(),
    stop: () => game.stop(),
    
    // Get state
    getState: () => game.getState(),
    getRunConfig: () => game.getRunConfig(),
    
    // Configuration
    setDifficulty: (difficulty) => game.setDifficulty(difficulty),
    setSeed: (seed) => game.setSeed(seed),
    regenerate: () => game.regenerate(),
    
    // Cleanup
    destroy: () => game.destroy()
  };
}

/**
 * Format time in milliseconds to display string
 */
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate XP for a run
 */
export function calculateXP(result) {
  const difficultyMultipliers = {
    easy: 100,
    medium: 200,
    hard: 400,
    nightmare: 800
  };

  const baseXP = difficultyMultipliers[result.difficulty?.toLowerCase()] || 200;
  
  // Completion bonus
  const completionBonus = result.completed ? baseXP : 0;
  
  // Time bonus (max 2x base for under 2 minutes)
  const timeSecs = result.timeMs / 1000;
  const timeBonus = result.completed && timeSecs < 120
    ? Math.floor(baseXP * (120 - timeSecs) / 120)
    : 0;
  
  // Death penalty (-10% per death, min 50%)
  const deathPenalty = Math.min(result.deaths * 10, 50);
  const deathMultiplier = (100 - deathPenalty) / 100;
  
  const rawXP = (baseXP + completionBonus + timeBonus) * deathMultiplier;
  
  return Math.floor(rawXP);
}

/**
 * Format XP with suffix
 */
export function formatXP(xp) {
  if (xp >= 1000000) {
    return (xp / 1000000).toFixed(1) + 'M';
  }
  if (xp >= 1000) {
    return (xp / 1000).toFixed(1) + 'K';
  }
  return xp.toString();
}

/**
 * Get difficulty color
 */
export function getDifficultyColor(difficulty) {
  const colors = {
    easy: '#00ff88',
    medium: '#00d4ff',
    hard: '#ffaa00',
    nightmare: '#ff3366'
  };
  return colors[difficulty?.toLowerCase()] || colors.medium;
}

/**
 * Get difficulty label
 */
export function getDifficultyLabel(difficulty) {
  const labels = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    nightmare: 'Nightmare'
  };
  return labels[difficulty?.toLowerCase()] || 'Medium';
}
