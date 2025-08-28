import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { PaintScheme, PaintRoom } from '../../lib/types';
import { getNextAvailablePaintType, getPaintTypes } from '../../lib/paintColors';

interface PaintColorsEditorProps {
  propertyId?: string;
  initial?: PaintScheme[];
  onChange?: (schemes: PaintScheme[]) => void;
}

export function PaintColorsEditor({ propertyId, initial = [], onChange }: PaintColorsEditorProps) {
  const [schemes, setSchemes] = useState<PaintScheme[]>(initial);
  const [paintTypes, setPaintTypes] = useState<string[]>([]);
  const [nextPaintType, setNextPaintType] = useState<string>('');

  useEffect(() => {
    // Load paint types
    getPaintTypes().then(setPaintTypes);
    
    if (propertyId) {
      getNextAvailablePaintType(propertyId).then(setNextPaintType);
    }
  }, [propertyId]);

  // Update schemes when initial prop changes (important for edit forms)
  useEffect(() => {
    if (initial && initial.length > 0) {
      console.log('PaintColorsEditor: initial prop changed, updating schemes:', initial);
      setSchemes(initial);
    }
  }, [initial]);

  useEffect(() => {
    onChange?.(schemes);
  }, [schemes, onChange]);

  const addPaintType = () => {
    if (!nextPaintType) return;
    
    const newScheme: PaintScheme = {
      paint_type: nextPaintType,
      rooms: []
    };
    
    setSchemes(prev => [...prev, newScheme]);
    
    // Calculate next available paint type
    const usedPaintTypes = new Set(schemes.map(s => s.paint_type));
    usedPaintTypes.add(nextPaintType);
    
    const nextAvailable = paintTypes.find(pt => !usedPaintTypes.has(pt));
    if (nextAvailable) {
      setNextPaintType(nextAvailable);
    }
  };

  const removePaintType = (index: number) => {
    setSchemes(prev => {
      const removed = prev[index];
      const newSchemes = prev.filter((_, i) => i !== index);
      
      // Recalculate next available paint type
      if (removed) {
        const usedPaintTypes = new Set(newSchemes.map(s => s.paint_type));
        const nextAvailable = paintTypes.find(pt => !usedPaintTypes.has(pt));
        if (nextAvailable) {
          setNextPaintType(nextAvailable);
        }
      }
      
      return newSchemes;
    });
  };

  const updatePaintType = (index: number, paintType: string) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[index] = { ...newSchemes[index], paint_type: paintType };
      
      // Recalculate next available paint type
      const usedPaintTypes = new Set(newSchemes.map(s => s.paint_type));
      const nextAvailable = paintTypes.find(pt => !usedPaintTypes.has(pt));
      if (nextAvailable) {
        setNextPaintType(nextAvailable);
      }
      
      return newSchemes;
    });
  };

  const addRoom = (schemeIndex: number) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      const newRoom: PaintRoom = { room: '', color: '' };
      newSchemes[schemeIndex].rooms = [...newSchemes[schemeIndex].rooms, newRoom];
      return newSchemes;
    });
  };

  const removeRoom = (schemeIndex: number, roomIndex: number) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[schemeIndex].rooms = newSchemes[schemeIndex].rooms.filter((_, i) => i !== roomIndex);
      return newSchemes;
    });
  };

  const updateRoom = (schemeIndex: number, roomIndex: number, field: keyof PaintRoom, value: string) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[schemeIndex].rooms[roomIndex] = { 
        ...newSchemes[schemeIndex].rooms[roomIndex], 
        [field]: value 
      };
      return newSchemes;
    });
  };

  const getUsedPaintTypes = () => {
    return new Set(schemes.map(s => s.paint_type));
  };

  if (paintTypes.length === 0) {
    return <div>Loading paint types...</div>;
  }

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Paint Colors</h3>
      
      {schemes.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No paint colors recorded. Click "Add Paint Type / Color" to get started.
        </p>
      )}

      {schemes.map((scheme, schemeIndex) => (
        <div key={schemeIndex} className="mb-6 p-4 border border-gray-200 dark:border-[#2D3B4E] rounded-lg">
          {/* Paint Type Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Paint Type:
              </label>
              <select
                value={scheme.paint_type}
                onChange={(e) => updatePaintType(schemeIndex, e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {paintTypes.map(paintType => (
                  <option 
                    key={paintType} 
                    value={paintType}
                    disabled={getUsedPaintTypes().has(paintType) && paintType !== scheme.paint_type}
                  >
                    {paintType}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => removePaintType(schemeIndex)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Paint Rooms */}
          <div className="space-y-3">
            {scheme.rooms.map((room, roomIndex) => (
              <div key={roomIndex} className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Room"
                  value={room.room}
                  onChange={(e) => updateRoom(schemeIndex, roomIndex, 'room', e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Paint Color"
                  value={room.color}
                  onChange={(e) => updateRoom(schemeIndex, roomIndex, 'color', e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeRoom(schemeIndex, roomIndex)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => addRoom(schemeIndex)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              + Add Room
            </button>
          </div>
        </div>
      ))}

      {/* Add Paint Type Button - Smaller and inline with app styling */}
      <button
        type="button"
        onClick={addPaintType}
        disabled={!nextPaintType}
        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Paint Type / Color
      </button>
    </div>
  );
}
