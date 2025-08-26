import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Building2, 
  User, 
  FileText,
  Upload,
  Globe
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDate } from '@/lib/dateUtils';
import ImageUpload from './ImageUpload';
import { withSubcontractorAccessCheck } from './withSubcontractorAccessCheck';

interface JobDetails {
  id: string;
  work_order_num: number;
  unit_number: string;
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
  };
  unit_size: {
    label: string;
  };
  job_type: {
    label: string;
  };
  scheduled_date: string;
}

interface JobCategory {
  id: string;
  name: string;
  description: string;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

const NewWorkOrder: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Language state
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Translations
  const t = {
    en: {
      title: 'Add Work Order',
      jobInfo: 'Job Information',
      workOrderDetails: 'Work Order Details', 
      unitInfo: 'Unit Information',
      paintedItems: 'Painted Items',
      accentWall: 'Accent Wall Information',
      extraCharges: 'Extra Charges & Additional Work',
      additionalComments: 'Additional Comments',
      beforeImages: 'Before Images',
      sprinklerImages: 'Sprinkler Images', 
      otherFiles: 'Other Files',
      submit: 'Submit Work Order',
      cancel: 'Cancel',
      yes: 'Yes',
      no: 'No',
      select: 'Select an option'
    },
    es: {
      title: 'Agregar Orden de Trabajo',
      jobInfo: 'Información del Trabajo',
      workOrderDetails: 'Detalles de la Orden de Trabajo',
      unitInfo: 'Información de la Unidad', 
      paintedItems: 'Elementos Pintados',
      accentWall: 'Información de Pared de Acento',
      extraCharges: 'Cargos Adicionales y Trabajo Extra',
      additionalComments: 'Comentarios Adicionales',
      beforeImages: 'Imágenes de Antes',
      sprinklerImages: 'Imágenes de Rociadores',
      otherFiles: 'Otros Archivos', 
      submit: 'Enviar Orden de Trabajo',
      cancel: 'Cancelar',
      yes: 'Sí',
      no: 'No',
      select: 'Seleccionar una opción'
    }
  };

