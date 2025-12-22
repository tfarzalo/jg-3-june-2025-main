import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  accentColor: string;
  'aria-label': string;
}

export function StatCard({ title, value, accentColor, 'aria-label': ariaLabel }: StatCardProps) {
  // Determine if we should use light or dark text based on background color
  const getTextColor = (backgroundColor: string) => {
    // Simple contrast calculation - convert hex to RGB and calculate luminance
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Use dark text on light backgrounds, light text on dark backgrounds
    return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
  };

  const textColor = getTextColor(accentColor);

  return (
    <div 
      className="text-center p-3 rounded-lg transition-colors"
      style={{ 
        backgroundColor: `${accentColor}20`, // 20% opacity
        border: `1px solid ${accentColor}40` // 40% opacity border
      }}
      aria-label={ariaLabel}
    >
      <p 
        className="text-2xl font-bold"
        style={{ color: accentColor }}
      >
        {value}
      </p>
      <p 
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: accentColor }}
      >
        {title}
      </p>
    </div>
  );
}
