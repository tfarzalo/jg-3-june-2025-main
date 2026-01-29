import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  FileText, 
  Calendar, 
  Save, 
  AlertCircle
} from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import ImageUpload from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { formatCurrency } from '../lib/utils/formatUtils';
import { supabase } from '../utils/supabase';
import ExtraChargesSection from './ExtraChargesSection';
import { ExtraChargeLineItem } from '../types/extraCharges';


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
  work_order?: any;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
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
}

interface WorkOrder {
  id: string;
  job_id: string;
  prepared_by: string;
  submission_date: string;
  unit_number: string;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_type?: string;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
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
}

interface JobCategory {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

interface NewWorkOrderSpanishProps {
  job: Job;
  loading: boolean;
  error: string | null;
  saving: boolean;
  formData: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleUploadComplete: (filePath: string) => void;
  handleUploadError: (error: string) => void;
  handleImageDelete: (filePath: string) => void;
  jobCategories: JobCategory[];
  existingWorkOrder: WorkOrder | null;
  workOrderId: string | null;
  refreshImages: number;
  navigate: any;
  previewUserId: string | null;
  isEditMode: boolean;
  isSubcontractor: boolean;
  sprinklerImagesUploaded: boolean;
  beforeImagesUploaded: boolean;
  ceilingPaintOptions: Array<{
    id: string, 
    unit_size_id: string, 
    bill_amount: number, 
    sub_pay_amount: number,
    unit_sizes: { unit_size_label: string }[]
  }>;
  accentWallOptions: Array<{
    id: string, 
    unit_size_id: string, 
    bill_amount: number, 
    sub_pay_amount: number,
    unit_sizes: { unit_size_label: string }[]
  }>;
  billingOptionsLoading: boolean;
  unitSizes?: Array<{ id: string; unit_size_label: string }>;
  dynamicServices?: any[];
  dynamicFormValues?: any;
  setDynamicFormValues?: any;
  extraChargesItems: ExtraChargeLineItem[];
  handleAddExtraCharge: (item: ExtraChargeLineItem) => void;
  handleRemoveExtraCharge: (id: string) => void;
}

const NewWorkOrderSpanish: React.FC<NewWorkOrderSpanishProps> = ({
  job,
  loading,
  error,
  saving,
  formData,
  handleInputChange,
  handleSubmit,
  handleUploadComplete,
  handleUploadError,
  handleImageDelete,
  jobCategories,
  existingWorkOrder,
  workOrderId,
  refreshImages,
  navigate,
  previewUserId,
  isEditMode,
  isSubcontractor,
  sprinklerImagesUploaded,
  beforeImagesUploaded,
  ceilingPaintOptions,
  accentWallOptions,
  billingOptionsLoading,
  unitSizes = [],
  dynamicServices,
  dynamicFormValues,
  setDynamicFormValues,
  extraChargesItems,
  handleAddExtraCharge,
  handleRemoveExtraCharge
}) => {
  // Debug logging
  console.log('NewWorkOrderSpanish - Props Debug:', {
    isSubcontractor,
    sprinklerImagesUploaded,
    formData: formData.has_extra_charges
  });
  
  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const requiredFieldsFilled = Boolean(
    formData.unit_number &&
    formData.job_category_id &&
    // For subcontractors, also require before images
    (!isSubcontractor || beforeImagesUploaded) &&
    // For subcontractors with sprinklers, require sprinkler images
    (!isSubcontractor || !formData.sprinklers || sprinklerImagesUploaded) &&
    // Extra Charges requirements - at least one line item when checkbox is checked
    (!formData.has_extra_charges || extraChargesItems.length > 0)
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
          <h3 className="font-medium mb-2">Error al Cargar la Orden de Trabajo</h3>
          <p className="mb-4">{error || 'Trabajo no encontrado'}</p>
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
              Volver al Panel
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Intentar de Nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!job?.unit_size) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <h3 className="font-medium mb-2">Error al Cargar la Orden de Trabajo</h3>
          <p className="mb-4">La información del tamaño de la unidad está faltando para este trabajo.</p>
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
              Volver al Panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Note: Billing options are now passed as props from the parent component





  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

        {/* Job Details Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información del Trabajo</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Propiedad
              </label>
              <div className="text-gray-900 dark:text-white font-medium flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                {job.property ? (
                  <PropertyLink 
                    propertyId={job.property.id}
                    propertyName={job.property.property_name}
                  />
                ) : 'Unknown Property'}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Orden de Trabajo #
              </label>
              <div className="text-gray-900 dark:text-white font-medium flex items-center">
                <FileText className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                <WorkOrderLink 
                  jobId={job.id}
                  workOrderNum={job.work_order_num}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Unidad #
              </label>
              <div className="text-gray-900 dark:text-white font-medium">
                {job.unit_number}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tipo de Trabajo
              </label>
              <div className="text-gray-900 dark:text-white font-medium">
                {job.job_type?.job_type_label || 'No especificado'}
              </div>
            </div>
            

            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Fecha Programada
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
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Información de la Unidad</h2>
            
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="unit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Unidad # {!isSubcontractor && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  id="unit_number"
                  name="unit_number"
                  required
                  value={formData.unit_number}
                  onChange={handleInputChange}
                  disabled={isSubcontractor}
                  className={`w-full h-12 sm:h-11 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                    isSubcontractor 
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-50 dark:bg-[#0F172A] text-gray-900 dark:text-white border-gray-300 dark:border-[#2D3B4E]'
                  }`}
                />
                {isSubcontractor && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    El número de unidad es establecido por la administración y no se puede cambiar.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="unit_size_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Tamaño de Unidad <span className="text-red-500">*</span>
                </label>
                <select
                  id="unit_size_id"
                  name="unit_size_id"
                  required
                  value={formData.unit_size_id}
                  onChange={handleInputChange}
                  className="w-full h-12 sm:h-11 px-4 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-gray-50 dark:bg-[#0F172A]"
                >
                  <option value="">Seleccionar tamaño de unidad</option>
                  {unitSizes.map(size => (
                    <option key={size.id} value={size.id}>
                      {size.unit_size_label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="job_category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Categoría del Trabajo {!isSubcontractor && <span className="text-red-500">*</span>}
                </label>
                {jobCategories.length === 0 ? (
                  <div className="text-yellow-600 dark:text-yellow-400 mb-4">
                    No hay categorías facturables disponibles para esta propiedad. Por favor agregue primero los detalles de facturación para la propiedad.
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
                    <option value="">Seleccionar una categoría de trabajo</option>
                    {jobCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
                {isSubcontractor && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    La categoría del trabajo es establecida por la administración y no se puede cambiar.
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_occupied"
                  name="is_occupied"
                  checked={formData.is_occupied}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement;
                    const newFormData = { ...formData, is_occupied: target.checked };
                    // Simulate the handleInputChange behavior
                    const syntheticEvent = {
                      target: { name: 'is_occupied', value: target.checked.toString(), type: 'checkbox', checked: target.checked }
                    } as React.ChangeEvent<HTMLInputElement>;
                    handleInputChange(syntheticEvent);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_occupied" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  La Unidad Está Ocupada
                </label>
              </div>
            </div>
          </div>

          {/* Sprinklers */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Aspersores</h2>
            
            <div className="space-y-4">
                                <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sprinklers"
                      checked={formData.sprinklers}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        const checked = target.checked;
                        // Use the same direct state update pattern as English version
                        const syntheticEvent = {
                          target: { name: 'sprinklers', value: checked.toString(), type: 'checkbox', checked }
                        } as React.ChangeEvent<HTMLInputElement>;
                        handleInputChange(syntheticEvent);
                        
                        // Also update has_sprinklers to keep them in sync
                        const hasSprinklersEvent = {
                          target: { name: 'has_sprinklers', value: checked.toString(), type: 'checkbox', checked }
                        } as React.ChangeEvent<HTMLInputElement>;
                        handleInputChange(hasSprinklersEvent);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sprinklers" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      La Unidad Tiene Aspersores
                    </label>
                  </div>
              
              {formData.sprinklers && (
                <>
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="sprinklers_painted"
                      checked={formData.sprinklers_painted}
                      onChange={e => {
                        const target = e.target as HTMLInputElement;
                        const checked = target.checked;
                        // Use the same direct state update pattern as English version
                        const syntheticEvent = {
                          target: { name: 'sprinklers_painted', value: checked.toString(), type: 'checkbox', checked }
                        } as React.ChangeEvent<HTMLInputElement>;
                        handleInputChange(syntheticEvent);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sprinklers_painted" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Pintura en Aspersores
                    </label>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Imágenes de Aspersores {isSubcontractor && <span className="text-red-500">*</span>}
                    </label>
                    <ImageUpload
                      jobId={job.id}
                      workOrderId={existingWorkOrder?.id || ''}
                      folder="sprinkler"
                      onUploadComplete={handleUploadComplete}
                      onError={handleUploadError}
                      required={isSubcontractor}
                    />
                    {isSubcontractor && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Las imágenes de aspersores son requeridas cuando la unidad tiene aspersores.
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
              Imágenes de Antes {isSubcontractor && <span className="text-red-500">*</span>}
            </h2>
            
            <div className="space-y-4">
              <div>
                <ImageUpload
                  jobId={job.id}
                  workOrderId={existingWorkOrder?.id || ''}
                  folder="before"
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  onImageDelete={handleImageDelete}
                  required={isSubcontractor}
                />
                {isSubcontractor && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Las imágenes de antes son requeridas para todas las órdenes de trabajo.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Other Files */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Otros Archivos</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos Adicionales (Todos los Tipos de Archivo)
                </label>
                <ImageUpload
                  jobId={job.id}
                  workOrderId={existingWorkOrder?.id || ''}
                  folder="other"
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  onImageDelete={handleImageDelete}
                />
              </div>
            </div>
          </div>

              {/* Extra Charges (Itemized) */}
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
                Cargos Adicionales
              </label>
            </div>
            
            {formData.has_extra_charges && (
              <div className="space-y-6">
                {!isSubcontractor && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Los Cargos Adicionales Requieren Aprobación</p>
                        <p className="mt-1 text-sm">Agregar cargos adicionales establecerá este trabajo en estado "Orden de Trabajo Pendiente" hasta que los cargos sean aprobados.</p>
                      </div>
                    </div>
                  </div>
                )}

                <ExtraChargesSection
                  propertyId={job?.property?.id || null}
                  lineItems={extraChargesItems}
                  onAddLineItem={handleAddExtraCharge}
                  onRemoveLineItem={handleRemoveExtraCharge}
                  language="es"
                  disabled={saving}
                />
              </div>
            )}
          </div>

          {/* Additional Comments */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 sm:p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Comentarios Adicionales</h2>
            
            <div>
              <textarea
                id="additional_comments"
                name="additional_comments"
                rows={4}
                value={formData.additional_comments}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingrese cualquier comentario o nota adicional"
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
              Cancelar
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
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Actualizar Orden de Trabajo' : 'Crear Orden de Trabajo'}
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Add image upload and gallery after the form */}
        {workOrderId && (
          <div className="mt-8 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Imágenes de la Orden de Trabajo
            </h2>
            
            <ImageGallery
              workOrderId={workOrderId}
              jobId={jobId || null}
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
                Volver al Panel
              </button>
            </div>
          </div>
        )}
        
        {/* Messaging Icon */}

    </>
  );
};

export default NewWorkOrderSpanish;
