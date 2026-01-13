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
  notation?: string;
}

export function MetricTile({ icon: Icon, label, value, trend, color = 'blue', notation }: MetricTileProps) {
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
    <div className="h-full flex flex-col justify-between bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-lg transition-all duration-200 hover:shadow-xl relative overflow-hidden group">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-gradient-to-br from-current to-transparent transform translate-x-8 -translate-y-8"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 rounded-full bg-gradient-to-tr from-current to-transparent transform -translate-x-6 translate-y-6"></div>
      </div>
      
      {/* Top row with icon and value */}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgProps.className || ''}`} style={bgProps.style}>
          <Icon className={`h-5 w-5 ${getIconColorClass()}`} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
        </div>
      </div>
      
      {/* Bottom section with label and trend */}
      <div className="space-y-2">
        {notation && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">{notation}</p>}
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{label}</p>
        
        {/* Trend indicator with mini chart */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${trend.isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.isPositive ? '+' : '-'}{trend.value}%
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">vs last 30d</span>
        </div>
      </div>
      
      {/* Subtle accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20"></div>
    </div>
  );
}
