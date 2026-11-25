import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'violet';
}

const ACCENT_CLASSES = {
  cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'cyan',
}) => {
  return (
    <div className="nl-surface rounded-xl border p-4 transition-colors hover:border-cyan-500/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="nl-text-muted text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="nl-text-muted mt-1 text-xs">{subtitle}</p>}
        </div>
        <div className={`rounded-lg border p-2.5 ${ACCENT_CLASSES[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
