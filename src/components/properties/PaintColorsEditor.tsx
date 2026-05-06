import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Pencil, Check } from 'lucide-react';
import { PaintScheme, PaintRoom } from '../../lib/types';
import { getNextAvailablePaintType, getPaintTypes } from '../../lib/paintColors';

interface FloorplanGroup {
  floorplan: string;
  rooms: PaintRoom[];
}

interface PaintColorsEditorProps {
  propertyId?: string;
  initial?: PaintScheme[];
  onChange?: (schemes: PaintScheme[]) => void;
}

export function PaintColorsEditor({ propertyId, initial = [], onChange }: PaintColorsEditorProps) {
  const [schemes, setSchemes] = useState<PaintScheme[]>(initial);
  const [paintTypes, setPaintTypes] = useState<string[]>([]);
  const [nextPaintType, setNextPaintType] = useState<string>('');
  // Per-scheme: new floorplan label being typed
  const [newFloorplanNames, setNewFloorplanNames] = useState<{ [schemeIndex: number]: string }>({});
  // Per-scheme+floorplan: editing the floorplan label
  const [editingFloorplan, setEditingFloorplan] = useState<{ schemeIndex: number; oldName: string; newName: string } | null>(null);

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
      setSchemes(initial);
    }
  }, [initial]);

  useEffect(() => {
    onChange?.(schemes);
  }, [schemes, onChange]);

  // Helper function to group rooms by floorplan
  const groupRoomsByFloorplan = (rooms: PaintRoom[]): FloorplanGroup[] => {
    const grouped: { [key: string]: PaintRoom[] } = {};
    
    rooms.forEach(room => {
      const floorplan = room.floorplan || 'Floorplan 1';
      if (!grouped[floorplan]) {
        grouped[floorplan] = [];
      }
      grouped[floorplan].push(room);
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([floorplan, rooms]) => ({ floorplan, rooms }));
  };

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

  // Add a new floorplan with the user-supplied label
  const addFloorplan = (schemeIndex: number) => {
    const rawName = (newFloorplanNames[schemeIndex] || '').trim();
    if (!rawName) return;
    const usedFloorplans = getUsedFloorplans(schemes[schemeIndex]);
    if (usedFloorplans.includes(rawName)) return; // already exists
    setSchemes(prev => {
      const newSchemes = [...prev];
      const newRoom: PaintRoom = { room: '', color: '', floorplan: rawName };
      newSchemes[schemeIndex] = {
        ...newSchemes[schemeIndex],
        rooms: [...newSchemes[schemeIndex].rooms, newRoom],
      };
      return newSchemes;
    });
    setNewFloorplanNames(prev => ({ ...prev, [schemeIndex]: '' }));
  };

  const addRoomToFloorplan = (schemeIndex: number, floorplanName: string) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      const newRoom: PaintRoom = { room: '', color: '', floorplan: floorplanName };
      newSchemes[schemeIndex] = {
        ...newSchemes[schemeIndex],
        rooms: [...newSchemes[schemeIndex].rooms, newRoom],
      };
      return newSchemes;
    });
  };

  // Rename all rooms belonging to a floorplan
  const renameFloorplan = (schemeIndex: number, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[schemeIndex] = {
        ...newSchemes[schemeIndex],
        rooms: newSchemes[schemeIndex].rooms.map(r =>
          (r.floorplan || 'Floorplan 1') === oldName ? { ...r, floorplan: trimmed } : r
        ),
      };
      return newSchemes;
    });
  };

  // Remove all rooms belonging to a floorplan
  const removeFloorplan = (schemeIndex: number, floorplanName: string) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[schemeIndex] = {
        ...newSchemes[schemeIndex],
        rooms: newSchemes[schemeIndex].rooms.filter(
          r => (r.floorplan || 'Floorplan 1') !== floorplanName
        ),
      };
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

  const updateRoom = (schemeIndex: number, roomIndex: number, field: 'room' | 'color', value: string) => {
    setSchemes(prev => {
      const newSchemes = [...prev];
      newSchemes[schemeIndex].rooms[roomIndex] = {
        ...newSchemes[schemeIndex].rooms[roomIndex],
        [field]: value,
      };
      return newSchemes;
    });
  };

  const getUsedPaintTypes = () => new Set(schemes.map(s => s.paint_type));

  const getUsedFloorplans = (scheme: PaintScheme) => {
    const floorplans = new Set(scheme.rooms.map(r => r.floorplan || 'Floorplan 1'));
    return Array.from(floorplans).sort();
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

      {schemes.map((scheme, schemeIndex) => {
        const floorplanGroups = groupRoomsByFloorplan(scheme.rooms);
        const usedFloorplans = getUsedFloorplans(scheme);
        const newFloorplanName = newFloorplanNames[schemeIndex] ?? '';

        return (
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

            {/* Floorplan Groups */}
            {floorplanGroups.length > 0 && (
              <div className="space-y-6 mb-4">
                {floorplanGroups.map((group, groupIndex) => {
                  const roomIndices = scheme.rooms
                    .map((room, idx) => ({ room, idx }))
                    .filter(({ room }) => (room.floorplan || 'Floorplan 1') === group.floorplan)
                    .map(({ idx }) => idx);

                  const isEditingThis =
                    editingFloorplan?.schemeIndex === schemeIndex &&
                    editingFloorplan?.oldName === group.floorplan;

                  return (
                    <div key={groupIndex} className="pl-4 border-l-2 border-blue-400 dark:border-blue-500">
                      {/* Floorplan Header — editable label */}
                      <div className="flex items-center gap-2 mb-3">
                        {isEditingThis ? (
                          <>
                            <input
                              type="text"
                              value={editingFloorplan!.newName}
                              onChange={(e) =>
                                setEditingFloorplan(prev => prev ? { ...prev, newName: e.target.value } : null)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  renameFloorplan(schemeIndex, group.floorplan, editingFloorplan!.newName);
                                  setEditingFloorplan(null);
                                }
                                if (e.key === 'Escape') setEditingFloorplan(null);
                              }}
                              autoFocus
                              className="px-2 py-1 text-sm font-semibold bg-gray-50 dark:bg-[#0F172A] border border-blue-400 rounded text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                renameFloorplan(schemeIndex, group.floorplan, editingFloorplan!.newName);
                                setEditingFloorplan(null);
                              }}
                              className="text-green-600 hover:text-green-700 dark:text-green-400"
                              title="Save name"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFloorplan(null)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {group.floorplan}
                            </h4>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingFloorplan({ schemeIndex, oldName: group.floorplan, newName: group.floorplan })
                              }
                              className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              title="Rename floorplan"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFloorplan(schemeIndex, group.floorplan)}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1"
                              title="Remove this floorplan and its rooms"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Rooms under this floorplan */}
                      <div className="space-y-3">
                        {roomIndices.map((roomIndex) => {
                          const room = scheme.rooms[roomIndex];
                          return (
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
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => addRoomToFloorplan(schemeIndex, group.floorplan)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          + Add Room to {group.floorplan}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Floorplan — free-text label + button */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Floorplan name (e.g. Floorplan A, 2BR Unit…)"
                value={newFloorplanName}
                onChange={(e) =>
                  setNewFloorplanNames(prev => ({ ...prev, [schemeIndex]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFloorplan(schemeIndex);
                  }
                }}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => addFloorplan(schemeIndex)}
                disabled={!newFloorplanName.trim() || usedFloorplans.includes(newFloorplanName.trim())}
                className="inline-flex items-center px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Floorplan
              </button>
            </div>
            {newFloorplanName.trim() && usedFloorplans.includes(newFloorplanName.trim()) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-1">
                A floorplan with this name already exists.
              </p>
            )}
          </div>
        );
      })}

      {/* Add Paint Type Button */}
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
