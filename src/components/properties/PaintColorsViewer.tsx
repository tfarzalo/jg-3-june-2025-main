import React from 'react';
import { PaintScheme } from '../../lib/types';

interface PaintColorsViewerProps {
  items: PaintScheme[];
}

// Color mapping function to convert color names to hex codes
function getColorHex(colorName: string): string {
  const colorMap: { [key: string]: string } = {
    // Common paint colors
    'white': '#FFFFFF',
    'off-white': '#F5F5F5',
    'cream': '#FFFDD0',
    'beige': '#F5F5DC',
    'ivory': '#FFFFF0',
    'eggshell': '#F0EAD6',
    'tan': '#D2B48C',
    'taupe': '#483C32',
    'gray': '#808080',
    'light-gray': '#D3D3D3',
    'dark-gray': '#404040',
    'charcoal': '#36454F',
    'black': '#000000',
    
    // Warm colors
    'red': '#FF0000',
    'burgundy': '#800020',
    'maroon': '#800000',
    'pink': '#FFC0CB',
    'rose': '#FF007F',
    'coral': '#FF7F50',
    'orange': '#FFA500',
    'peach': '#FFCBA4',
    'yellow': '#FFFF00',
    'gold': '#FFD700',
    'amber': '#FFBF00',
    
    // Cool colors
    'blue': '#0000FF',
    'navy': '#000080',
    'royal-blue': '#4169E1',
    'sky-blue': '#87CEEB',
    'teal': '#008080',
    'turquoise': '#40E0D0',
    'green': '#008000',
    'forest-green': '#228B22',
    'sage': '#9CAF88',
    'mint': '#98FF98',
    'lime': '#32CD32',
    
    // Neutral colors
    'brown': '#A52A2A',
    'chocolate': '#D2691E',
    'coffee': '#6F4E37',
    'caramel': '#C68E17',
    'sand': '#F4A460',
    'khaki': '#F0E68C',
    
    // Special finishes
    'metallic': '#C0C0C0',
    'pearl': '#F0EAD6',
    'gloss': '#FFFFFF',
    'matte': '#808080',
    'satin': '#C0C0C0',
    'eggshell-finish': '#F0EAD6',
    'flat': '#808080',
    'semi-gloss': '#C0C0C0',
    'high-gloss': '#FFFFFF'
  };

  // Try to find exact match first
  const exactMatch = colorMap[colorName.toLowerCase()];
  if (exactMatch) return exactMatch;

  // Try to find partial matches
  for (const [key, value] of Object.entries(colorMap)) {
    if (colorName.toLowerCase().includes(key) || key.includes(colorName.toLowerCase())) {
      return value;
    }
  }

  // Default colors for unknown names
  const defaultColors = ['#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563', '#374151'];
  const hash = colorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return defaultColors[hash % defaultColors.length];
}

export function PaintColorsViewer({ items }: PaintColorsViewerProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          No paint colors recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((scheme, schemeIndex) => (
        <div key={schemeIndex} className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            {scheme.paint_type}
          </h4>
          
          {scheme.rooms && scheme.rooms.length > 0 ? (
            <div className="space-y-3">
              {scheme.rooms.map((room, roomIndex) => {
                const colorHex = getColorHex(room.color);
                
                return (
                  <div 
                    key={roomIndex} 
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                    style={{ 
                      backgroundColor: `${colorHex}20`, // 20 = 12% opacity for faded effect
                      borderLeft: `4px solid ${colorHex}`
                    }}
                  >
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">
                      {room.room}
                    </span>
                    <span className="text-gray-900 dark:text-white font-semibold text-sm">
                      {room.color}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic text-center py-4">
              No rooms specified for this paint type.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