  // Language toggle state
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Translation object
  const translations = {
    en: {
      // Page header
      pageTitle: 'Add Work Order',
      backButton: 'Back to Job Details',
      
      // Job Information section
      jobInfoSection: 'Job Information',
      workOrderNumber: 'Work Order #',
      property: 'Property',
      unit: 'Unit #',
      unitSize: 'Unit Size',
      jobType: 'Job Type',
      scheduledDate: 'Scheduled Date',
      
      // Work Order Details section
      workOrderDetailsSection: 'Work Order Details',
      submissionDate: 'Submission Date',
      unitOccupied: 'Unit Occupied',
      fullPaint: 'Full Paint Job',
      jobCategory: 'Job Category',
      
      // Unit Information section
      unitInfoSection: 'Unit Information',
      sprinklers: 'Sprinklers Present',
      sprinklersPainted: 'Sprinklers Painted Around',
      
      // Painted Items section
      paintedItemsSection: 'Painted Items',
      ceilings: 'Ceilings Painted',
      ceilingRooms: 'Number of Rooms with Painted Ceilings',
      patio: 'Patio Painted',
      garage: 'Garage Painted',
      cabinets: 'Cabinets Painted',
      crownMolding: 'Crown Molding Painted',
      frontDoor: 'Front Door Painted',
      
      // Accent Wall section
      accentWallSection: 'Accent Wall Information',
      hasAccentWall: 'Accent Wall Present',
      accentWallType: 'Accent Wall Type',
      accentWallCount: 'Number of Accent Walls',
      
      // Extra Charges section
      extraChargesSection: 'Extra Charges & Additional Work',
      hasExtraCharges: 'Extra Charges Apply',
      extraChargesDesc: 'Extra Charges Description',
      extraHours: 'Extra Hours',
      
      // Additional Comments section
      additionalCommentsSection: 'Additional Comments',
      comments: 'Additional Comments or Notes',
      
      // Image Upload sections
      beforeImagesSection: 'Before Images',
      beforeImagesDesc: 'Upload photos taken before starting work',
      sprinklerImagesSection: 'Sprinkler Images',
      sprinklerImagesDesc: 'Upload photos of sprinkler work if applicable',
      otherFilesSection: 'Other Files',
      otherFilesDesc: 'Upload any other relevant files or documents',
      
      // Form actions
      submitButton: 'Submit Work Order',
      cancelButton: 'Cancel',
      
      // Options
      yes: 'Yes',
      no: 'No',
      selectOption: 'Select an option',
      selectCategory: 'Select a category',
      selectType: 'Select type',
      
      // Accent wall types
      custom: 'Custom',
      paintOver: 'Paint Over',
      
      // Language toggle
      languageToggle: 'Language',
      english: 'English',
      spanish: 'Spanish'
    },
    es: {
      // Page header
      pageTitle: 'Agregar Orden de Trabajo',
      backButton: 'Volver a Detalles del Trabajo',
      
      // Job Information section
      jobInfoSection: 'Información del Trabajo',
      workOrderNumber: 'Orden de Trabajo #',
      property: 'Propiedad',
      unit: 'Unidad #',
      unitSize: 'Tamaño de Unidad',
      jobType: 'Tipo de Trabajo',
      scheduledDate: 'Fecha Programada',
      
      // Work Order Details section
      workOrderDetailsSection: 'Detalles de la Orden de Trabajo',
      submissionDate: 'Fecha de Envío',
      unitOccupied: 'Unidad Ocupada',
      fullPaint: 'Trabajo de Pintura Completo',
      jobCategory: 'Categoría del Trabajo',
      
      // Unit Information section
      unitInfoSection: 'Información de la Unidad',
      sprinklers: 'Rociadores Presentes',
      sprinklersPainted: 'Rociadores Pintados Alrededor',
      
      // Painted Items section
      paintedItemsSection: 'Elementos Pintados',
      ceilings: 'Techos Pintados',
      ceilingRooms: 'Número de Habitaciones con Techos Pintados',
      patio: 'Patio Pintado',
      garage: 'Garaje Pintado',
      cabinets: 'Gabinetes Pintados',
      crownMolding: 'Moldura de Corona Pintada',
      frontDoor: 'Puerta Principal Pintada',
      
      // Accent Wall section
      accentWallSection: 'Información de Pared de Acento',
      hasAccentWall: 'Pared de Acento Presente',
      accentWallType: 'Tipo de Pared de Acento',
      accentWallCount: 'Número de Paredes de Acento',
      
      // Extra Charges section
      extraChargesSection: 'Cargos Adicionales y Trabajo Extra',
      hasExtraCharges: 'Aplican Cargos Adicionales',
      extraChargesDesc: 'Descripción de Cargos Adicionales',
      extraHours: 'Horas Adicionales',
      
      // Additional Comments section
      additionalCommentsSection: 'Comentarios Adicionales',
      comments: 'Comentarios o Notas Adicionales',
      
      // Image Upload sections
      beforeImagesSection: 'Imágenes de Antes',
      beforeImagesDesc: 'Subir fotos tomadas antes de comenzar el trabajo',
      sprinklerImagesSection: 'Imágenes de Rociadores',
      sprinklerImagesDesc: 'Subir fotos del trabajo de rociadores si aplica',
      otherFilesSection: 'Otros Archivos',
      otherFilesDesc: 'Subir cualquier otro archivo o documento relevante',
      
      // Form actions
      submitButton: 'Enviar Orden de Trabajo',
      cancelButton: 'Cancelar',
      
      // Options
      yes: 'Sí',
      no: 'No',
      selectOption: 'Seleccionar una opción',
      selectCategory: 'Seleccionar una categoría',
      selectType: 'Seleccionar tipo',
      
      // Accent wall types
      custom: 'Personalizado',
      paintOver: 'Pintar Encima',
      
      // Language toggle
      languageToggle: 'Idioma',
      english: 'Inglés',
      spanish: 'Español'
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  
  const [formData, setFormData] = useState({
    unit_number: '',
    is_occupied: false,
    is_full_paint: false,
    unit_size: '',
    job_category_id: '',
    has_sprinklers: false,
    sprinklers_painted: false,
    painted_ceilings: false,
    ceiling_rooms_count: 0,
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

  const [uploadResetTrigger, setUploadResetTrigger] = useState(0);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchJobCategories();
      fetchUnitSizes();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          property:properties (
            id,
            property_name,
            address,
            city,
            state
          ),
          unit_size:unit_sizes (
            unit_size_label
          ),
          job_type:job_types (
            job_type_label
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      
      const jobData = {
        ...data,
        property: Array.isArray(data.property) ? data.property[0] : data.property,
        unit_size: Array.isArray(data.unit_size) ? data.unit_size[0] : data.unit_size,
        job_type: Array.isArray(data.job_type) ? data.job_type[0] : data.job_type,
      };

      setJobDetails(jobData);
      setFormData(prev => ({
        ...prev,
        unit_number: jobData.unit_number,
        unit_size: jobData.unit_size?.label || ''
      }));
    } catch (err) {
      console.error('Error fetching job details:', err);
      setError('Failed to load job details');
    }
  };

  const fetchJobCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('job_categories')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setJobCategories(data || []);
    } catch (err) {
      console.error('Error fetching job categories:', err);
    }
  };

  const fetchUnitSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('*')
        .order('unit_size_label');

      if (error) throw error;
      setUnitSizes(data || []);
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jobId || !user) {
      toast.error('Missing required information');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('work_orders')
        .insert({
          job_id: jobId,
          prepared_by: user.id,
          unit_number: formData.unit_number,
          is_occupied: formData.is_occupied,
          is_full_paint: formData.is_full_paint,
          unit_size: formData.unit_size,
          job_category_id: formData.job_category_id,
          has_sprinklers: formData.has_sprinklers,
          sprinklers_painted: formData.sprinklers_painted,
          painted_ceilings: formData.painted_ceilings,
          ceiling_rooms_count: formData.ceiling_rooms_count,
          painted_patio: formData.painted_patio,
          painted_garage: formData.painted_garage,
          painted_cabinets: formData.painted_cabinets,
          painted_crown_molding: formData.painted_crown_molding,
          painted_front_door: formData.painted_front_door,
          has_accent_wall: formData.has_accent_wall,
          accent_wall_type: formData.accent_wall_type,
          accent_wall_count: formData.accent_wall_count,
          has_extra_charges: formData.has_extra_charges,
          extra_charges_description: formData.extra_charges_description,
          extra_hours: formData.extra_hours,
          additional_comments: formData.additional_comments
        });

      if (insertError) throw insertError;

      toast.success(language === 'en' ? 'Work order created successfully!' : '¡Orden de trabajo creada exitosamente!');
      
      // Reset image uploads
      setUploadResetTrigger(prev => prev + 1);
      
      // Navigate back
      navigate(`/dashboard/jobs/${jobId}${previewUserId ? `?userId=${previewUserId}` : ''}`);
      
    } catch (err) {
      console.error('Error creating work order:', err);
      setError(language === 'en' ? 'Failed to create work order' : 'Error al crear la orden de trabajo');
      toast.error(language === 'en' ? 'Failed to create work order' : 'Error al crear la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  if (!jobDetails) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Language Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/dashboard/jobs/${jobId}${previewUserId ? `?userId=${previewUserId}` : ''}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t[language].title}
            </h1>
          </div>
          
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span className="text-sm">{language === 'en' ? 'EN' : 'ES'}</span>
            </button>
            
            {showLanguageDropdown && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-10 border border-gray-200 dark:border-[#2D3B4E]">
                <button
                  onClick={() => {
                    setLanguage('en');
                    setShowLanguageDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors ${
                    language === 'en' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🇺🇸 English
                </button>
                <button
                  onClick={() => {
                    setLanguage('es');
                    setShowLanguageDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors ${
                    language === 'es' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🇪🇸 Español
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              {t[language].jobInfo}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('workOrderNumber')}
                </label>
                <div className="text-gray-900 dark:text-white font-medium">
                  WO-{String(jobDetails.work_order_num).padStart(6, '0')}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('property')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {jobDetails.property.name}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('unit')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {jobDetails.unit_number}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('unitSize')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {jobDetails.unit_size.label}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('jobType')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {jobDetails.job_type.label}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('scheduledDate')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {formatDate(jobDetails.scheduled_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Work Order Details */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-orange-500" />
              {t[language].workOrderDetails}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('submissionDate')}
                </label>
                <div className="text-gray-900 dark:text-white">
                  {formatDate(new Date().toISOString())}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('unitOccupied')}
                </label>
                <select
                  name="is_occupied"
                  value={formData.is_occupied.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_occupied: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('fullPaint')}
                </label>
                <select
                  name="is_full_paint"
                  value={formData.is_full_paint.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_full_paint: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('jobCategory')}
                </label>
                <select
                  name="job_category_id"
                  value={formData.job_category_id}
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t('selectCategory')}</option>
                  {jobCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Unit Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-green-500" />
              {t[language].unitInfo}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('sprinklers')}
                </label>
                <select
                  name="has_sprinklers"
                  value={formData.has_sprinklers.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_sprinklers: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              {formData.has_sprinklers && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('sprinklersPainted')}
                  </label>
                  <select
                    name="sprinklers_painted"
                    value={formData.sprinklers_painted.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, sprinklers_painted: e.target.value === 'true' }))}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">{t[language].select}</option>
                    <option value="true">{t[language].yes}</option>
                    <option value="false">{t[language].no}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Painted Items */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <User className="h-5 w-5 mr-2 text-purple-500" />
              {t[language].paintedItems}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('ceilings')}
                </label>
                <select
                  name="painted_ceilings"
                  value={formData.painted_ceilings.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_ceilings: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              {formData.painted_ceilings && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('ceilingRooms')}
                  </label>
                  <input
                    type="number"
                    name="ceiling_rooms_count"
                    value={formData.ceiling_rooms_count}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('patio')}
                </label>
                <select
                  name="painted_patio"
                  value={formData.painted_patio.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_patio: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('garage')}
                </label>
                <select
                  name="painted_garage"
                  value={formData.painted_garage.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_garage: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectOption')}</option>
                  <option value="true">{t('yes')}</option>
                  <option value="false">{t('no')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('cabinets')}
                </label>
                <select
                  name="painted_cabinets"
                  value={formData.painted_cabinets.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_cabinets: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectOption')}</option>
                  <option value="true">{t('yes')}</option>
                  <option value="false">{t('no')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('crownMolding')}
                </label>
                <select
                  name="painted_crown_molding"
                  value={formData.painted_crown_molding.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_crown_molding: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectOption')}</option>
                  <option value="true">{t('yes')}</option>
                  <option value="false">{t('no')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('frontDoor')}
                </label>
                <select
                  name="painted_front_door"
                  value={formData.painted_front_door.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, painted_front_door: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectOption')}</option>
                  <option value="true">{t('yes')}</option>
                  <option value="false">{t('no')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Accent Wall Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-yellow-500" />
              {t[language].accentWall}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('hasAccentWall')}
                </label>
                <select
                  name="has_accent_wall"
                  value={formData.has_accent_wall.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_accent_wall: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              {formData.has_accent_wall && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('accentWallType')}
                    </label>
                    <select
                      name="accent_wall_type"
                      value={formData.accent_wall_type}
                      onChange={handleInputChange}
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">{t[language].select}</option>
                      <option value="Custom">Custom</option>
                      <option value="Paint Over">Paint Over</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('accentWallCount')}
                    </label>
                    <input
                      type="number"
                      name="accent_wall_count"
                      value={formData.accent_wall_count}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Extra Charges */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-red-500" />
              {t[language].extraCharges}
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('hasExtraCharges')}
                </label>
                <select
                  name="has_extra_charges"
                  value={formData.has_extra_charges.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_extra_charges: e.target.value === 'true' }))}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t[language].select}</option>
                  <option value="true">{t[language].yes}</option>
                  <option value="false">{t[language].no}</option>
                </select>
              </div>
              
              {formData.has_extra_charges && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('extraChargesDesc')}
                    </label>
                    <textarea
                      name="extra_charges_description"
                      value={formData.extra_charges_description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('extraHours')}
                    </label>
                    <input
                      type="number"
                      name="extra_hours"
                      value={formData.extra_hours}
                      onChange={handleInputChange}
                      min="0"
                      step="0.5"
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Additional Comments */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-500" />
              {t[language].additionalComments}
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {t('comments')}
              </label>
              <textarea
                name="additional_comments"
                value={formData.additional_comments}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Before Images */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-blue-500" />
              {t[language].beforeImages}
            </h2>
            <ImageUpload
              jobId={jobId!}
              folder="before"
              resetTrigger={uploadResetTrigger}
            />
          </div>

          {/* Sprinkler Images */}
          {formData.has_sprinklers && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Upload className="h-5 w-5 mr-2 text-green-500" />
                {t[language].sprinklerImages}
              </h2>
              <ImageUpload
                jobId={jobId!}
                folder="sprinkler"
                resetTrigger={uploadResetTrigger}
              />
            </div>
          )}

          {/* Other Files */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-purple-500" />
              {t[language].otherFiles}
            </h2>
            <ImageUpload
              jobId={jobId!}
              folder="other"
              resetTrigger={uploadResetTrigger}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/jobs/${jobId}${previewUserId ? `?userId=${previewUserId}` : ''}`)}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              {t[language].cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {language === 'en' ? 'Submitting...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t[language].submit}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default withSubcontractorAccessCheck(NewWorkOrder);