import React from 'react';
import {
  BellRing,
  Flame,
  Lightbulb,
  MessageSquareMore,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type WhatsNewIconName =
  | 'sparkles'
  | 'rocket'
  | 'zap'
  | 'wand'
  | 'message'
  | 'shield'
  | 'bell'
  | 'settings'
  | 'flame'
  | 'lightbulb';

export type WhatsNewBadgeLabel =
  | 'WOW'
  | 'BY REQUEST'
  | 'HOT ITEM'
  | 'NEW'
  | 'IMPROVED'
  | 'POWER UP';

export interface WhatsNewEntry {
  id: string;
  title: string;
  description: string;
  icon_name: WhatsNewIconName;
  badge_label: WhatsNewBadgeLabel | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export const WHATS_NEW_ICON_OPTIONS: Array<{
  value: WhatsNewIconName;
  label: string;
  icon: LucideIcon;
}> = [
  { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'rocket', label: 'Rocket', icon: Rocket },
  { value: 'zap', label: 'Zap', icon: Zap },
  { value: 'wand', label: 'Wand', icon: Wand2 },
  { value: 'message', label: 'Message', icon: MessageSquareMore },
  { value: 'shield', label: 'Shield', icon: ShieldCheck },
  { value: 'bell', label: 'Bell', icon: BellRing },
  { value: 'settings', label: 'Settings', icon: Settings2 },
  { value: 'flame', label: 'Flame', icon: Flame },
  { value: 'lightbulb', label: 'Idea', icon: Lightbulb },
];

export const WHATS_NEW_BADGE_OPTIONS: WhatsNewBadgeLabel[] = [
  'WOW',
  'BY REQUEST',
  'HOT ITEM',
  'NEW',
  'IMPROVED',
  'POWER UP',
];

export function getWhatsNewIcon(iconName?: string | null): LucideIcon {
  return WHATS_NEW_ICON_OPTIONS.find((option) => option.value === iconName)?.icon ?? Sparkles;
}

export function getWhatsNewBadgeClasses(badge?: string | null): string {
  switch (badge) {
    case 'WOW':
      return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300';
    case 'BY REQUEST':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    case 'HOT ITEM':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'IMPROVED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'POWER UP':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
  }
}

export function formatWhatsNewDate(dateString?: string | null): string {
  if (!dateString) return 'Recently';

  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getWhatsNewFreshnessDate(entry: Pick<WhatsNewEntry, 'updated_at' | 'published_at' | 'created_at'>): string {
  return entry.updated_at || entry.published_at || entry.created_at;
}

export function hasUnreadWhatsNew(
  entries: Array<Pick<WhatsNewEntry, 'updated_at' | 'published_at' | 'created_at'>>,
  lastSeenAt?: string | null
): boolean {
  if (!entries.length) return false;
  if (!lastSeenAt) return true;

  const latestEntryTime = Math.max(
    ...entries.map((entry) => new Date(getWhatsNewFreshnessDate(entry)).getTime())
  );

  return latestEntryTime > new Date(lastSeenAt).getTime();
}

export function renderWhatsNewIcon(iconName?: string | null, className = 'h-5 w-5') {
  const Icon = getWhatsNewIcon(iconName);
  return <Icon className={className} />;
}
