import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Globe
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import ImageUpload from './ImageUpload';
import { toast } from 'sonner';
import { withSubcontractorAccessCheck } from './withSubcontractorAccessCheck';

// Translation object for English and Spanish
const translations = {
  en: {
    pageTitle: 'Create Work Order',
    backToJob: 'Back to Job',
    workOrderForm: 'Work Order Form',
    unitInformation: 'Unit Information',
    unitNumber: 'Unit #',
    unitNumberPlaceholder: 'Enter unit number',
    unitOccupied: 'Unit Occupied',
    fullPaint: 'Full Paint',
    unitSize: 'Unit Size',
    selectUnitSize: 'Select unit size',
    jobCategory: 'Job Category',
    selectJobCategory: 'Select job category',
    paintingDetails: 'Painting Details',
    sprinklers: 'Sprinklers',
    sprinklersPainted: 'Sprinklers Painted',
    ceilingsPainted: 'Ceilings Painted',
    ceilingRoomsCount: 'How many rooms?',
    patioPainted: 'Patio Painted',
    garagePainted: 'Garage Painted',
    cabinetsPainted: 'Cabinets Painted',
    crownMoldingPainted: 'Crown Molding Painted',
    frontDoorPainted: 'Front Door Painted',
    accentWallInfo: 'Accent Wall Information',
    hasAccentWall: 'Has Accent Wall',
    accentWallType: 'Accent Wall Type',
    selectAccentWallType: 'Select accent wall type',
    accentWallCount: 'Number of Accent Walls',
    extraCharges: 'Extra Charges',
    hasExtraCharges: 'Has Extra Charges',
    extraChargesDescription: 'Extra Charges Description',
    extraChargesPlaceholder: 'Describe additional work or charges',
    extraHours: 'Extra Hours',
    fileUploads: 'File Uploads',
    beforeImages: 'Before Images',
    sprinklerImages: 'Sprinkler Images',
    otherFiles: 'Other Files',
    additionalComments: 'Additional Comments',
    additionalCommentsPlaceholder: 'Enter any additional comments or notes',
    cancel: 'Cancel',
    saveWorkOrder: 'Save Work Order',
    saving: 'Saving...',
    yes: 'Yes',
    no: 'No',
    custom: 'Custom',
    paintOver: 'Paint Over',
    regularPaint: 'Regular Paint',
    colorChange: 'Color Change',
    studio: 'Studio',
    oneBedroom: '1 Bedroom',
    twoBedroom: '2 Bedroom',
    threeBedroom: '3 Bedroom',
    fourBedroom: '4 Bedroom',
    language: 'Language',
    english: 'English',
    spanish: 'Español'
  },
  es: {
    pageTitle: 'Crear Orden de Trabajo',
    backToJob: 'Volver al Trabajo',
    workOrderForm: 'Formulario de Orden de Trabajo',
    unitInformation: 'Información de la Unidad',
    unitNumber: 'Número de Unidad',
    unitNumberPlaceholder: 'Ingrese el número de unidad',
    unitOccupied: 'Unidad Ocupada',
    fullPaint: 'Pintura Completa',
    unitSize: 'Tamaño de Unidad',
    selectUnitSize: 'Seleccionar tamaño de unidad',
    jobCategory: 'Categoría de Trabajo',
    selectJobCategory: 'Seleccionar categoría de trabajo',
    paintingDetails: 'Detalles de Pintura',
    sprinklers: 'Aspersores',
    sprinklersPainted: 'Aspersores Pintados',
    ceilingsPainted: 'Techos Pintados',
    ceilingRoomsCount: '¿Cuántas habitaciones?',
    patioPainted: 'Patio Pintado',
    garagePainted: 'Garaje Pintado',
    cabinetsPainted: 'Gabinetes Pintados',
    crownMoldingPainted: 'Moldura de Corona Pintada',
    frontDoorPainted: 'Puerta Principal Pintada',
    accentWallInfo: 'Información de Pared de Acento',
    hasAccentWall: 'Tiene Pared de Acento',
    accentWallType: 'Tipo de Pared de Acento',
    selectAccentWallType: 'Seleccionar tipo de pared de acento',
    accentWallCount: 'Número de Paredes de Acento',
    extraCharges: 'Cargos Adicionales',
    hasExtraCharges: 'Tiene Cargos Adicionales',
    extraChargesDescription: 'Descripción de Cargos Adicionales',
    extraChargesPlaceholder: 'Describir trabajo adicional o cargos',
    extraHours: 'Horas Adicionales',
    fileUploads: 'Cargas de Archivos',
    beforeImages: 'Imágenes Antes',
    sprinklerImages: 'Imágenes de Aspersores',
    otherFiles: 'Otros Archivos',
    additionalComments: 'Comentarios Adicionales',
    additionalCommentsPlaceholder: 'Ingrese comentarios o notas adicionales',
    cancel: 'Cancelar',
    saveWorkOrder: 'Guardar Orden de Trabajo',
    saving: 'Guardando...',
    yes: 'Sí',
    no: 'No',
    custom: 'Personalizado',
    paintOver: 'Pintar Encima',
    regularPaint: 'Pintura Regular',
    colorChange: 'Cambio de Color',
    studio: 'Estudio',
    oneBedroom: '1 Dormitorio',
    twoBedroom: '2 Dormitorios',
    threeBedroom: '3 Dormitorios',
    fourBedroom: '4 Dormitorios',
    language: 'Idioma',
    english: 'English',
    spanish: 'Español'
  }
};

