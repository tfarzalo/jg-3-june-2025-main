import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import NewWorkOrderSpanish from './NewWorkOrderSpanish';
import { 
  ArrowLeft, 
  Building2, 
  FileText, 
  Calendar, 
  Save, 
  AlertCircle,
  Info,
  Globe
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatDate } from '../lib/dateUtils';
import { toast } from 'sonner';
import ImageUpload from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { useSubcontractorPreview } from '../contexts/SubcontractorPreviewContext';
import { toast as hotToast } from 'react-hot-toast';
import { withSubcontractorAccessCheck } from './withSubcontractorAccessCheck';
import { useUserRole } from '../contexts/UserRoleContext';
import { formatCurrency } from '../lib/utils/formatUtils';
import { prepareCeilingAccentUpdate } from '../lib/workOrders/prepareCeilingAccentUpdate';


interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  property: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  } | null;
  unit_size: {
    id: string;
    unit_size_label: string;
  } | null;
  job_type: {
    id: string;
    job_type_label: string;
  } | null;
  job_phase: {
    id: string;
    job_phase_label: string;
    color_dark_mode: string;
  } | null;
  work_order?: WorkOrder;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  ceiling_mode?: 'unit_size' | 'individual'; // New field for ceiling mode
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: string;
  accent_wall_count: number;
  has_extra_charges: boolean;
  extra_charges_description: string;
  extra_hours: number;
  additional_comments: string;
  created_by: string;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

interface WorkOrder {
  id: string;
  job_id: string;
  prepared_by: string;
  submission_date: string;
  unit_number: string;
  unit_size?: string;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_type?: string;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  ceiling_display_label?: string | null; // Display label for ceiling option
  ceiling_billing_detail_id?: string | null; // Billing detail ID for ceiling
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: string;
  accent_wall_count: number;
  accent_wall_billing_detail_id?: string | null; // Billing detail ID for accent wall
  has_extra_charges: boolean;
  extra_charges_description: string;
  extra_hours: number;
  additional_comments: string;
  additional_services?: Record<string, any>;
}

interface JobCategory {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

// Database-safe work order payload interface
interface WorkOrderDBPayload {
  job_id: string;
  unit_number: string;
  unit_size: string; // UUID from unit_sizes table
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  ceiling_display_label?: string | null; // Display label for ceiling option
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: 'Custom' | 'Paint Over' | null;
  accent_wall_count: number;
  has_extra_charges: boolean;
  extra_charges_description: string;
  extra_hours: number;
  additional_comments: string;
  prepared_by: string;
  ceiling_billing_detail_id?: string | null;
  accent_wall_billing_detail_id?: string | null;
  bill_amount?: number | null;
  sub_pay_amount?: number | null;
  profit_amount?: number | null;
  is_hourly?: boolean;
  additional_services?: Record<string, any>;
}

// Billing detail interface for ceilings and accent walls
interface BillingDetailPayload {
  property_id: string;
  category_id: string;
  unit_size_id: string;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number | null;
  is_hourly: boolean;
}

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Helper functions for data transformation
const toDbNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// Helper function to get display label for ceiling options
const getCeilingDisplayLabel = (ceilingValue: string | number, ceilingOptions: any[]): string => {
  if (ceilingValue === 'individual') {
    return 'Paint Individual Ceiling';
  }
  
  if (typeof ceilingValue === 'string' && ceilingValue !== '') {
    // Find the billing detail option
    const option = ceilingOptions.find(opt => opt.id === ceilingValue);
    if (option) {
      const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label;
      if (unitSizeLabel) {
        return unitSizeLabel;
      }
    }
  }
  
  return 'Select ceiling option';
};

const sanitizeAccentType = (type: any): 'Custom' | 'Paint Over' | null => {
  if (!type || typeof type !== 'string') return null;
  const cleanType = type.trim();
  if (cleanType === 'Custom' || cleanType === 'Paint Over') return cleanType;
  return null;
};

const toDbUnitSize = (unitSize: any): string => {
  if (!unitSize) return '';
  
  // Prefer .unit_size_label if available (this is what the database constraint expects)
  if (unitSize.unit_size_label && typeof unitSize.unit_size_label === 'string') {
    return unitSize.unit_size_label;
  }
  
  // Fall back to .code if available
  if (unitSize.code && typeof unitSize.code === 'string') {
    return unitSize.code;
  }
  
  // Fall back to .name or .label
  if (unitSize.name && typeof unitSize.name === 'string') {
    return unitSize.name;
  }
  
  // Last resort: convert to string
  if (unitSize.id && typeof unitSize.id === 'string') {
    return unitSize.id;
  }
  
  return String(unitSize);
};

// Build a whitelisted dbPayload (snake_case only; strip undefined)
const buildWhitelistedPayload = (payload: any): Record<string, any> => {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
  }
  
  // Ensure individual_ceiling_count is properly handled
  if (payload.individual_ceiling_count !== undefined) {
    result.individual_ceiling_count = payload.individual_ceiling_count;
  }
  
  return result;
};

// Utility functions for cleaning payload data
const nilIfEmpty = <T extends string | null | undefined>(v: T): T extends string ? string | null : T => {
  return (v === '' || v === undefined ? null : v) as T extends string ? string | null : T;
};

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? v.trim() : v;
  if (n === '' || n === null || n === undefined) return null;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : null;
};

// Utility functions for building and validating DB payloads
const buildWorkOrderPayload = (
  formData: any, 
  job: Job, 
  ceilingBillingDetailId?: string, 
  accentWallBillingDetailId?: string,
  ceilingPaintOptions: any[] = [],
  accentWallOptions: any[] = [],
  dynamicFormValues: Record<string, any> = {},
  unitSizes: UnitSize[] = []
): WorkOrderDBPayload => {
  // Build additional services payload
  const additionalServices: Record<string, any> = {};
  Object.entries(dynamicFormValues).forEach(([categoryId, values]) => {
    if (values.checked) {
      additionalServices[categoryId] = {
        quantity: values.quantity,
        billing_detail_id: values.billingDetailId,
        description: values.description
      };
    }
  });

  // Build the base payload with proper type casting using helper functions
  const payload: WorkOrderDBPayload = {
    job_id: job.id,
    unit_number: formData.unit_number,
    unit_size: (() => {
      // If formData has unit_size_id, find the label
      if (formData.unit_size_id) {
        const found = unitSizes.find(u => u.id === formData.unit_size_id);
        if (found) return found.unit_size_label;
      }
      return toDbUnitSize(job.unit_size);
    })(),
    is_occupied: formData.is_occupied ?? false,
    is_full_paint: formData.is_full_paint ?? false,
    job_category_id: formData.job_category_id,
    has_sprinklers: formData.has_sprinklers ?? false,
    sprinklers_painted: formData.sprinklers_painted ?? false,
    painted_ceilings: formData.painted_ceilings ?? false,
    ceiling_rooms_count: (() => {
      // Always set to 0 for both service-based and individual ceiling painting
      // The actual pricing/counting is handled by billing_detail_id and individual_ceiling_count
      return 0;
    })(),
    individual_ceiling_count: (() => {
      if (formData.painted_ceilings && formData.ceiling_mode === 'individual') {
        const result = numOrNull(formData.individual_ceiling_count);
        console.log('🔍 Individual Ceiling Count Debug:');
        console.log('  - formData.painted_ceilings:', formData.painted_ceilings);
        console.log('  - formData.ceiling_mode:', formData.ceiling_mode);
        console.log('  - formData.individual_ceiling_count:', formData.individual_ceiling_count);
        console.log('  - numOrNull result:', result);
        return result;
      }
      return null;
    })(),
    ceiling_display_label: (() => {
      if (formData.painted_ceilings) {
        if (formData.ceiling_mode === 'individual') {
          return 'Paint Individual Ceiling';
        } else if (formData.ceiling_rooms_count && typeof formData.ceiling_rooms_count === 'string') {
          // Find the billing detail option to get the display label
          const option = ceilingPaintOptions.find(opt => opt.id === formData.ceiling_rooms_count);
          if (option) {
            const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label;
            if (unitSizeLabel) {
              return unitSizeLabel;
            }
          }
        }
      }
      return null;
    })(),
    painted_patio: formData.painted_patio ?? false,
    painted_garage: formData.painted_garage ?? false,
    painted_cabinets: formData.painted_cabinets ?? false,
    painted_crown_molding: formData.painted_crown_molding ?? false,
    painted_front_door: formData.painted_front_door ?? false,
    has_accent_wall: formData.has_accent_wall ?? false,
    accent_wall_type: (() => {
      if (formData.has_accent_wall && formData.accent_wall_type) {
        // Find the option to get the label
        const option = accentWallOptions.find(opt => opt.id === formData.accent_wall_type);
        if (option) {
          const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label;
          if (unitSizeLabel) {
            // Map unit size label to accent wall type based on billing amount or label content
            // Lower billing amount typically means "Paint Over", higher means "Custom"
            if (option.bill_amount && option.bill_amount <= 100) {
              return 'Paint Over';
            } else if (option.bill_amount && option.bill_amount > 100) {
              return 'Custom';
            } else if (unitSizeLabel.includes('1') || unitSizeLabel.includes('Basic')) {
              return 'Paint Over';
            } else if (unitSizeLabel.includes('2') || unitSizeLabel.includes('Custom')) {
              return 'Custom';
            }
            // Fallback to the unit size label if no clear mapping
            return unitSizeLabel;
          }
        }
        return null;
      }
      return null;
    })(),
    accent_wall_count: (() => {
      if (formData.has_accent_wall && formData.accent_wall_count) {
        return numOrNull(formData.accent_wall_count);
      }
      return null;
    })(),
    has_extra_charges: formData.has_extra_charges ?? false,
    extra_charges_description: formData.extra_charges_description || '',
    extra_hours: toDbNumber(formData.extra_hours) || 0,
    additional_comments: formData.additional_comments || '',
    prepared_by: '', // Will be set during submission - this gets overridden
    ceiling_billing_detail_id: nilIfEmpty(ceilingBillingDetailId),
    accent_wall_billing_detail_id: nilIfEmpty(accentWallBillingDetailId),
    additional_services: Object.keys(additionalServices).length > 0 ? additionalServices : undefined
  };

  // === FINAL PAYLOAD LOGGING ===
  console.log('=== FINAL WORK ORDER PAYLOAD LOGGING ===');
  console.log('📋 Complete payload to be sent to work_orders table:');
  console.log('   - job_id:', payload.job_id);
  console.log('   - unit_number:', payload.unit_number);
  console.log('   - unit_size:', payload.unit_size);
  console.log('   - painted_ceilings:', payload.painted_ceilings);
  console.log('   - ceiling_rooms_count:', payload.ceiling_rooms_count);
  console.log('   - ceiling_billing_detail_id:', payload.ceiling_billing_detail_id);
  console.log('   - individual_ceiling_count:', payload.individual_ceiling_count);
  console.log('   - ceiling_display_label:', payload.ceiling_display_label);
  console.log('   - has_accent_wall:', payload.has_accent_wall);
  console.log('   - accent_wall_type:', payload.accent_wall_type);
  console.log('   - accent_wall_billing_detail_id:', payload.accent_wall_billing_detail_id);
  console.log('   - accent_wall_count:', payload.accent_wall_count);
  console.log('   - has_extra_charges:', payload.has_extra_charges);
  console.log('   - extra_hours:', payload.extra_hours);
  console.log('   - job_category_id:', payload.job_category_id);
  console.log('   - prepared_by:', payload.prepared_by);
  console.log('=== END FINAL PAYLOAD LOGGING ===');

  // IMPORTANT: When options are toggled off, clear the fields
  if (!payload.painted_ceilings) {
    payload.ceiling_billing_detail_id = null;
    payload.ceiling_display_label = null;
    payload.individual_ceiling_count = null;
  }
  if (!payload.has_accent_wall) {
    payload.accent_wall_billing_detail_id = null;
    payload.accent_wall_type = null;
    payload.accent_wall_count = null;
  }

  // Log payload for debugging
  console.log('Built work order payload:', payload);
  console.log('Payload keys and types:', Object.entries(payload).map(([key, value]) => 
    `${key}: ${typeof value} = ${value}`
  ));

  return payload;
};

