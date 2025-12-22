import { supabase } from '../utils/supabase';
import { PaintScheme } from './types';

/**
 * Get paint schemes for a property from the properties table
 */
export async function getPaintSchemesByProperty(propertyId: string): Promise<PaintScheme[]> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('paint_colors')
      .eq('id', propertyId)
      .single();

    if (error) {
      console.error('Error fetching paint schemes:', error);
      throw error;
    }

    return data?.paint_colors || [];
  } catch (error) {
    console.error('Error fetching paint schemes:', error);
    return [];
  }
}

/**
 * Save paint schemes to the properties table
 */
export async function savePaintSchemes(propertyId: string, schemes: PaintScheme[]): Promise<void> {
  try {
    console.log('Saving paint schemes for property:', propertyId, schemes);
    
    // Filter out empty schemes and clean the data
    const validSchemes = schemes.filter(scheme => 
      scheme.paint_type && 
      scheme.rooms && 
      scheme.rooms.length > 0 &&
      scheme.rooms.every(room => room.room?.trim() && room.color?.trim())
    );

    // Clean and trim the data
    const cleanedSchemes = validSchemes.map(scheme => ({
      paint_type: scheme.paint_type.trim(),
      rooms: scheme.rooms
        .filter(room => room.room?.trim() && room.color?.trim())
        .map(room => ({
          room: room.room.trim(),
          color: room.color.trim()
        }))
    }));

    console.log('Cleaned schemes to save:', cleanedSchemes);

    const { error } = await supabase
      .from('properties')
      .update({ paint_colors: cleanedSchemes })
      .eq('id', propertyId);

    if (error) {
      console.error('Error updating properties table:', error);
      throw error;
    }

    console.log('Paint schemes saved successfully');
  } catch (error) {
    console.error('Error saving paint schemes:', error);
    throw error;
  }
}

/**
 * Get all available paint types
 */
export async function getPaintTypes(): Promise<string[]> {
  return [
    'Regular Paint',
    'Color Change', 
    'Touch Up',
    'Full Repaint',
    'Primer Only'
  ];
}

/**
 * Get the next available paint type for a property
 */
export async function getNextAvailablePaintType(propertyId: string): Promise<string> {
  try {
    const existingSchemes = await getPaintSchemesByProperty(propertyId);
    const allPaintTypes = await getPaintTypes();
    
    if (existingSchemes.length === 0) {
      return allPaintTypes[0] || '';
    }

    const usedPaintTypes = new Set(existingSchemes.map(s => s.paint_type));
    
    // Find first unused paint type
    for (const paintType of allPaintTypes) {
      if (!usedPaintTypes.has(paintType)) {
        return paintType;
      }
    }

    // All paint types are used, return first one as default
    return allPaintTypes[0] || '';
  } catch (error) {
    console.error('Error getting next available paint type:', error);
    return '';
  }
}
