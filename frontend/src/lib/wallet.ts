import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

/**
 * Hook to sign messages using Dynamic wallet
 * Uses personal_sign RPC method (NOT signMessage)
 */
export function useWalletSigner() {
  const { primaryWallet, user } = useDynamicContext();

  const signMessage = async (message: string): Promise<string> => {
    if (!primaryWallet) {
      throw new Error('No wallet connected');
    }

    // Get the wallet client/provider
    const walletClient = await (primaryWallet as any).getWalletClient();

    if (!walletClient) {
      throw new Error('Could not get wallet client');
    }

    // Use personal_sign RPC method
    const signature = await walletClient.request({
      method: 'personal_sign',
      params: [
        `0x${Buffer.from(message).toString('hex')}`,
        primaryWallet.address,
      ],
    });

    return signature as string;
  };

  const getAddress = (): string | null => {
    return primaryWallet?.address ?? null;
  };

  const isConnected = (): boolean => {
    return !!primaryWallet?.address;
  };

  return {
    signMessage,
    getAddress,
    isConnected,
    wallet: primaryWallet,
    user,
  };
}

/**
 * Format wallet address for display
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format time in milliseconds to display string
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
}

/**
 * Format XP number
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * Calculate level from XP
 * Uses a balanced formula that matches contract XP rewards (~75-300 XP per run)
 * Level 1: 0 XP, Level 2: 200 XP, Level 10: ~5000 XP, Level 20: ~16000 XP
 */
export function calculateLevel(xp: number): { level: number; progress: number; nextLevelXp: number } {
  // Balanced XP curve: 100 + (level * 100) XP per level
  // This means ~2-4 runs per level at low levels, ~10+ at higher levels
  let level = 1;
  let totalXpForLevel = 0;

  while (true) {
    const xpNeededForNextLevel = 100 + (level * 100); // 200, 300, 400, 500...
    if (totalXpForLevel + xpNeededForNextLevel > xp) break;
    totalXpForLevel += xpNeededForNextLevel;
    level++;
    if (level > 100) break; // Cap at level 100
  }

  const currentLevelXpNeeded = 100 + (level * 100);
  const xpIntoLevel = xp - totalXpForLevel;
  const progress = (xpIntoLevel / currentLevelXpNeeded) * 100;

  return {
    level,
    progress: Math.min(progress, 100),
    nextLevelXp: currentLevelXpNeeded - xpIntoLevel,
  };
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}

/**
 * Get difficulty color class
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'Easy':
      return 'text-neon-green';
    case 'Medium':
      return 'text-neon-yellow';
    case 'Hard':
      return 'text-neon-orange';
    case 'Nightmare':
      return 'text-neon-red';
    default:
      return 'text-white';
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Upcoming':
      return 'text-neon-cyan';
    case 'Active':
      return 'text-neon-green';
    case 'Ended':
      return 'text-gray-400';
    default:
      return 'text-white';
  }
}

/**
 * Get rank display
 */
export function getRankDisplay(rank: number): { text: string; class: string } {
  switch (rank) {
    case 1:
      return { text: '🥇', class: 'text-yellow-400' };
    case 2:
      return { text: '🥈', class: 'text-gray-300' };
    case 3:
      return { text: '🥉', class: 'text-amber-600' };
    default:
      return { text: `#${rank}`, class: 'text-gray-400' };
  }
}
