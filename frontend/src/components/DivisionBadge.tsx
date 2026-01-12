import { Shield } from 'lucide-react';
import type { Division } from '../types';

interface DivisionBadgeProps {
  division: Division;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const divisionConfig: Record<Division, { color: string; bg: string; border: string; glow: string }> = {
  Bronze: { 
    color: 'text-amber-600', 
    bg: 'bg-amber-900/30', 
    border: 'border-amber-700/50',
    glow: 'shadow-amber-900/30'
  },
  Silver: { 
    color: 'text-slate-300', 
    bg: 'bg-slate-700/30', 
    border: 'border-slate-500/50',
    glow: 'shadow-slate-700/30'
  },
  Gold: { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-900/30', 
    border: 'border-yellow-600/50',
    glow: 'shadow-yellow-700/30'
  },
  Platinum: { 
    color: 'text-cyan-300', 
    bg: 'bg-cyan-900/30', 
    border: 'border-cyan-600/50',
    glow: 'shadow-cyan-700/30'
  },
  Diamond: { 
    color: 'text-blue-300', 
    bg: 'bg-blue-900/30', 
    border: 'border-blue-500/50',
    glow: 'shadow-blue-600/30'
  },
  Champion: { 
    color: 'text-purple-400', 
    bg: 'bg-gradient-to-br from-purple-900/40 to-gold-900/30', 
    border: 'border-purple-500/60',
    glow: 'shadow-purple-600/40'
  },
};

const divisionLabels: Record<Division, string> = {
  Bronze: 'Bronze',
  Silver: 'Silver',
  Gold: 'Gold',
  Platinum: 'Platinum',
  Diamond: 'Diamond',
  Champion: 'Champion',
};

const sizeConfig = {
  sm: { container: 'p-1.5', icon: 14, text: 'text-xs' },
  md: { container: 'p-2', icon: 18, text: 'text-sm' },
  lg: { container: 'p-3', icon: 24, text: 'text-base' },
};

export default function DivisionBadge({ division, size = 'md', showLabel = true }: DivisionBadgeProps) {
  const config = divisionConfig[division];
  const sizes = sizeConfig[size];

  return (
    <div 
      className={`
        inline-flex items-center gap-2 rounded-lg border
        ${config.bg} ${config.border} ${sizes.container}
        shadow-lg ${config.glow}
      `}
    >
      <Shield className={config.color} size={sizes.icon} />
      {showLabel && (
        <span className={`${config.color} font-semibold ${sizes.text} uppercase tracking-wider`}>
          {divisionLabels[division]}
        </span>
      )}
    </div>
  );
}

// Helper to get division from ELO
export function getDivisionFromElo(elo: number): Division {
  if (elo >= 2500) return 'Champion';
  if (elo >= 2000) return 'Diamond';
  if (elo >= 1600) return 'Platinum';
  if (elo >= 1300) return 'Gold';
  if (elo >= 1000) return 'Silver';
  return 'Bronze';
}

// Export configs for use elsewhere
export { divisionConfig, divisionLabels };