const validateWorkOrderPayload = (payload: WorkOrderDBPayload, accentWallOptions: any[] = []): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!payload.job_id) errors.push('Job ID is required');
  if (!payload.unit_number) errors.push('Unit number is required');
  if (!payload.unit_size) errors.push('Unit size is required');
  if (!payload.job_category_id || payload.job_category_id === '') errors.push('Job category is required');
  if (!payload.prepared_by) errors.push('Prepared by is required');

  // Validate ceiling and accent wall constraints
  if (payload.painted_ceilings && payload.ceiling_display_label === 'Paint Individual Ceiling' && (!payload.individual_ceiling_count || payload.individual_ceiling_count <= 0)) {
    console.log('🔍 Individual Ceiling Validation Debug:');
    console.log('  - painted_ceilings:', payload.painted_ceilings);
    console.log('  - ceiling_display_label:', payload.ceiling_display_label);
    console.log('  - individual_ceiling_count:', payload.individual_ceiling_count);
    console.log('  - individual_ceiling_count type:', typeof payload.individual_ceiling_count);
    errors.push('Individual ceiling count must be greater than 0 when "Paint Individual Ceiling" is selected');
  }
  
  if (payload.has_accent_wall && (!payload.accent_wall_count || payload.accent_wall_count <= 0)) {
    errors.push('Accent wall count must be greater than 0 when accent wall is selected');
  }

  // Validate accent wall type constraint - check if it's a valid option from the property's billing details
  if (payload.accent_wall_type) {
    // Check if the accent wall type is one of the allowed values
    const validAccentWallTypes = ['Custom', 'Paint Over'];
    if (!validAccentWallTypes.includes(payload.accent_wall_type)) {
      errors.push(`Invalid accent wall type: ${payload.accent_wall_type}. Must be a valid option from the property's billing details.`);
    }
  }

  // Validate billing amount constraints
  if (payload.bill_amount !== undefined || payload.sub_pay_amount !== undefined || payload.profit_amount !== undefined) {
    if (payload.is_hourly) {
      // Hourly case: profit_amount must be null
      if (payload.profit_amount !== null) {
        errors.push('For hourly rates, profit_amount must be null');
      }
      // If either bill_amount or sub_pay_amount is provided, both must be provided
      if ((payload.bill_amount !== undefined) !== (payload.sub_pay_amount !== undefined)) {
        errors.push('For hourly rates, both bill_amount and sub_pay_amount must be provided together');
      }
    } else {
      // Non-hourly case: all three must be provided and profit_amount = bill_amount - sub_pay_amount
      if (payload.bill_amount === undefined || payload.sub_pay_amount === undefined || payload.profit_amount === undefined) {
        errors.push('For non-hourly rates, all three billing amounts must be provided');
      } else if (payload.profit_amount !== null && payload.bill_amount !== null && payload.sub_pay_amount !== null && 
                 payload.profit_amount !== (payload.bill_amount - payload.sub_pay_amount)) {
        errors.push(`For non-hourly rates, profit_amount (${payload.profit_amount}) must equal bill_amount (${payload.bill_amount}) - sub_pay_amount (${payload.sub_pay_amount})`);
      }
    }
  }

  // Validate ceiling and accent wall billing detail IDs
  // For service-based ceiling painting, we need either a billing detail ID or individual ceiling count
  if (payload.painted_ceilings && !payload.ceiling_billing_detail_id && !payload.individual_ceiling_count) {
    warnings.push('Ceiling painting is enabled but no billing detail ID or individual ceiling count is set');
  }
  
  // Only validate individual ceiling count if it's actually provided and greater than 0
  if (payload.individual_ceiling_count !== null && payload.individual_ceiling_count !== undefined && payload.individual_ceiling_count > 0) {
    if (payload.individual_ceiling_count > 20) {
      errors.push('Individual ceiling count cannot exceed 20');
    }
  }
  if (payload.has_accent_wall && payload.accent_wall_count > 0 && !payload.accent_wall_billing_detail_id) {
    warnings.push('Accent wall is enabled but no billing detail ID is set');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

const createOrUpdateBillingDetail = async (
  billingDetail: BillingDetailPayload,
  existingId?: string
): Promise<string> => {
  try {
    if (existingId) {
      // Update existing billing detail
      const { data, error } = await supabase
        .from('billing_details')
        .update(billingDetail)
        .eq('id', existingId)
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Create new billing detail
      const { data, error } = await supabase
        .from('billing_details')
        .insert([billingDetail])
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    console.error('Error creating/updating billing detail:', error);
    throw error;
  }
};

// Helper function to create billing details and return IDs
const createBillingDetailsForWorkOrder = async (
  propertyId: string,
  formData: any,
  ceilingPaintOptions: any[],
  accentWallOptions: any[]
): Promise<{ ceilingBillingDetailId: string | null; accentWallBillingDetailId: string | null }> => {
  let ceilingBillingDetailId: string | null = null;
  let accentWallBillingDetailId: string | null = null;

  try {
    // === PAINTED CEILINGS LOGGING ===
    console.log('=== PAINTED CEILINGS LOGGING ===');
    console.log('Form Data - painted_ceilings:', formData.painted_ceilings);
    console.log('Form Data - ceiling_rooms_count:', formData.ceiling_rooms_count);
    console.log('Form Data - individual_ceiling_count:', formData.individual_ceiling_count);
    console.log('Form Data - ceiling_rooms_count type:', typeof formData.ceiling_rooms_count);
    
    if (formData.painted_ceilings) {
      if (formData.ceiling_mode === 'individual' && formData.individual_ceiling_count) {
        // User selected individual ceiling painting - find existing billing detail
        console.log('✅ Individual ceiling painting selected');
        console.log('📊 Data to be stored in work_orders table:');
        console.log('   - painted_ceilings: true');
        console.log('   - ceiling_rooms_count: 0 (always 0 for individual)');
        console.log('   - individual_ceiling_count:', formData.individual_ceiling_count);
        console.log('   - ceiling_display_label: Paint Individual Ceiling');
        
        // Find existing "Paint Individual Ceiling" billing detail for this property
        const perCeilingOption = ceilingPaintOptions.find(option => 
          option.unit_sizes?.[0]?.unit_size_label === 'Paint Individual Ceiling'
        );

        if (perCeilingOption) {
          // Use existing billing detail
          ceilingBillingDetailId = perCeilingOption.id;
          console.log('   - ceiling_billing_detail_id:', ceilingBillingDetailId);
          console.log('✅ Using existing per-ceiling billing detail');
        } else {
          console.log('   - ceiling_billing_detail_id: null (NOT FOUND)');
          console.log('❌ No existing per-ceiling billing detail found');
        }
      } else if (formData.ceiling_mode === 'unit_size' && formData.ceiling_rooms_count) {
        // User selected unit size ceiling painting - use that ID directly
        ceilingBillingDetailId = formData.ceiling_rooms_count;
        console.log('✅ Unit size ceiling selected');
        console.log('📊 Data to be stored in work_orders table:');
        console.log('   - painted_ceilings: true');
        console.log('   - ceiling_rooms_count: 0 (always 0 for service-based)');
        console.log('   - ceiling_billing_detail_id:', ceilingBillingDetailId);
        console.log('   - individual_ceiling_count: null');
      }
    } else {
      console.log('❌ No ceiling painting selected');
      console.log('📊 Data to be stored in work_orders table:');
      console.log('   - painted_ceilings: false');
      console.log('   - ceiling_rooms_count: 0');
      console.log('   - ceiling_billing_detail_id: null');
      console.log('   - individual_ceiling_count: null');
    }
    console.log('=== END PAINTED CEILINGS LOGGING ===');

    // === ACCENT WALL LOGGING ===
    console.log('=== ACCENT WALL LOGGING ===');
    console.log('Form Data - has_accent_wall:', formData.has_accent_wall);
    console.log('Form Data - accent_wall_type:', formData.accent_wall_type);
    console.log('Form Data - accent_wall_count:', formData.accent_wall_count);
    console.log('Form Data - accent_wall_type type:', typeof formData.accent_wall_type);
    
    if (formData.has_accent_wall && formData.accent_wall_type) {
      if (typeof formData.accent_wall_type === 'string' && formData.accent_wall_type !== 'individual') {
        // User selected an existing accent wall option - use that ID directly
        accentWallBillingDetailId = formData.accent_wall_type;
        console.log('✅ Service-based accent wall selected');
        console.log('📊 Data to be stored in work_orders table:');
        console.log('   - has_accent_wall: true');
        console.log('   - accent_wall_type: null (always null for service-based)');
        console.log('   - accent_wall_billing_detail_id:', accentWallBillingDetailId);
        console.log('   - accent_wall_count: 0 (not applicable for service-based)');
      } else if (formData.accent_wall_type && formData.accent_wall_count) {
        // User selected a service-based accent wall - find existing billing detail
        console.log('✅ Service-based accent wall selected');
        console.log('📊 Data to be stored in work_orders table:');
        console.log('   - has_accent_wall: true');
        console.log('   - accent_wall_type:', formData.accent_wall_type);
        console.log('   - accent_wall_count:', formData.accent_wall_count);
        
        // Find the selected accent wall option
        const selectedAccentOption = accentWallOptions.find(option => option.id === formData.accent_wall_type);

        if (selectedAccentOption) {
          // Use existing billing detail
          accentWallBillingDetailId = selectedAccentOption.id;
          console.log('   - accent_wall_billing_detail_id:', accentWallBillingDetailId);
          console.log('✅ Using existing accent wall billing detail');
        } else {
          console.log('   - accent_wall_billing_detail_id: null (NOT FOUND)');
          console.log('❌ No existing accent wall billing detail found');
          console.log('⚠️ Accent walls will not have billing rates until billing detail is created');
        }
      }
    } else {
      console.log('❌ No accent wall selected');
      console.log('📊 Data to be stored in work_orders table:');
      console.log('   - has_accent_wall: false');
      console.log('   - accent_wall_type: null');
      console.log('   - accent_wall_billing_detail_id: null');
      console.log('   - accent_wall_count: 0');
    }
    console.log('=== END ACCENT WALL LOGGING ===');

    return { ceilingBillingDetailId, accentWallBillingDetailId };
  } catch (error) {
    console.error('Error creating billing details:', error);
    throw error;
  }
};

const getBillingDetailForCeiling = async (
  propertyId: string,
  ceilingBillingDetailId: string
): Promise<BillingDetailPayload | null> => {
  try {
    const { data, error } = await supabase
      .from('billing_details')
      .select('*')
      .eq('id', ceilingBillingDetailId)
      .eq('property_id', propertyId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      property_id: data.property_id,
      category_id: data.category_id,
      unit_size_id: data.unit_size_id,
      bill_amount: data.bill_amount,
      sub_pay_amount: data.sub_pay_amount,
      profit_amount: data.profit_amount,
      is_hourly: data.is_hourly
    };
  } catch (error) {
    console.error('Error fetching ceiling billing detail:', error);
    return null;
  }
};

const getBillingDetailForAccentWall = async (
  propertyId: string,
  accentWallBillingDetailId: string
): Promise<BillingDetailPayload | null> => {
  try {
    const { data, error } = await supabase
      .from('billing_details')
      .select('*')
      .eq('id', accentWallBillingDetailId)
      .eq('property_id', propertyId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      property_id: data.property_id,
      category_id: data.category_id,
      unit_size_id: data.unit_size_id,
      bill_amount: data.bill_amount,
      sub_pay_amount: data.sub_pay_amount,
      profit_amount: data.profit_amount,
      is_hourly: data.is_hourly
    };
  } catch (error) {
    console.error('Error fetching accent wall billing detail:', error);
    return null;
  }
};

const translations = {
  en: {
    // Header
    addWorkOrder: 'Add Work Order',
    editWorkOrder: 'Edit Work Order',
    
    // Job Information
    jobInformation: 'Job Information',
    property: 'Property',
    workOrderNumber: 'Work Order #',
    unitNumber: 'Unit #',
    jobType: 'Job Type',
    unitSize: 'Unit Size',
    scheduledDate: 'Scheduled Date',
    
    // Unit Information
    unitInformation: 'Unit Information',
    jobCategory: 'Job Category',
    selectJobCategory: 'Select a job category',
    unitIsOccupied: 'Unit is Occupied',
    required: '*',
    
    // Sprinklers
    sprinklers: 'Sprinklers',
    unitHasSprinklers: 'Unit Has Sprinklers',
    paintOnSprinklers: 'Paint on Sprinklers',
    sprinklerImages: 'Sprinkler Images',
    
    // Images
    beforeImages: 'Before Images',
    otherFiles: 'Other Files',
    additionalFiles: 'Additional Files (All File Types)',
    
    // Painted Items
    paintedItems: 'Painted Items',
    paintedCeilings: 'Painted Ceilings',
    numberOfRooms: 'Number of Rooms',
    paintedPatio: 'Painted Patio',
    paintedGarage: 'Painted Garage',
    paintedCabinets: 'Painted Cabinets',
    paintedCrownMolding: 'Painted Crown Molding',
    paintedFrontDoor: 'Painted Front Door',
    
    // Accent Wall
    accentWall: 'Accent Wall',
    accentWallType: 'Accent Wall Type',
    selectType: 'Select type',
    numberOfAccentWalls: 'Number of Accent Walls',
    custom: 'Custom',
    paintOver: 'Paint Over',
    
    // Extra Charges
    extraCharges: 'Extra Charges',
    extraChargesRequireApproval: 'Extra Charges Require Approval',
    extraChargesWarning: 'Adding extra charges will set this job to "Pending Work Order" status until the charges are approved.',
    description: 'Description',
    describeExtraCharges: 'Describe the extra charges',
    extraHours: 'Extra Hours',
    
    // Additional Comments
    additionalComments: 'Additional Comments',
    enterComments: 'Enter any additional comments or notes',
    
    // Actions
    cancel: 'Cancel',
    saving: 'Saving...',
    createWorkOrder: 'Create Work Order',
    updateWorkOrder: 'Update Work Order',
    returnToDashboard: 'Return to Dashboard',
    
    // Other
    workOrderImages: 'Work Order Images',
    notSpecified: 'Not specified',
    noBillableCategories: 'No billable categories available for this property. Please add billing details for the property first.',
    
    // Language
    language: 'Language',
    english: 'English',
    spanish: 'Español'
  },
  es: {
    // Header
    addWorkOrder: 'Agregar Orden de Trabajo',
    editWorkOrder: 'Editar Orden de Trabajo',
    
    // Job Information
    jobInformation: 'Información del Trabajo',
    property: 'Propiedad',
    workOrderNumber: 'Orden de Trabajo #',
    unitNumber: 'Unidad #',
    jobType: 'Tipo de Trabajo',
    unitSize: 'Tamaño de Unidad',
    scheduledDate: 'Fecha Programada',
    
    // Unit Information
    unitInformation: 'Información de la Unidad',
    jobCategory: 'Categoría del Trabajo',
    selectJobCategory: 'Seleccionar una categoría de trabajo',
    unitIsOccupied: 'La Unidad Está Ocupada',
    required: '*',
    
    // Sprinklers
    sprinklers: 'Aspersores',
    unitHasSprinklers: 'La Unidad Tiene Aspersores',
    paintOnSprinklers: 'Pintura en Aspersores',
    sprinklerImages: 'Imágenes de Aspersores',
    
    // Images
    beforeImages: 'Imágenes de Antes',
    otherFiles: 'Otros Archivos',
    additionalFiles: 'Archivos Adicionales (Todos los Tipos de Archivo)',
    
    // Painted Items
    paintedItems: 'Elementos Pintados',
    paintedCeilings: 'Techos Pintados',
    numberOfRooms: 'Número de Habitaciones',
    paintedPatio: 'Patio Pintado',
    paintedGarage: 'Garaje Pintado',
    paintedCabinets: 'Gabinetes Pintados',
    paintedCrownMolding: 'Moldura de Corona Pintada',
    paintedFrontDoor: 'Puerta Principal Pintada',
    
    // Accent Wall
    accentWall: 'Pared de Acento',
    accentWallType: 'Tipo de Pared de Acento',
    selectType: 'Seleccionar tipo',
    numberOfAccentWalls: 'Número de Paredes de Acento',
    custom: 'Personalizado',
    paintOver: 'Pintar Encima',
    
    // Extra Charges
    extraCharges: 'Cargos Adicionales',
    extraChargesRequireApproval: 'Los Cargos Adicionales Requieren Aprobación',
    extraChargesWarning: 'Agregar cargos adicionales establecerá este trabajo en estado "Orden de Trabajo Pendiente" hasta que los cargos sean aprobados.',
    description: 'Descripción',
    describeExtraCharges: 'Describir los cargos adicionales',
    extraHours: 'Horas Adicionales',
    
    // Additional Comments
    additionalComments: 'Comentarios Adicionales',
    enterComments: 'Ingrese cualquier comentario o nota adicional',
    
    // Actions
    cancel: 'Cancelar',
    saving: 'Guardando...',
    createWorkOrder: 'Crear Orden de Trabajo',
    updateWorkOrder: 'Actualizar Orden de Trabajo',
    returnToDashboard: 'Volver al Panel',
    
    // Other
    workOrderImages: 'Imágenes de la Orden de Trabajo',
    notSpecified: 'No especificado',
    noBillableCategories: 'No hay categorías facturables disponibles para esta propiedad. Por favor agregue primero los detalles de facturación para la propiedad.',
    
    // Language
    language: 'Idioma',
    english: 'English',
    spanish: 'Español'
  }
};

const NewWorkOrder = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const previewUserId = queryParams.get('userId');
  const isEditMode = queryParams.get('edit') === 'true';
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [loading, setLoading] = useState(true);
  const t = translations[language];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobPhases, setJobPhases] = useState<{ id: string; job_phase_label: string }[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [existingWorkOrder, setExistingWorkOrder] = useState<WorkOrder | null>(null);
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [refreshImages, setRefreshImages] = useState(0);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<Set<string>>(new Set());
  
  // Track file upload status
  const [uploadStatus, setUploadStatus] = useState<{
    [key: string]: { isUploading: boolean; uploadedCount: number; totalCount: number };
  }>({});
  
  // Check if any files are currently uploading
  const isAnyFileUploading = Object.values(uploadStatus).some(status => status.isUploading);
  
  // Form state
  const [formData, setFormData] = useState({
    unit_number: '',
    is_occupied: false,
    is_full_paint: false,
    job_type: '',
    job_category_id: '',
    has_sprinklers: false,
    sprinklers: false,
    sprinklers_painted: false,
    painted_ceilings: false,
    unit_size_id: '',
    ceiling_rooms_count: '' as string | number,
    individual_ceiling_count: null as number | null, // New field for individual ceiling count
    ceiling_mode: 'unit_size' as 'unit_size' | 'individual', // Default to unit size mode
    painted_patio: false,
    painted_garage: false,
    painted_cabinets: false,
    painted_crown_molding: false,
    painted_front_door: false,
    has_accent_wall: false,
    accent_wall_type: '',
    accent_wall_count: 0,
    has_extra_charges: false,
    extra_charges_description: '',
    extra_hours: 0,
    additional_comments: ''
  });

  const { previewUserId: subcontractorPreviewUserId } = useSubcontractorPreview();
  const { role, isAdmin, isJGManagement, isSubcontractor } = useUserRole();

  // State for dynamic billing options
  const [dynamicServices, setDynamicServices] = useState<Array<{
    id: string;
    name: string;
    options: Array<{
      id: string;
      unit_size_id: string;
      bill_amount: number;
      sub_pay_amount: number;
      unit_sizes: { unit_size_label: string }[];
    }>;
  }>>([]);
  
  const [dynamicFormValues, setDynamicFormValues] = useState<Record<string, {
    checked: boolean;
    quantity: number;
    billingDetailId: string;
    description: string;
  }>>({});

  const [ceilingPaintOptions, setCeilingPaintOptions] = useState<Array<{
    id: string, 
    unit_size_id: string, 
    bill_amount: number, 
    sub_pay_amount: number,
    unit_sizes: { unit_size_label: string }[]
  }>>([]);
  const [accentWallOptions, setAccentWallOptions] = useState<Array<{
    id: string, 
    unit_size_id: string, 
    bill_amount: number, 
    sub_pay_amount: number,
    unit_sizes: { unit_size_label: string }[]
  }>>([]);
  const [billingOptionsLoading, setBillingOptionsLoading] = useState(false);
  
  // State for selected billing details
  const [selectedCeilingBillingDetailId, setSelectedCeilingBillingDetailId] = useState<string | null>(null);
  const [selectedAccentWallBillingDetailId, setSelectedAccentWallBillingDetailId] = useState<string | null>(null);
  const [ceilingDisplayLabel, setCeilingDisplayLabel] = useState<string | null>(null);
  
  // State for tracking uploaded images
  const [beforeImagesUploaded, setBeforeImagesUploaded] = useState(false);
  const [sprinklerImagesUploaded, setSprinklerImagesUploaded] = useState(false);
  const [accentWallDisplayLabel, setAccentWallDisplayLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      navigate('/dashboard/subcontractor');
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // First fetch unit sizes since we need them for the form
        await fetchUnitSizes();
        // Then fetch the rest of the data
        await Promise.all([
          fetchJob(),
          fetchJobPhases(),
          fetchExistingWorkOrder()
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    };

    void fetchData();
  }, [jobId, navigate]);
  
  useEffect(() => {
    if (existingWorkOrder) {
      // Determine ceiling mode based on ceiling display label
      const ceilingMode = existingWorkOrder.ceiling_display_label === 'Paint Individual Ceiling' ? 'individual' : 'unit_size';
      
      // For ceiling_rooms_count, use the billing_detail_id if in unit_size mode, or 'individual' if in individual mode
      const ceilingRoomsCountValue = ceilingMode === 'individual' 
        ? 'individual' 
        : (existingWorkOrder.ceiling_billing_detail_id || '');
      
      setFormData({
        unit_number: existingWorkOrder.unit_number || '',
        unit_size_id: (unitSizes.find(u => u.unit_size_label === existingWorkOrder.unit_size)?.id || job?.unit_size?.id || ''),
        is_occupied: existingWorkOrder.is_occupied ?? false,
        is_full_paint: existingWorkOrder.is_full_paint ?? false,
        job_type: existingWorkOrder.job_type || '',
        job_category_id: existingWorkOrder.job_category_id || '',
        has_sprinklers: existingWorkOrder.has_sprinklers ?? false,
        sprinklers: existingWorkOrder.has_sprinklers ?? false,
        sprinklers_painted: existingWorkOrder.sprinklers_painted ?? false,
        painted_ceilings: existingWorkOrder.painted_ceilings ?? false,
        ceiling_rooms_count: ceilingRoomsCountValue,
        individual_ceiling_count: existingWorkOrder.individual_ceiling_count ?? null,
        ceiling_mode: ceilingMode,
        painted_patio: existingWorkOrder.painted_patio ?? false,
        painted_garage: existingWorkOrder.painted_garage ?? false,
        painted_cabinets: existingWorkOrder.painted_cabinets ?? false,
        painted_crown_molding: existingWorkOrder.painted_crown_molding ?? false,
        painted_front_door: existingWorkOrder.painted_front_door ?? false,
        has_accent_wall: existingWorkOrder.has_accent_wall ?? false,
        accent_wall_type: existingWorkOrder.accent_wall_billing_detail_id || '',
        accent_wall_count: existingWorkOrder.accent_wall_count ?? 0,
        has_extra_charges: existingWorkOrder.has_extra_charges ?? false,
        extra_charges_description: existingWorkOrder.extra_charges_description || '',
        extra_hours: existingWorkOrder.extra_hours ?? 0,
        additional_comments: existingWorkOrder.additional_comments || ''
      });

      // Load dynamic services values
      if (existingWorkOrder.additional_services) {
        const services = existingWorkOrder.additional_services as Record<string, any>;
        const newValues: Record<string, any> = {};
        
        Object.entries(services).forEach(([categoryId, data]) => {
          newValues[categoryId] = {
            checked: true,
            quantity: data.quantity || 1,
            billingDetailId: data.billing_detail_id || '',
            description: data.description || ''
          };
        });
        setDynamicFormValues(newValues);
      }
      
      // Set the new state variables for ceiling billing details
      setSelectedCeilingBillingDetailId(existingWorkOrder.ceiling_billing_detail_id || null);
      setCeilingDisplayLabel(existingWorkOrder.ceiling_display_label || null);
      
      // Set the new state variables for accent wall billing details
      setSelectedAccentWallBillingDetailId(existingWorkOrder.accent_wall_billing_detail_id || null);
      setAccentWallDisplayLabel(existingWorkOrder.accent_wall_type || null);
    } else if (job) {
      setFormData({
        unit_number: job.unit_number || '',
        unit_size_id: job.unit_size?.id || '',
        is_occupied: job.is_occupied ?? false,
        is_full_paint: job.is_full_paint ?? false,
        job_type: job.job_type?.job_type_label || '',
        job_category_id: job.job_category_id || '',
        has_sprinklers: job.has_sprinklers ?? false,
        sprinklers: job.has_sprinklers ?? false,
        sprinklers_painted: job.sprinklers_painted ?? false,
        painted_ceilings: job.painted_ceilings ?? false,
        ceiling_rooms_count: job.ceiling_rooms_count || '',
        individual_ceiling_count: job.individual_ceiling_count ?? null,
        painted_patio: job.painted_patio ?? false,
        painted_garage: job.painted_garage ?? false,
        painted_cabinets: job.painted_cabinets ?? false,
        painted_crown_molding: job.painted_crown_molding ?? false,
        painted_front_door: job.painted_front_door ?? false,
        has_accent_wall: job.has_accent_wall ?? false,
        accent_wall_type: job.accent_wall_type || '',
        accent_wall_count: job.accent_wall_count ?? 0,
        has_extra_charges: job.has_extra_charges ?? false,
        extra_charges_description: job.extra_charges_description || '',
        extra_hours: job.extra_hours ?? 0,
        additional_comments: job.additional_comments || '',
        ceiling_mode: 'unit_size' as 'unit_size' | 'individual'
      });
    }
  }, [existingWorkOrder, job]);

  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          property:properties(*),
          unit_size:unit_sizes(*),
          job_type:job_types(*),
          job_phase:job_phases(*)
        `)
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('Error fetching job:', error);
        throw error;
      }

      if (!data) {
        console.error('No job data found');
        throw new Error('Job not found');
      }

      // Map the job data to include all required fields
      const mappedJob: Job = {
        ...data,
        is_occupied: data.is_occupied ?? false,
        is_full_paint: data.is_full_paint ?? false,
        job_category: data.job_category ?? 'Regular Paint',
        has_sprinklers: data.has_sprinklers ?? false,
        sprinklers_painted: data.sprinklers_painted ?? false,
        painted_ceilings: data.painted_ceilings ?? false,
        ceiling_rooms_count: data.ceiling_rooms_count ?? 0,
        painted_patio: data.painted_patio ?? false,
        painted_garage: data.painted_garage ?? false,
        painted_cabinets: data.painted_cabinets ?? false,
        painted_crown_molding: data.painted_crown_molding ?? false,
        painted_front_door: data.painted_front_door ?? false,
        has_accent_wall: data.has_accent_wall ?? false,
        accent_wall_type: data.accent_wall_type ?? '',
        accent_wall_count: data.accent_wall_count ?? 0,
        has_extra_charges: data.has_extra_charges ?? false,
        extra_charges_description: data.extra_charges_description ?? '',
        extra_hours: data.extra_hours ?? 0,
        additional_comments: data.additional_comments ?? ''
      };

      setJob(mappedJob);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchJob:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch job details');
      setLoading(false);
    }
  };
  
  const fetchJobPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label')
        .order('sort_order');
        
      if (error) throw error;
      setJobPhases(data || []);
    } catch (err) {
      console.error('Error fetching job phases:', err);
    }
  };
  
  const fetchUnitSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('id, unit_size_label')
        .order('unit_size_label');
        
      if (error) throw error;
      console.log('Fetched unit sizes:', data);
      setUnitSizes(data || []);
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
    }
  };
  
  const fetchExistingWorkOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching existing work order:', error);
        return;
      }
      
      if (data) {
        setExistingWorkOrder(data as WorkOrder);
      }
    } catch (err) {
      console.error('Error fetching existing work order:', err);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Fetch property billing options for dynamic dropdowns
  const fetchPropertyBillingOptions = async () => {
    if (!job?.property?.id) return;
    
    console.log('Fetching billing options for property:', job.property.id);
    
    setBillingOptionsLoading(true);
    try {
      // Get billing categories for this property
      const { data: billingCategories, error: billingError } = await supabase
        .from('billing_categories')
        .select('id, name, include_in_work_order')
        .eq('property_id', job.property.id);

      if (billingError) throw billingError;

      if (!billingCategories || billingCategories.length === 0) {
        console.log('No billing categories found for this property');
        setCeilingPaintOptions([]);
        setAccentWallOptions([]);
        return;
      }

      console.log('Available billing categories:', billingCategories);
      console.log('Category names:', billingCategories.map(cat => cat.name));

      // Find ceiling paint, accent wall, and extra charges category IDs using exact names
      const ceilingCategory = billingCategories.find(cat => 
        cat.name === 'Painted Ceilings'
      );
      const accentCategory = billingCategories.find(cat => 
        cat.name === 'Accent Walls'
      );
      console.log('Ceiling category found:', ceilingCategory);
      console.log('Accent category found:', accentCategory);
      console.log('Job unit size:', job?.unit_size);
      console.log('Unit size ID:', job?.unit_size?.id);

      // --- Fetch Dynamic Services ---
      const dynamicCats = billingCategories.filter(cat => 
        cat.include_in_work_order === true && 
        cat.name !== 'Painted Ceilings' && 
        cat.name !== 'Accent Walls' &&
        cat.name !== 'Regular Paint'
      );

      const loadedDynamicServices: typeof dynamicServices = [];

      for (const cat of dynamicCats) {
        const { data: catOptions, error: catError } = await supabase
          .from('billing_details')
          .select(`
            id, 
            unit_size_id, 
            bill_amount, 
            sub_pay_amount
          `)
          .eq('property_id', job.property.id)
          .eq('category_id', cat.id)
          .eq('is_hourly', false)
          .order('bill_amount', { ascending: true });

        if (!catError && catOptions && catOptions.length > 0) {
          // Fetch unit sizes for labels
          const unitSizeIds = catOptions.map(item => item.unit_size_id);
          const { data: unitSizeData } = await supabase
            .from('unit_sizes')
            .select('id, unit_size_label')
            .in('id', unitSizeIds);

          const enrichedOptions = catOptions.map(opt => {
            const us = unitSizeData?.find(u => u.id === opt.unit_size_id);
            return {
              ...opt,
              unit_sizes: us ? [{ unit_size_label: us.unit_size_label }] : []
            };
          });

          loadedDynamicServices.push({
            id: cat.id,
            name: cat.name,
            options: enrichedOptions
          });
        }
      }
      setDynamicServices(loadedDynamicServices);
      // -----------------------------

      // Fetch ceiling paint options if category exists
      // Note: Painted Ceilings pricing is based on service complexity, not unit size
      if (ceilingCategory) {
        // First get the billing details
        const { data: ceilingData, error: ceilingError } = await supabase
          .from('billing_details')
          .select(`
            id, 
            unit_size_id, 
            bill_amount, 
            sub_pay_amount
          `)
          .eq('property_id', job.property.id)
          .eq('category_id', ceilingCategory.id)
          .eq('is_hourly', false)
          .order('bill_amount', { ascending: true });

        if (ceilingError) {
          console.error('Error fetching ceiling paint options:', ceilingError);
        } else {
          console.log('Ceiling paint options found:', ceilingData);
          
          // Then get the unit size labels for each billing detail
          if (ceilingData && ceilingData.length > 0) {
            const unitSizeIds = ceilingData.map(item => item.unit_size_id);
            const { data: unitSizeData, error: unitSizeError } = await supabase
              .from('unit_sizes')
              .select('id, unit_size_label')
              .in('id', unitSizeIds);

            if (!unitSizeError && unitSizeData) {
              // Merge the unit size labels with the billing details
              const enrichedData = ceilingData.map(billingItem => {
                const unitSize = unitSizeData.find(us => us.id === billingItem.unit_size_id);
                return {
                  ...billingItem,
                  unit_sizes: unitSize ? [{ unit_size_label: unitSize.unit_size_label }] : []
                };
              });
              
              // Sort the data manually to ensure correct order
              const sortedData = enrichedData.sort((a, b) => {
                // First sort by unit size label in the desired order
                const unitSizeOrder = ['Studio', '1 Bedroom', '2 Bedroom', '3+ Bedroom'];
                const aIndex = unitSizeOrder.indexOf(a.unit_sizes?.[0]?.unit_size_label || '');
                const bIndex = unitSizeOrder.indexOf(b.unit_sizes?.[0]?.unit_size_label || '');
                
                if (aIndex !== -1 && bIndex !== -1) {
                  return aIndex - bIndex;
                }
                
                // Fallback to bill amount if unit size not in predefined order
                return (a.bill_amount || 0) - (b.bill_amount || 0);
              });
              
              console.log('Ceiling paint options with unit sizes:', enrichedData);
              console.log('Ceiling paint options sorted data:', sortedData.map(opt => ({
                id: opt.id,
                unit_size_label: opt.unit_sizes?.[0]?.unit_size_label,
                bill_amount: opt.bill_amount
              })));
              setCeilingPaintOptions(sortedData);
            } else {
              console.error('Error fetching unit sizes:', unitSizeError);
              // Add empty unit_sizes array to maintain compatibility
              const enrichedData = ceilingData.map(item => ({
                ...item,
                unit_sizes: []
              }));
              setCeilingPaintOptions(enrichedData);
            }
          } else {
            // Add empty unit_sizes array to maintain compatibility
            const enrichedData = (ceilingData || []).map(item => ({
              ...item,
              unit_sizes: []
            }));
            setCeilingPaintOptions(enrichedData);
          }
        }
      } else {
        console.log('No ceiling paint category found');
        setCeilingPaintOptions([]);
      }

      // Fetch accent wall options if category exists
      // Note: Accent Walls pricing is based on service complexity, not unit size
      if (accentCategory) {
        const { data: accentData, error: accentError } = await supabase
          .from('billing_details')
          .select(`
            id, 
            unit_size_id, 
            bill_amount, 
            sub_pay_amount
          `)
          .eq('property_id', job.property.id)
          .eq('category_id', accentCategory.id)
          .eq('is_hourly', false)
          .order('bill_amount', { ascending: true });

        if (accentError) {
          console.error('Error fetching accent wall options:', accentError);
        } else {
          console.log('Accent wall options found:', accentData);
          
          // Then get the unit size labels for each billing detail
          if (accentData && accentData.length > 0) {
            const unitSizeIds = accentData.map(item => item.unit_size_id);
            const { data: unitSizeData, error: unitSizeError } = await supabase
              .from('unit_sizes')
              .select('id, unit_size_label')
              .in('id', unitSizeIds);

            if (!unitSizeError && unitSizeData) {
              // Merge the unit size labels with the billing details
              const enrichedData = accentData.map(billingItem => {
                const unitSize = unitSizeData.find(us => us.id === billingItem.unit_size_id);
                return {
                  ...billingItem,
                  unit_sizes: unitSize ? [{ unit_size_label: unitSize.unit_size_label }] : []
                };
              });
              
              // Sort the data manually to ensure correct order
              const sortedData = enrichedData.sort((a, b) => {
                // First sort by unit size label in the desired order
                const unitSizeOrder = ['1 Bedroom', '2+ Bedroom'];
                const aIndex = unitSizeOrder.indexOf(a.unit_sizes?.[0]?.unit_size_label || '');
                const bIndex = unitSizeOrder.indexOf(b.unit_sizes?.[0]?.unit_size_label || '');
                
                if (aIndex !== -1 && bIndex !== -1) {
                  return aIndex - bIndex;
                }
                
                // Fallback to bill amount if unit size not in predefined order
                return (a.bill_amount || 0) - (b.bill_amount || 0);
              });
              
              console.log('Accent wall options with unit sizes:', enrichedData);
              console.log('Accent wall options sorted data:', sortedData.map(opt => ({
                id: opt.id,
                unit_size_label: opt.unit_sizes?.[0]?.unit_size_label,
                bill_amount: opt.bill_amount
              })));
              setAccentWallOptions(sortedData);
            } else {
              console.error('Error fetching unit sizes:', unitSizeError);
              // Add empty unit_sizes array to maintain compatibility
              const enrichedData = accentData.map(item => ({
                ...item,
                unit_sizes: []
              }));
              setAccentWallOptions(enrichedData);
            }
          } else {
            // Add empty unit_sizes array to maintain compatibility
            const enrichedData = (accentData || []).map(item => ({
              ...item,
              unit_sizes: []
            }));
            setAccentWallOptions(enrichedData);
          }
        }
      } else {
        console.log('No accent wall category found');
        setAccentWallOptions([]);
      }


    } catch (err) {
      console.error('Error fetching billing options:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing options');
    } finally {
      setBillingOptionsLoading(false);
    }
  };

  // Fetch billing options when job changes - following the same pattern as fetchJobCategories
  useEffect(() => {
    if (job?.property?.id) {
      console.log('Property loaded, fetching billing options...');
      fetchPropertyBillingOptions();
    }
  }, [job?.property?.id]);

  // Sync billing detail IDs with form data when billing options load after existing work order
  useEffect(() => {
    if (existingWorkOrder && ceilingPaintOptions.length > 0 && accentWallOptions.length > 0) {
      // Ensure ceiling dropdown has the correct value
      if (existingWorkOrder.painted_ceilings && existingWorkOrder.ceiling_billing_detail_id) {
        const ceilingMode = existingWorkOrder.ceiling_display_label === 'Paint Individual Ceiling' ? 'individual' : 'unit_size';
        const ceilingRoomsCountValue = ceilingMode === 'individual' 
          ? 'individual' 
          : existingWorkOrder.ceiling_billing_detail_id;
        
        // Only update if the value has changed to avoid infinite loops
        if (formData.ceiling_rooms_count !== ceilingRoomsCountValue) {
          setFormData(prev => ({
            ...prev,
            ceiling_rooms_count: ceilingRoomsCountValue
          }));
        }
      }
      
      // Ensure accent wall dropdown has the correct value
      if (existingWorkOrder.has_accent_wall && existingWorkOrder.accent_wall_billing_detail_id) {
        if (formData.accent_wall_type !== existingWorkOrder.accent_wall_billing_detail_id) {
          setFormData(prev => ({
            ...prev,
            accent_wall_type: existingWorkOrder.accent_wall_billing_detail_id || ''
          }));
        }
      }
    }
  }, [ceilingPaintOptions, accentWallOptions, existingWorkOrder]);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('ceilingPaintOptions state changed:', ceilingPaintOptions);
    console.log('ceilingPaintOptions details:', ceilingPaintOptions.map(opt => ({
      id: opt.id,
      bill_amount: opt.bill_amount,
      unit_size_label: opt.unit_sizes?.[0]?.unit_size_label || 'Unknown'
    })));
  }, [ceilingPaintOptions]);

  useEffect(() => {
    console.log('accentWallOptions state changed:', accentWallOptions);
    console.log('accentWallOptions details:', accentWallOptions.map(opt => ({
      id: opt.id,
      bill_amount: opt.bill_amount,
      unit_size_label: opt.unit_sizes?.[0]?.unit_size_label || 'Unknown'
    })));
  }, [accentWallOptions]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      if (!job) throw new Error('Job not found');

      // Get current user ID (needed for all flows)
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) throw new Error('User not authenticated');

      // Subcontractor: block insert if work order exists
      if (isSubcontractor && existingWorkOrder) {
        setError('A work order has already been submitted for this job. Please contact your manager if you need to make changes.');
        setSaving(false);
        return;
      }

      
      // Use the new billing lookup system for ceilings and accent walls
      let ceilingAccentPatch: Record<string, unknown> = {};
      
      if (job.property?.id) {
        try {
          // Map form data to the expected format for our helper
          const formValues = {
            paintedCeilingsChecked: formData.painted_ceilings,
            ceilingMode: formData.ceiling_mode === 'individual' ? 'perCeiling' as const : 'unitSize' as const,
            ceilingUnitSizeLabel: selectedCeilingBillingDetailId && selectedCeilingBillingDetailId !== 'individual' 
              ? ceilingDisplayLabel 
              : undefined,
            ceilingCount: formData.ceiling_mode === 'individual' ? formData.individual_ceiling_count : undefined,
            ceilingBillingDetailId: selectedCeilingBillingDetailId,
            
            accentWallChecked: formData.has_accent_wall,
            accentWallType: accentWallDisplayLabel && typeof accentWallDisplayLabel === 'string' 
              ? (() => {
                  // Map the unit size label to our expected types
                  if (accentWallDisplayLabel.includes('Paint Over')) return 'Paint Over' as const;
                  if (accentWallDisplayLabel.includes('Custom')) return 'Custom' as const;
                  return undefined;
                })()
              : undefined,
            accentWallCount: formData.accent_wall_count,
            accentWallBillingDetailId: selectedAccentWallBillingDetailId,
          };

          ceilingAccentPatch = await prepareCeilingAccentUpdate(supabase, job.property.id, formValues);
          console.log('Ceiling/Accent Wall patch:', ceilingAccentPatch);
        } catch (error) {
          console.error('Error preparing ceiling/accent wall update:', error);
          // Continue with work order creation even if billing lookup fails
        }
      }


      // Find the correct billing detail IDs based on form selections
      let ceilingBillingDetailId: string | null = null;
      let accentWallBillingDetailId: string | null = null;
      
      // Handle ceiling billing detail ID
      if (formData.painted_ceilings) {
        if (formData.ceiling_mode === 'individual') {
          // Find the "Paint Individual Ceiling" billing detail
          const individualOption = ceilingPaintOptions.find(option => 
            option.unit_sizes?.[0]?.unit_size_label === 'Paint Individual Ceiling'
          );
          ceilingBillingDetailId = individualOption?.id || null;
        } else if (formData.ceiling_rooms_count && typeof formData.ceiling_rooms_count === 'string') {
          // Use the selected billing detail ID
          ceilingBillingDetailId = formData.ceiling_rooms_count;
        }
      }
      
      // Handle accent wall billing detail ID
      if (formData.has_accent_wall && formData.accent_wall_type && formData.accent_wall_count) {
        const accentWallOption = accentWallOptions.find(option => 
          option.id === formData.accent_wall_type
        );
        accentWallBillingDetailId = accentWallOption?.id || null;
      }

      // Build the DB-safe payload
      const workOrderPayload = buildWorkOrderPayload(
        formData, 
        job, 
        ceilingBillingDetailId,
        accentWallBillingDetailId,
        ceilingPaintOptions,
        accentWallOptions,
        dynamicFormValues,
        unitSizes
      );
      
      // Merge the ceiling/accent wall patch into the payload
      Object.assign(workOrderPayload, ceilingAccentPatch);
      
      // Set the prepared_by field
      workOrderPayload.prepared_by = userData.user.id;

      // Validate the payload after all data is set
      console.log('🔍 Validation Payload Debug:');
      console.log('  - workOrderPayload.individual_ceiling_count:', workOrderPayload.individual_ceiling_count);
      console.log('  - workOrderPayload.ceiling_display_label:', workOrderPayload.ceiling_display_label);
      console.log('  - workOrderPayload.painted_ceilings:', workOrderPayload.painted_ceilings);
      console.log('  - workOrderPayload.prepared_by:', workOrderPayload.prepared_by);
      
      const validation = validateWorkOrderPayload(workOrderPayload, accentWallOptions);
      if (!validation.isValid) {
        const errorMessage = `Validation failed: ${validation.errors.join(', ')}`;
        console.error(errorMessage);
        setError(errorMessage);
        setSaving(false);
        return;
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Validation warnings:', validation.warnings);
      }

      // Enforce hourly vs non-hourly math/NULL rules before submit
      if (workOrderPayload.bill_amount !== undefined || workOrderPayload.sub_pay_amount !== undefined || workOrderPayload.profit_amount !== undefined) {
        if (workOrderPayload.is_hourly) {
          // Hourly case: profit_amount must be NULL
          workOrderPayload.profit_amount = null;
          // If either bill_amount or sub_pay_amount is provided, both must be provided
          if ((workOrderPayload.bill_amount !== undefined) !== (workOrderPayload.sub_pay_amount !== undefined)) {
            throw new Error('For hourly rates, both bill_amount and sub_pay_amount must be provided together');
          }
        } else {
          // Non-hourly case: all three must be provided and profit_amount = bill_amount - sub_pay_amount
          if (workOrderPayload.bill_amount === undefined || workOrderPayload.sub_pay_amount === undefined) {
            throw new Error('For non-hourly rates, all three billing amounts must be provided');
          }
          if (workOrderPayload.profit_amount === undefined || workOrderPayload.profit_amount === null) {
            workOrderPayload.profit_amount = (workOrderPayload.bill_amount || 0) - (workOrderPayload.sub_pay_amount || 0);
          }
        }
      }

      // Build whitelisted payload (snake_case only; strip undefined)
      const dbPayload = buildWhitelistedPayload(workOrderPayload);

      // Get the target phase ID for phase advancement
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', formData.has_extra_charges ? 'Pending Work Order' : 'Work Order');
        
      if (phaseError) {
        console.error('Error fetching phase:', phaseError);
        throw phaseError;
      }
      if (!phaseData || phaseData.length === 0) throw new Error('Target phase not found');
      
      const targetPhaseId = phaseData[0].id;
      
      // Submit the work order
      let workOrderResult;
      
      // Clean the payload to ensure all values are properly typed
      const cleanPayload = {
        ...dbPayload,
        ceiling_billing_detail_id: dbPayload.ceiling_billing_detail_id || null,
        accent_wall_billing_detail_id: dbPayload.accent_wall_billing_detail_id || null,
        individual_ceiling_count: dbPayload.individual_ceiling_count || null,
        ceiling_display_label: dbPayload.ceiling_display_label || null,
      };
      
      if (existingWorkOrder) {
        // Update existing work order
        const { data, error } = await supabase
          .from('work_orders')
          .update(cleanPayload)
          .eq('id', existingWorkOrder.id)
          .select()
          .single();
        workOrderResult = { data, error };
      } else {
        // Create new work order
        const { data, error } = await supabase
          .from('work_orders')
          .insert([cleanPayload])
          .select()
          .single();
        workOrderResult = { data, error };
      }
      
      if (workOrderResult.error) {
        console.error('❌ Error creating/updating work order:', {
          error: workOrderResult.error,
          workOrderPayload,
          dbPayload,
          cleanPayload,
          existingWorkOrder,
          jobId: job.id,
          user: userData.user.id
        });
        
        // Log detailed error information
        console.error('❌ Error code:', workOrderResult.error.code);
        console.error('❌ Error message:', workOrderResult.error.message);
        console.error('❌ Error details:', workOrderResult.error.details);
        console.error('❌ Error hint:', workOrderResult.error.hint);
        
        // Log FULL error object as JSON for complete debugging
        console.error('❌ FULL ERROR OBJECT:', JSON.stringify(workOrderResult.error, null, 2));
        
        // Special logging for P0001 errors (database exceptions)
        if (workOrderResult.error.code === 'P0001') {
          console.error('🔍 P0001 Database Exception Details:');
          console.error('  - This is likely a RAISE EXCEPTION from a trigger or function');
          console.error('  - Message:', workOrderResult.error.message);
          console.error('  - Check triggers on work_orders table');
          console.error('  - Check functions called during INSERT/UPDATE');
        }
        
        // If it's a column doesn't exist error, try without the new columns
        if (workOrderResult.error.code === '42703' || workOrderResult.error.message?.includes('column') || workOrderResult.error.code === '22P02') {
          console.log('Attempting fallback without new billing detail columns...');
          
          // Remove the new columns and try again
          const fallbackPayload = {
            ...cleanPayload,
            ceiling_billing_detail_id: undefined,
            accent_wall_billing_detail_id: undefined,
            individual_ceiling_count: undefined,
            ceiling_display_label: undefined,
          };
          
          if (existingWorkOrder) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('work_orders')
              .update(fallbackPayload)
              .eq('id', existingWorkOrder.id)
              .select()
              .single();
            workOrderResult = { data: fallbackData, error: fallbackError };
          } else {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('work_orders')
              .insert([fallbackPayload])
              .select()
              .single();
            workOrderResult = { data: fallbackData, error: fallbackError };
          }
          
          if (workOrderResult.error) {
            console.error('Fallback also failed:', workOrderResult.error);
            throw workOrderResult.error;
          } else {
            console.log('Fallback succeeded - work order created without new columns');
          }
        } else {
          throw workOrderResult.error;
        }
      }

      if (!workOrderResult.data) {
        throw new Error('No data returned from work order creation/update');
      }

      // Update job unit size if changed
      if (formData.unit_size_id && formData.unit_size_id !== job.unit_size?.id) {
        try {
          // Use RPC function to update job unit size (works for subcontractors too)
          const { error: unitSizeError } = await supabase.rpc('update_job_unit_size', {
            p_job_id: job.id,
            p_unit_size_id: formData.unit_size_id
          });
          
          if (unitSizeError) {
            console.error('Error updating job unit size:', unitSizeError);
            // Don't throw here, just log error, as work order was successful
          } else {
            console.log('Job unit size updated successfully');
          }
        } catch (err) {
          console.error('Exception updating job unit size:', err);
        }
      }
      
      // Set the work order ID for image uploads
      setWorkOrderId(workOrderResult.data.id);
      
      // Only update job phase if job is currently in "Job Request" phase
      // This ensures the job advances from Job Request to Work Order/Pending Work Order
      // when a work order is initially submitted
      // More robust phase comparison
      const currentPhaseLabel = job.job_phase?.job_phase_label?.trim();
      const isJobRequestPhase = currentPhaseLabel === 'Job Request';
      
      if (isJobRequestPhase) {
        // For subcontractors, use RPC function to bypass RLS policies
        if (isSubcontractor) {
          const { error: rpcError } = await supabase.rpc('update_job_phase', {
            p_job_id: job.id,
            p_new_phase_id: targetPhaseId,
            p_change_reason: formData.has_extra_charges 
              ? 'Work order created with extra charges - job advanced from Job Request' 
              : 'Work order created - job advanced from Job Request'
          });
          
          if (rpcError) {
            console.error('Error updating job phase via RPC:', rpcError);
            throw rpcError;
          }
        } else {
          // For admins, use direct update
          const { error: jobUpdateError } = await supabase
            .from('jobs')
            .update({ current_phase_id: targetPhaseId })
            .eq('id', job.id);
            
          if (jobUpdateError) {
            console.error('Error updating job phase:', jobUpdateError);
            throw jobUpdateError;
          }
        }
        
        // Create job phase change record
        const { error: phaseChangeError } = await supabase
          .from('job_phase_changes')
          .insert([{
            job_id: job.id,
            changed_by: previewUserId || userData.user.id,
            from_phase_id: job.job_phase?.id,
            to_phase_id: targetPhaseId,
            change_reason: formData.has_extra_charges 
              ? 'Work order created with extra charges - job advanced from Job Request' 
              : 'Work order created - job advanced from Job Request'
          }]);
          
        if (phaseChangeError) {
          console.error('Error creating phase change record:', phaseChangeError);
          throw phaseChangeError;
        }
        
      }
      
      // Delete marked images
      for (const filePath of imagesToDelete) {
        // Remove from storage
        const { error: storageError } = await supabase.storage
          .from('files')
          .remove([filePath.replace(/^\/+/, '')]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }

        // Remove from database
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('path', filePath);

        if (dbError) {
          console.error('Error deleting file record:', dbError);
        }
      }
      
      // Clear the images to delete set after successful submission
      setImagesToDelete(new Set());
      
      toast.success(existingWorkOrder ? 'Work order updated successfully' : 'Work order created successfully');
      
      // Add a small delay to ensure database transactions are committed
      setTimeout(() => {
        // For subcontractors, redirect to subcontractor dashboard to see updated job list
        if (isSubcontractor) {
          if (previewUserId) {
            navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
          } else {
            navigate('/dashboard/subcontractor');
          }
        } else {
          // For other users, redirect to job details page
          navigate(`/dashboard/jobs/${jobId}`);
        }
      }, 1000); // 1 second delay
    } catch (err) {
      console.error('❌ Error creating/updating work order:', err);
      
      // Log FULL error object as JSON
      try {
        console.error('❌ FULL ERROR OBJECT (catch block):', JSON.stringify(err, null, 2));
      } catch (jsonErr) {
        console.error('❌ Could not stringify error:', jsonErr);
      }
      
      // Enhanced error logging for Supabase errors
      if (err && typeof err === 'object' && 'code' in err) {
        const supabaseError = err as any;
        console.error('❌ Supabase error details:', {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code
        });
        
        // Special handling for P0001 errors
        if (supabaseError.code === 'P0001') {
          console.error('🔍 P0001 Database Exception Details:');
          console.error('  - Error Message:', supabaseError.message);
          console.error('  - This is a RAISE EXCEPTION from a database trigger or function');
          console.error('  - Look for triggers on work_orders table');
          console.error('  - Look for functions that validate work order data');
        }
      }
      
      setError(err instanceof Error ? err.message : 'Failed to create/update work order');
      setSaving(false);
    }
  };
  
  const handleImageUploadComplete = () => {
    setRefreshImages(prev => prev + 1);
  };
  
  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };
  
  const checkPhase = async () => {
    if (!job) {
      return null;
    }

    try {
      // If user is admin/manager, allow submission regardless of phase
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .single();
          
        if (profile?.role === 'admin' || profile?.role === 'jg_management') {
          return null; // Continue with the form
        }
      }

      // For non-admin users, check phase restrictions
      if (job.job_phase?.job_phase_label !== 'Job Request' && !previewUserId) {
        // If the job is in Work Order phase but has no work order, allow submission
        if (job.job_phase?.job_phase_label === 'Work Order' && !job.work_order) {
          return null; // Continue with the form
        }
        return 'Work order already submitted';
      }
      return null;
    } catch (err) {
      console.error('Error checking phase:', err);
      return 'Error checking job phase';
    }
  };

  // Move useEffect outside of any conditional logic
  useEffect(() => {
    const checkPhaseAndUpdate = async () => {
      if (job?.job_phase) {
        const phaseCheck = await checkPhase();
        if (phaseCheck) {
          setError(phaseCheck);
        }
      }
    };
    void checkPhaseAndUpdate();
  }, [job?.job_phase]);

  const handleUploadComplete = (filePath: string, folder?: string) => {
    toast.success('Image uploaded successfully');
    
    // Track uploaded images for subcontractor requirements
    if (folder === 'before') {
      setBeforeImagesUploaded(true);
    } else if (folder === 'sprinkler') {
      setSprinklerImagesUploaded(true);
    }
    
    // Optionally refresh the images list if needed
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleImageDelete = (filePath: string) => {
    setImagesToDelete(prev => new Set([...prev, filePath]));
  };

  useEffect(() => {
    if (job?.property?.id) {
      fetchJobCategories();
    }
  }, [job?.property?.id]);

  const fetchJobCategories = async () => {
    try {
      if (!job?.property?.id) {
        throw new Error('Job property not found');
      }

      // Get billing categories for this property
      const { data: billingCategories, error: billingError } = await supabase
        .from('billing_categories')
        .select('name')
        .eq('property_id', job.property.id);

      if (billingError) throw billingError;

      if (!billingCategories || billingCategories.length === 0) {
        setJobCategories([]);
        return;
      }

      // Get job categories that match the billing categories
      const { data: jobCategories, error: categoriesError } = await supabase
        .from('job_categories')
        .select('*')
        .in('name', billingCategories.map(bc => bc.name))
        .order('sort_order');

      if (categoriesError) throw categoriesError;
      setJobCategories(jobCategories || []);
    } catch (err) {
      console.error('Error fetching job categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job categories');
    }
  };

  // Helper to check if required fields are filled
  const requiredFieldsFilled = Boolean(
    formData.unit_number &&
    formData.job_category_id &&
    // For subcontractors, also require before images
    (!isSubcontractor || beforeImagesUploaded) &&
    // For subcontractors with sprinklers, require sprinkler images
    (!isSubcontractor || !formData.sprinklers || sprinklerImagesUploaded) &&
    // Painted Ceilings requirements
    (!formData.painted_ceilings || (
      formData.ceiling_mode === 'individual' 
        ? formData.individual_ceiling_count && formData.individual_ceiling_count > 0
        : selectedCeilingBillingDetailId
    )) &&
    // Accent Walls requirements
    (!formData.has_accent_wall || (
      formData.accent_wall_type && 
      formData.accent_wall_count !== undefined && 
      formData.accent_wall_count > 0
    )) &&
    // Extra Charges requirements - hours must be greater than 0 when checkbox is checked
    (!formData.has_extra_charges || (
      formData.extra_charges_description && 
      formData.extra_charges_description.trim() !== '' && 
      formData.extra_hours !== undefined && 
      formData.extra_hours > 0
    ))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <h3 className="font-medium mb-2">Error Loading Work Order</h3>
          <p className="mb-4">{error || 'Job not found'}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/subcontractor');
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add null check for job.unit_size
  if (!job?.unit_size) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <h3 className="font-medium mb-2">Error Loading Work Order</h3>
          <p className="mb-4">Unit size information is missing for this job.</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/subcontractor');
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Mobile-optimized header with 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/jobs');
                }
              }}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? t.editWorkOrder : t.addWorkOrder}
            </h1>
          </div>
          
          {/* Language Toggle */}
          <div className="flex items-center justify-end space-x-3">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
              className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="en">{t.english}</option>
              <option value="es">{t.spanish}</option>
            </select>
          </div>
        </div>

        {/* Conditional rendering for Spanish version */}
        {language === 'es' ? (
                        <NewWorkOrderSpanish 
                job={job}
                loading={loading}
                error={error}
                saving={saving}
                formData={formData}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                handleUploadComplete={handleUploadComplete}
                handleUploadError={handleUploadError}
                handleImageDelete={handleImageDelete}
                jobCategories={jobCategories}
                existingWorkOrder={existingWorkOrder}
                workOrderId={workOrderId}
                refreshImages={refreshImages}
                navigate={navigate}
                previewUserId={previewUserId}
                isEditMode={isEditMode}
                isSubcontractor={isSubcontractor}
                sprinklerImagesUploaded={sprinklerImagesUploaded}
                beforeImagesUploaded={beforeImagesUploaded}
                ceilingPaintOptions={ceilingPaintOptions}
                accentWallOptions={accentWallOptions}
                billingOptionsLoading={false}
                dynamicServices={dynamicServices}
                dynamicFormValues={dynamicFormValues}
                setDynamicFormValues={setDynamicFormValues}
              />
            ) : (
          <>
            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Job Details Section */}
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-3 sm:p-4 lg:p-6 shadow-lg mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">{t.jobInformation}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Property
                  </label>
                  <div className="text-gray-900 dark:text-white font-medium flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                    {job.property?.property_name}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Work Order #
                  </label>
                  <div className="text-gray-900 dark:text-white font-medium flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                    {formatWorkOrderNumber(job.work_order_num)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Unit #
                  </label>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {job.unit_number}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Job Type
                  </label>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {job.job_type?.job_type_label || 'Not specified'}
                  </div>
                </div>
                

                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Scheduled Date
                  </label>
                  <div className="text-gray-900 dark:text-white font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                    {formatDate(job.scheduled_date)}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Unit Information */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-3 sm:p-4 lg:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Unit Information</h2>
                
                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                  <div>
                    <label htmlFor="unit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Unit # {!isSubcontractor && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      id="unit_number"
                      name="unit_number"
                      required
                      value={formData.unit_number}
                      onChange={handleInputChange}
                      disabled={isSubcontractor}
                      className={`w-full h-12 sm:h-11 px-4 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                        isSubcontractor 
                          ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' 
                          : 'bg-gray-50 dark:bg-[#0F172A]'
                      }`}
                    />
                    {isSubcontractor && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Unit number is set by management and cannot be changed.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="unit_size_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Unit Size <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="unit_size_id"
                      name="unit_size_id"
                      required
                      value={formData.unit_size_id}
                      onChange={handleInputChange}
                      className="w-full h-12 sm:h-11 px-4 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-gray-50 dark:bg-[#0F172A]"
                    >
                      <option value="">Select a unit size</option>
                      {unitSizes.map(size => (
                        <option key={size.id} value={size.id}>
                          {size.unit_size_label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="job_category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Job Category {!isSubcontractor && <span className="text-red-500">*</span>}
                    </label>
                    {jobCategories.length === 0 ? (
                      <div className="text-yellow-600 dark:text-yellow-400 mb-4">
                        No billable categories available for this property. Please add billing details for the property first.
                      </div>
                    ) : (
                      <select
                        id="job_category_id"
                        name="job_category_id"
                        required
                        value={formData.job_category_id}
                        onChange={handleInputChange}
                        disabled={isSubcontractor}
                        className={`w-full h-12 sm:h-11 px-4 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                          isSubcontractor 
                            ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' 
                            : 'bg-gray-50 dark:bg-[#0F172A]'
                        }`}
                      >
                        <option value="">Select a job category</option>
                        {jobCategories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {isSubcontractor && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Job category is set by management and cannot be changed.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_occupied"
                      name="is_occupied"
                      checked={formData.is_occupied}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_occupied: e.target.checked }))}
                      className="h-5 w-5 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_occupied" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Unit is Occupied
                    </label>
                  </div>
                </div>
              </div>

              {/* Sprinklers */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Sprinklers</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sprinklers"
                      checked={formData.sprinklers}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        sprinklers: e.target.checked,
                        has_sprinklers: e.target.checked 
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sprinklers" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Unit Has Sprinklers
                    </label>
                  </div>
                  
                  {formData.sprinklers && (
                    <>
                      <div className="flex items-center mt-4">
                        <input
                          type="checkbox"
                          id="sprinklers_painted"
                          checked={formData.sprinklers_painted}
                          onChange={e => setFormData(prev => ({ ...prev, sprinklers_painted: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="sprinklers_painted" className="ml-2 block text-sm text-gray-900 dark:text-white">
                          Paint on Sprinklers
                        </label>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sprinkler Images {isSubcontractor && <span className="text-red-500">*</span>}
                        </label>
                        <ImageUpload
                          jobId={jobId || ''}
                          workOrderId={existingWorkOrder?.id || ''}
                          folder="sprinkler"
                          onUploadComplete={(filePath) => handleUploadComplete(filePath, 'sprinkler')}
                          onError={handleUploadError}
                          required={isSubcontractor}
                        />
                        {isSubcontractor && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Sprinkler images are required when unit has sprinklers.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Before Images */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
                  Before Images {isSubcontractor && <span className="text-red-500">*</span>}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <ImageUpload
                      jobId={jobId || ''}
                      workOrderId={existingWorkOrder?.id || ''}
                      folder="before"
                      onUploadComplete={(filePath) => handleUploadComplete(filePath, 'before')}
                      onError={handleUploadError}
                      onImageDelete={handleImageDelete}
                      required={isSubcontractor}
                    />
                    {isSubcontractor && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Before images are required for all work orders.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Other Files */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Other Files</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Files (All File Types)
                    </label>
                    <ImageUpload
                      jobId={jobId || ''}
                      workOrderId={existingWorkOrder?.id || ''}
                      folder="other"
                      onUploadComplete={handleUploadComplete}
                      onError={handleUploadError}
                      onImageDelete={handleImageDelete}
                    />
                  </div>
                </div>
              </div>

              {/* Painted Items */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Painted Items</h2>
                
                <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_ceilings"
                        name="painted_ceilings"
                        checked={formData.painted_ceilings}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_ceilings: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_ceilings" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Ceilings
                      </label>
                    </div>
                    
                    {formData.painted_ceilings && (
                      <div className="ml-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Ceiling Paint Option <span className="text-red-500">*</span>
                          </label>
                          
                          {/* Single dropdown with all options */}
                          <select
                            id="ceiling_rooms_count"
                            name="ceiling_rooms_count"
                            value={formData.ceiling_rooms_count || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setFormData(prev => ({ 
                                ...prev, 
                                ceiling_rooms_count: value,
                                ceiling_mode: value === 'individual' ? 'individual' : 'unit_size',
                                individual_ceiling_count: value === 'individual' ? 1 : null
                              }));
                              
                              if (value === 'individual') {
                                // Find the actual billing detail ID for "Paint Individual Ceiling"
                                const individualOption = ceilingPaintOptions.find(option => 
                                  option.unit_sizes?.[0]?.unit_size_label === 'Paint Individual Ceiling'
                                );
                                setSelectedCeilingBillingDetailId(individualOption?.id || 'individual');
                                setCeilingDisplayLabel('Paint Individual Ceiling');
                              } else {
                                setSelectedCeilingBillingDetailId(value);
                                // Find the display label for the selected option
                                const option = ceilingPaintOptions.find(opt => opt.id === value);
                                const displayLabel = option?.unit_sizes?.[0]?.unit_size_label || '';
                                setCeilingDisplayLabel(displayLabel);
                              }
                            }}
                            required
                            className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                          >
                            <option value="">Select ceiling option</option>
                            {ceilingPaintOptions
                              .filter(option => {
                                const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label || '';
                                // Filter out "Paint Individual Ceiling" and "Individual Ceiling" options
                                return !unitSizeLabel.includes('Individual Ceiling') && !unitSizeLabel.includes('Paint Individual Ceiling');
                              })
                              .map((option) => {
                                const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label || 
                                                     (option.unit_size_id ? `Unit Size ${option.unit_size_id}` : 'Service');
                                return (
                                  <option key={option.id} value={option.id}>
                                    {unitSizeLabel}
                                  </option>
                                );
                              })}
                            {/* Only show Individual Ceiling option if it exists in billing details */}
                            {ceilingPaintOptions.some(option => 
                              option.unit_sizes?.[0]?.unit_size_label === 'Paint Individual Ceiling'
                            ) && (
                              <option value="individual">Individual Ceiling</option>
                            )}
                          </select>
                        </div>
                        
                        {/* Show individual ceiling count input when "Individual Ceiling" is selected */}
                        {formData.ceiling_rooms_count === 'individual' && (
                          <div>
                            <label htmlFor="individual_ceiling_count" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                              How many ceilings? {formData.painted_ceilings && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type="number"
                              id="individual_ceiling_count"
                              name="individual_ceiling_count"
                              min="1"
                              max="20"
                              value={formData.individual_ceiling_count || ''}
                              onChange={handleInputChange}
                              required
                              className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                              placeholder="Enter number of ceilings"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_patio"
                        name="painted_patio"
                        checked={formData.painted_patio}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_patio: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_patio" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Patio
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_garage"
                        name="painted_garage"
                        checked={formData.painted_garage}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_garage: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_garage" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Garage
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_cabinets"
                        name="painted_cabinets"
                        checked={formData.painted_cabinets}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_cabinets: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_cabinets" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Cabinets
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_crown_molding"
                        name="painted_crown_molding"
                        checked={formData.painted_crown_molding}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_crown_molding: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_crown_molding" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Crown Molding
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="painted_front_door"
                        name="painted_front_door"
                        checked={formData.painted_front_door}
                        onChange={(e) => setFormData(prev => ({ ...prev, painted_front_door: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="painted_front_door" className="ml-2 block text-sm text-gray-900 dark:text-white">
                        Painted Front Door
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accent Wall */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <div className="flex items-center mb-6">
                  <input
                    type="checkbox"
                    id="has_accent_wall"
                    name="has_accent_wall"
                    checked={formData.has_accent_wall}
                    onChange={(e) => setFormData(prev => ({ ...prev, has_accent_wall: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="has_accent_wall" className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                    Accent Wall
                  </label>
                </div>
                
                {formData.has_accent_wall && (
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                    <div>
                      <label htmlFor="accent_wall_type" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Accent Wall Type {formData.has_accent_wall && <span className="text-red-500">*</span>}
                      </label>
                      
                      {billingOptionsLoading ? (
                        <div className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                          <span className="ml-2 text-sm text-gray-500">Loading options...</span>
                        </div>
                      ) : accentWallOptions.length > 0 ? (
                        <select
                          id="accent_wall_type"
                          name="accent_wall_type"
                          required={formData.has_accent_wall}
                          value={selectedAccentWallBillingDetailId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSelectedAccentWallBillingDetailId(selectedId);
                            
                            if (selectedId) {
                              // Find the selected option to get the display label
                              const selectedOption = accentWallOptions.find(opt => opt.id === selectedId);
                              const displayLabel = selectedOption?.unit_sizes?.[0]?.unit_size_label || 'Service';
                              
                              setFormData(prev => ({ ...prev, accent_wall_type: selectedId }));
                              setAccentWallDisplayLabel(displayLabel);
                            } else {
                              setFormData(prev => ({ ...prev, accent_wall_type: '' }));
                              setAccentWallDisplayLabel(null);
                            }
                          }}
                          className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        >
                          <option value="">Select type</option>
                          {accentWallOptions.map((option) => {
                            const unitSizeLabel = option.unit_sizes?.[0]?.unit_size_label || 
                                                 (option.unit_size_id ? `Unit Size ${option.unit_size_id}` : 'Service');
                            return (
                              <option key={option.id} value={option.id}>
                                {unitSizeLabel}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg">
                                                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              ⚠️ No accent wall billing options found for this property. 
                              Please contact management to set up billing rates for Accent Walls.
                            </p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="accent_wall_count" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Number of Accent Walls {formData.has_accent_wall && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="number"
                        id="accent_wall_count"
                        name="accent_wall_count"
                        min="0"
                        required={formData.has_accent_wall}
                        value={formData.accent_wall_count}
                        onChange={handleInputChange}
                        className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Additional Services */}
              {dynamicServices.length > 0 && (
                <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Additional Services</h2>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    {dynamicServices.map(service => {
                      const value = dynamicFormValues[service.id] || { checked: false, quantity: 1, billingDetailId: '', description: '' };
                      
                      return (
                        <div key={service.id} className="space-y-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`service_${service.id}`}
                                checked={value.checked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  let defaultOptionId = '';
                                  // Try to auto-select option matching job unit size
                                  if (checked && job?.unit_size?.id) {
                                    const match = service.options.find(o => o.unit_size_id === job.unit_size?.id);
                                    if (match) defaultOptionId = match.id;
                                  }
                                  // Fallback to first option
                                  if (checked && !defaultOptionId && service.options.length > 0) {
                                    defaultOptionId = service.options[0].id;
                                  }

                                  setDynamicFormValues(prev => ({
                                    ...prev,
                                    [service.id]: {
                                      ...prev[service.id],
                                      checked,
                                      quantity: prev[service.id]?.quantity || 1,
                                      billingDetailId: defaultOptionId,
                                      description: prev[service.id]?.description || ''
                                    }
                                  }));
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor={`service_${service.id}`} className="ml-2 block text-sm font-medium text-gray-900 dark:text-white">
                                {service.name}
                              </label>
                            </div>
                          </div>

                          {value.checked && (
                            <div className="ml-6 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                    Size / Type <span className="text-red-500">*</span>
                                  </label>
                                  <select
                                    value={value.billingDetailId}
                                    onChange={(e) => {
                                      setDynamicFormValues(prev => ({
                                        ...prev,
                                        [service.id]: { ...prev[service.id], billingDetailId: e.target.value }
                                      }));
                                    }}
                                    className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                  >
                                    <option value="">Select option...</option>
                                    {service.options.map(opt => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.unit_sizes?.[0]?.unit_size_label || 'Standard'}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                    Quantity <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={value.quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 0;
                                      setDynamicFormValues(prev => ({
                                        ...prev,
                                        [service.id]: { ...prev[service.id], quantity: qty }
                                      }));
                                    }}
                                    className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                  Description (Optional)
                                </label>
                                <textarea
                                  value={value.description}
                                  onChange={(e) => {
                                    setDynamicFormValues(prev => ({
                                      ...prev,
                                      [service.id]: { ...prev[service.id], description: e.target.value }
                                    }));
                                  }}
                                  rows={2}
                                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  placeholder="Enter additional details..."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Extra Charges */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <div className="flex items-center mb-6">
                  <input
                    type="checkbox"
                    id="has_extra_charges"
                    name="has_extra_charges"
                    checked={formData.has_extra_charges}
                    onChange={(e) => setFormData(prev => ({ ...prev, has_extra_charges: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="has_extra_charges" className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                    Extra Charges
                  </label>
                </div>
                
                {formData.has_extra_charges && (
                  <div className="space-y-6">
                    {/* Only show approval alert to admin and jg_management users */}
                    {!isSubcontractor && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-4">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <div>
                            <p className="font-medium">Extra Charges Require Approval</p>
                            <p className="mt-1 text-sm">Adding extra charges will set this job to "Pending Work Order" status until the charges are approved.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label htmlFor="extra_charges_description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Description {formData.has_extra_charges && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        id="extra_charges_description"
                        name="extra_charges_description"
                        rows={3}
                        required={formData.has_extra_charges}
                        value={formData.extra_charges_description}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe the extra charges"
                      />
                    </div>
                    
                    
                    <div>
                      <label htmlFor="extra_hours" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Extra Hours {formData.has_extra_charges && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="number"
                        id="extra_hours"
                        name="extra_hours"
                        min="0.25"
                        step="0.25"
                        required={formData.has_extra_charges}
                        value={formData.extra_hours}
                        onChange={handleInputChange}
                        className="w-full h-12 sm:h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                      {formData.has_extra_charges && formData.extra_hours !== undefined && formData.extra_hours <= 0 && (
                        <p className="mt-1 text-sm text-red-500">Extra hours must be greater than 0</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Comments */}
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Additional Comments</h2>
                
                <div>
                  <textarea
                    id="additional_comments"
                    name="additional_comments"
                    rows={4}
                    value={formData.additional_comments}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter any additional comments or notes"
                  />
                </div>
              </div>

              {/* Submit/Cancel Buttons */}
              <div className="flex flex-row justify-between gap-3 sm:gap-2 mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/jobs')}
                  className="flex-1 sm:flex-none sm:w-auto px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !requiredFieldsFilled}
                  className={`flex-1 sm:flex-none sm:w-auto px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    requiredFieldsFilled && !saving
                      ? 'text-white bg-blue-600 hover:bg-blue-700'
                      : 'text-gray-400 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      {isEditMode ? 'Update Work Order' : 'Create Work Order'}
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Add image upload and gallery after the form */}
            {workOrderId && (
              <div className="mt-8 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Work Order Images
                </h2>
                
                <ImageGallery
                  workOrderId={workOrderId}
                  folder="before"
                  key={refreshImages}
                />
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      if (previewUserId) {
                        navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                      } else {
                        navigate('/dashboard/subcontractor');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Messaging Icon - Only show for subcontractors (not in preview mode) */}

    </div>
  );
};

export default withSubcontractorAccessCheck(NewWorkOrder);
