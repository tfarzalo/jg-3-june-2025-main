import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface MetricTileProps {
  icon: typeof LucideIcon;
  label: string;
  value: string | number;
  trend: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export function MetricTile({ icon: Icon, label, value, trend, color = 'blue' }: MetricTileProps) {
  const getBgStyle = () => {
    // Check if the color is a custom hex code
    if (color && color.startsWith('#')) {
      // If a custom color (like a hex code), return inline style with opacity
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const validAlpha = Math.max(0, Math.min(1, alpha));
        return `rgba(${r}, ${g}, ${b}, ${validAlpha})`;
      };
      const rgbaColor = hexToRgba(color, 0.1); // 10% opacity
      return { style: { backgroundColor: rgbaColor } };
    } else {
      // Otherwise, use predefined Tailwind classes or fallback
      const predefinedColors: { [key: string]: string } = {
        'blue': 'bg-blue-500/10 dark:bg-blue-500/10',
        'orange': 'bg-orange-500/10 dark:bg-orange-500/10',
        'purple': 'bg-purple-500/10 dark:bg-purple-500/10',
        'emerald': 'bg-emerald-500/10 dark:bg-emerald-500/10',
        'red': 'bg-red-500/10 dark:bg-red-500/10',
      };
      const className = predefinedColors[color] || 'bg-blue-500/10 dark:bg-blue-500/10';
      return { className };
    }
  };

  const getIconColorClass = () => {
    // Check if the label is 'Pending Work Orders' to apply custom icon color
    if (label === 'Pending Work Orders') {
      return 'text-[#DAA520]'; // Golden Yellow color
    } else if (color && color.startsWith('#')) {
      // If it's a custom hex color, use it directly for the icon color
      return `text-[${color}]`;
    } 
    else {
      // Use Tailwind color classes based on the color prop or fallback
      switch (color) {
        case 'blue': return 'text-blue-600 dark:text-blue-400';
        case 'orange': return 'text-orange-600 dark:text-orange-400';
        case 'purple': return 'text-purple-600 dark:text-purple-400';
        case 'emerald': return 'text-emerald-600 dark:text-emerald-400';
        case 'red': return 'text-red-600 dark:text-red-400';
        default:
          return 'text-blue-600 dark:text-blue-400';
      }
    }
  };

  const bgProps = getBgStyle(); // Get either className or style

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg transition-all duration-200 hover:shadow-xl">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${bgProps.className || ''}`} style={bgProps.style}>
        <Icon className={`h-6 w-6 ${getIconColorClass()}`} />
      </div>
      <div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{value}</p>
        <p className={`text-sm ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {trend.isPositive ? '+' : '-'}{trend.value}% vs previous 30 days
        </p>
      </div>
    </div>
  );
}