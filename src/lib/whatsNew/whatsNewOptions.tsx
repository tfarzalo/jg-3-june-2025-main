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

export type WhatsNewAccentColor =
  | 'sky'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate';

export interface WhatsNewEntry {
  id: string;
  title: string;
  description: string;
  icon_name: WhatsNewIconName;
  icon_color: WhatsNewAccentColor;
  badge_label: WhatsNewBadgeLabel | null;
  is_published: boolean;
  include_super_admin: boolean;
  display_order: number;
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

export const WHATS_NEW_COLOR_OPTIONS: Array<{
  value: WhatsNewAccentColor;
  label: string;
  dotClass: string;
}> = [
  { value: 'sky', label: 'Sky', dotClass: 'bg-sky-500' },
  { value: 'violet', label: 'Violet', dotClass: 'bg-violet-500' },
  { value: 'emerald', label: 'Emerald', dotClass: 'bg-emerald-500' },
  { value: 'amber', label: 'Amber', dotClass: 'bg-amber-500' },
  { value: 'rose', label: 'Rose', dotClass: 'bg-rose-500' },
  { value: 'slate', label: 'Slate', dotClass: 'bg-slate-500' },
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

export function getWhatsNewAccentClasses(color?: string | null): {
  badge: string;
  badgeDark: string;
  pill: string;
  border: string;
} {
  switch (color) {
    case 'violet':
      return {
        badge: 'bg-violet-100 text-violet-700',
        badgeDark: 'dark:bg-violet-900/40 dark:text-violet-300',
        pill: 'bg-violet-500',
        border: 'border-violet-300 dark:border-violet-700/50',
      };
    case 'emerald':
      return {
        badge: 'bg-emerald-100 text-emerald-700',
        badgeDark: 'dark:bg-emerald-900/40 dark:text-emerald-300',
        pill: 'bg-emerald-500',
        border: 'border-emerald-300 dark:border-emerald-700/50',
      };
    case 'amber':
      return {
        badge: 'bg-amber-100 text-amber-700',
        badgeDark: 'dark:bg-amber-900/40 dark:text-amber-300',
        pill: 'bg-amber-500',
        border: 'border-amber-300 dark:border-amber-700/50',
      };
    case 'rose':
      return {
        badge: 'bg-rose-100 text-rose-700',
        badgeDark: 'dark:bg-rose-900/40 dark:text-rose-300',
        pill: 'bg-rose-500',
        border: 'border-rose-300 dark:border-rose-700/50',
      };
    case 'slate':
      return {
        badge: 'bg-slate-200 text-slate-700',
        badgeDark: 'dark:bg-slate-800 dark:text-slate-300',
        pill: 'bg-slate-500',
        border: 'border-slate-300 dark:border-slate-700/50',
      };
    default:
      return {
        badge: 'bg-sky-100 text-sky-700',
        badgeDark: 'dark:bg-sky-900/40 dark:text-sky-300',
        pill: 'bg-sky-500',
        border: 'border-sky-300 dark:border-sky-700/50',
      };
  }
}

export function getWhatsNewFreshnessDate(entry: Pick<WhatsNewEntry, 'updated_at' | 'published_at' | 'created_at'>): string {
  return entry.updated_at || entry.published_at || entry.created_at;
}

export function isWhatsNewCurrentDate(dateString?: string | null): boolean {
  if (!dateString) return false;

  const value = new Date(dateString);
  const now = new Date();

  return value.getFullYear() === now.getFullYear()
    && value.getMonth() === now.getMonth()
    && value.getDate() === now.getDate();
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