function NewWorkOrder() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isSubcontractor } = useUserRole();
  
  // Language state management
  const [language, setLanguage] = useState('en');
  
  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('workOrderLanguage') || 'en';
    setLanguage(savedLanguage);
  }, []);
  
  // Save language preference to localStorage when changed
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('workOrderLanguage', newLanguage);
  };
  
  // Get current translations
  const t = translations[language];
  
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const [jobCategories, setJobCategories] = useState([]);
  const [unitSizes, setUnitSizes] = useState([]);
  const [resetImageTrigger, setResetImageTrigger] = useState(0);
  
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

  const searchParams = new URLSearchParams(location.search);
  const previewUserId = searchParams.get('userId');
  const isPreview = previewUserId && !isSubcontractor;

  useEffect(() => {
    if (jobId) {
      fetchJobData();
      fetchJobCategories();
      fetchUnitSizes();
    }
  }, [jobId]);

  const fetchJobData = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          property:properties (
            property_name
          ),
          unit_size:unit_sizes (
            unit_size_label
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      
      setJob(data);
      setFormData(prev => ({
        ...prev,
        unit_number: data.unit_number || '',
        unit_size: data.unit_size?.unit_size_label || ''
      }));
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast.error('Failed to load job data');
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
    } catch (error) {
      console.error('Error fetching job categories:', error);
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
    } catch (error) {
      console.error('Error fetching unit sizes:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to create a work order');
      return;
    }

    setLoading(true);

    try {
      const workOrderData = {
        job_id: jobId,
        prepared_by: user.id,
        submission_date: new Date().toISOString(),
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
        additional_comments: formData.additional_comments,
        is_active: true
      };

      const { error } = await supabase
        .from('work_orders')
        .insert([workOrderData]);

      if (error) throw error;

      toast.success(language === 'en' ? 'Work order created successfully!' : '¡Orden de trabajo creada exitosamente!');
      
      // Reset image trigger to clear any uploaded images
      setResetImageTrigger(prev => prev + 1);
      
      // Navigate back to job details
      navigate(`/dashboard/jobs/${jobId}${isPreview ? `?userId=${previewUserId}` : ''}`);
      
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error(language === 'en' ? 'Failed to create work order' : 'Error al crear la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Language Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/dashboard/jobs/${jobId}${isPreview ? `?userId=${previewUserId}` : ''}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.pageTitle}
            </h1>
          </div>
          
          {/* Language Toggle Dropdown */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t.language}
              </label>
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">{t.english}</option>
                  <option value="es">{t.spanish}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {isPreview && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg">
            <p className="flex items-center font-medium">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
              You are creating a work order as {isSubcontractor ? 'a subcontractor' : 'an administrator'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Unit Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.unitInformation}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t.unitNumber}
                </label>
                <input
                  type="text"
                  value={formData.unit_number}
                  onChange={(e) => handleInputChange('unit_number', e.target.value)}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t.unitNumberPlaceholder}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_occupied"
                    checked={formData.is_occupied}
                    onChange={(e) => handleInputChange('is_occupied', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_occupied" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.unitOccupied}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_full_paint"
                    checked={formData.is_full_paint}
                    onChange={(e) => handleInputChange('is_full_paint', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_full_paint" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.fullPaint}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t.unitSize}
                </label>
                <select
                  value={formData.unit_size}
                  onChange={(e) => handleInputChange('unit_size', e.target.value)}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t.selectUnitSize}</option>
                  <option value="Studio">{t.studio}</option>
                  <option value="1 Bedroom">{t.oneBedroom}</option>
                  <option value="2 Bedroom">{t.twoBedroom}</option>
                  <option value="3 Bedroom">{t.threeBedroom}</option>
                  <option value="4 Bedroom">{t.fourBedroom}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t.jobCategory}
                </label>
                <select
                  value={formData.job_category_id}
                  onChange={(e) => handleInputChange('job_category_id', e.target.value)}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t.selectJobCategory}</option>
                  {jobCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name === 'Regular Paint' ? t.regularPaint : 
                       category.name === 'Color Change' ? t.colorChange : 
                       category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Painting Details */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.paintingDetails}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Sprinklers */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_sprinklers"
                    checked={formData.has_sprinklers}
                    onChange={(e) => handleInputChange('has_sprinklers', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="has_sprinklers" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.sprinklers}
                  </label>
                </div>

                {formData.has_sprinklers && (
                  <div className="flex items-center ml-6">
                    <input
                      type="checkbox"
                      id="sprinklers_painted"
                      checked={formData.sprinklers_painted}
                      onChange={(e) => handleInputChange('sprinklers_painted', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sprinklers_painted" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {t.sprinklersPainted}
                    </label>
                  </div>
                )}
              </div>

              {/* Ceilings */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_ceilings"
                    checked={formData.painted_ceilings}
                    onChange={(e) => handleInputChange('painted_ceilings', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_ceilings" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.ceilingsPainted}
                  </label>
                </div>

                {formData.painted_ceilings && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t.ceilingRoomsCount}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.ceiling_rooms_count}
                      onChange={(e) => handleInputChange('ceiling_rooms_count', parseInt(e.target.value) || 0)}
                      className="w-24 h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Other painted items */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_patio"
                    checked={formData.painted_patio}
                    onChange={(e) => handleInputChange('painted_patio', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_patio" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.patioPainted}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_garage"
                    checked={formData.painted_garage}
                    onChange={(e) => handleInputChange('painted_garage', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_garage" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.garagePainted}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_cabinets"
                    checked={formData.painted_cabinets}
                    onChange={(e) => handleInputChange('painted_cabinets', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_cabinets" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.cabinetsPainted}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_crown_molding"
                    checked={formData.painted_crown_molding}
                    onChange={(e) => handleInputChange('painted_crown_molding', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_crown_molding" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.crownMoldingPainted}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_front_door"
                    checked={formData.painted_front_door}
                    onChange={(e) => handleInputChange('painted_front_door', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_front_door" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.frontDoorPainted}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Accent Wall Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.accentWallInfo}
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="has_accent_wall"
                  checked={formData.has_accent_wall}
                  onChange={(e) => handleInputChange('has_accent_wall', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="has_accent_wall" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {t.hasAccentWall}
                </label>
              </div>

              {formData.has_accent_wall && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t.accentWallType}
                    </label>
                    <select
                      value={formData.accent_wall_type}
                      onChange={(e) => handleInputChange('accent_wall_type', e.target.value)}
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={formData.has_accent_wall}
                    >
                      <option value="">{t.selectAccentWallType}</option>
                      <option value="Custom">{t.custom}</option>
                      <option value="Paint Over">{t.paintOver}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t.accentWallCount}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.accent_wall_count}
                      onChange={(e) => handleInputChange('accent_wall_count', parseInt(e.target.value) || 0)}
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Extra Charges */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.extraCharges}
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="has_extra_charges"
                  checked={formData.has_extra_charges}
                  onChange={(e) => handleInputChange('has_extra_charges', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="has_extra_charges" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {t.hasExtraCharges}
                </label>
              </div>

              {formData.has_extra_charges && (
                <div className="space-y-6 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t.extraChargesDescription}
                    </label>
                    <textarea
                      value={formData.extra_charges_description}
                      onChange={(e) => handleInputChange('extra_charges_description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t.extraChargesPlaceholder}
                      required={formData.has_extra_charges}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t.extraHours}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.extra_hours}
                      onChange={(e) => handleInputChange('extra_hours', parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* File Uploads */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.fileUploads}
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  {t.beforeImages}
                </h3>
                <ImageUpload
                  jobId={jobId}
                  folder="before"
                  resetTrigger={resetImageTrigger}
                />
              </div>

              {formData.has_sprinklers && (
                <div>
                  <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                    {t.sprinklerImages}
                  </h3>
                  <ImageUpload
                    jobId={jobId}
                    folder="sprinkler"
                    resetTrigger={resetImageTrigger}
                  />
                </div>
              )}

              <div>
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  {t.otherFiles}
                </h3>
                <ImageUpload
                  jobId={jobId}
                  folder="other"
                  resetTrigger={resetImageTrigger}
                />
              </div>
            </div>
          </div>

          {/* Additional Comments */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.additionalComments}
            </h2>
            
            <textarea
              value={formData.additional_comments}
              onChange={(e) => handleInputChange('additional_comments', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.additionalCommentsPlaceholder}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/jobs/${jobId}${isPreview ? `?userId=${previewUserId}` : ''}`)}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {t.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t.saveWorkOrder}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default withSubcontractorAccessCheck(NewWorkOrder);