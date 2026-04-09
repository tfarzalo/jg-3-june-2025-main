import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  FileText,
  FileEdit,
  ChevronDown,
  ChevronRight,
  Info,
  DollarSign,
  Palette,
  User,
  Globe,
  Camera,
  X,
  CheckCircle
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { format, addDays, isSameDay, isToday as dateFnsIsToday } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useUserRole } from '../contexts/UserRoleContext';
import { LoadingScreen } from './ui/LoadingScreen';
import { Lightbox } from './Lightbox';
import { SubcontractorDashboardActions } from './SubcontractorDashboardActions';
import { AssignmentCountdownTimer } from './AssignmentCountdownTimer';
import ImageUpload from './ImageUpload';



interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  assignment_status?: 'pending' | 'accepted' | 'declined' | 'auto_declined' | 'in_progress' | 'completed' | null;
  assignment_decision_at?: string | null;
  assigned_at?: string | null;
  assignment_deadline?: string | null;
  declined_reason_code?: string | null;
  declined_reason_text?: string | null;
  unit_size?: {
    unit_size_label: string;
  } | null;
  property: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  } | null;
  job_phase: {
    job_phase_label: string;
    color_dark_mode: string;
    id: string;
  } | null;
  job_type: {
    job_type_label: string;
  } | null;
  work_order?: {
    id: string;
    submission_date?: string | null;
  } | null;
  /** True when the job has a work order submitted on the same calendar day (used to show After Photos button) */
  hasWorkOrderSubmittedToday?: boolean;
}

interface PropertyDetails {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  paint_location: string;
  unit_map_file_path: string | null;
  community_manager_name: string;
  community_manager_title: string | null;
  maintenance_supervisor_name: string;
  maintenance_supervisor_title: string | null;
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  billing_categories: BillingCategory[];
  paint_colors: PaintScheme[];
  property_general_notes: PropertyGeneralNote[];
}

interface PropertyGeneralNote {
  id: string;
  topic: string;
  note_content: string;
  created_at: string;
  creator_name: string;
}

interface BillingCategory {
  id: string;
  name: string;
  is_extra_charge?: boolean | null;
  sort_order?: number;
  billing_details: BillingDetail[];
}

interface BillingDetail {
  id: string;
  bill_amount: number;
  sub_pay_amount: number;
  is_hourly: boolean;
  sort_order?: number;
  unit_size: {
    unit_size_label: string;
  };
}

interface PaintScheme {
  paint_type: string;
  rooms: PaintRoom[];
}

interface PaintRoom {
  room: string;
  color: string;
}

interface ExpandedJobs {
  [jobId: string]: boolean;
}

interface PropertyDataCache {
  [propertyId: string]: PropertyDetails;
}

export function SubcontractorDashboard() {
  const [error, setError] = useState<string | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [tomorrowJobs, setTomorrowJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayedJobs, setDisplayedJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted'>('pending');
  const [expandedJobs, setExpandedJobs] = useState<ExpandedJobs>({});
  const [propertyDataCache, setPropertyDataCache] = useState<PropertyDataCache>({});
  const [loadingProperties, setLoadingProperties] = useState<{[propertyId: string]: boolean}>({});
  const [propertyPanelTabs, setPropertyPanelTabs] = useState<{[jobId: string]: 'info' | 'notes'}>({});
  const [unitMapModalOpen, setUnitMapModalOpen] = useState<{isOpen: boolean; imageUrl: string; propertyName: string}>({
    isOpen: false,
    imageUrl: '',
    propertyName: ''
  });
  const [afterPhotosModal, setAfterPhotosModal] = useState<{
    isOpen: boolean;
    jobId: string;
    workOrderId: string;
    workOrderNum: number;
    propertyName: string;
  }>({ isOpen: false, jobId: '', workOrderId: '', workOrderNum: 0, propertyName: '' });
  const [userProfile, setUserProfile] = useState<any>(null);
  const { role } = useUserRole();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const previewUserId = searchParams.get('userId');
  const isPreview = previewUserId && (role === 'admin' || role === 'jg_management');
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [languageInitialized, setLanguageInitialized] = useState(false);

  const t = {
    en: {
      viewingAs: "You are viewing the subcontractor dashboard as",
      previewNote: "This is a preview of what the subcontractor sees. Any actions taken here will affect the actual data.",
      myAssignedJobs: "My Assigned Jobs",
      today: "Today",
      tomorrow: "Tomorrow",
      jobsFor: "Jobs for",
      newPending: "New & Pending Assignments",
      acceptedActive: "Accepted & Active Jobs",
      noJobsTitle: "No Jobs Scheduled",
      noJobsMessage: "There are no jobs scheduled for",
      moreInfo: "More Info",
      info: "Info",
      addWorkOrder: "Add Work Order",
      addWO: "Add WO",
      loadingProperty: "Loading property details...",
      positionJob: "Position / Job",
      paintLocation: "Paint Location",
      notProvided: "Not provided",
      viewUnitMap: "View Unit Map",
      paintColors: "Paint Colors",
      billingInfo: "Billing Info",
      subPayRates: "Sub Pay Rates:",
      subPay: "Sub Pay:",
      noSubRates: "No subcontractor rates available",
      tomorrowsJobs: "Tomorrow's Jobs",
      smsConsent: "SMS Messaging Consent",
      unknownProperty: "Unknown Property",
      unknownPhase: "Unknown Phase",
      unknownType: "Unknown Type",
      noAddress: "No address available",
      unit: "Unit",
      language: "Language",
      english: "English",
      spanish: "Español",
      extraCharges: "Extra Charges -",
      perHour: "/hour",
      loadingWorkspace: "Loading your workspace...",
      paintingDashboard: "PAINTING DASHBOARD",
      propertyInfoTab: "Property Info",
      notesTab: "Notes",
      generalPropertyNotes: "General Property Notes",
      noGeneralPropertyNotes: "No general property notes",
      noGeneralPropertyNotesMessage: "No notes are currently available for this property.",
      addAfterPhotos: "Add After Photos",
      addAfterPhotosShort: "After Photos",
      afterPhotosModalTitle: "Upload After Photos",
      afterPhotosModalSubtitle: "Upload photos showing the completed work for",
      afterPhotosDone: "Done"
    },
    es: {
      viewingAs: "Estás viendo el panel de subcontratista como",
      previewNote: "Esta es una vista previa de lo que ve el subcontratista. Cualquier acción realizada aquí afectará los datos reales.",
      myAssignedJobs: "Mis Trabajos Asignados",
      today: "Hoy",
      tomorrow: "Mañana",
      jobsFor: "Trabajos para",
      newPending: "Asignaciones Nuevas y Pendientes",
      acceptedActive: "Trabajos Aceptados y Activos",
      noJobsTitle: "No hay trabajos programados",
      noJobsMessage: "No hay trabajos programados para",
      moreInfo: "Más Info",
      info: "Info",
      addWorkOrder: "Crear Orden de Trabajo",
      addWO: "Crear OT",
      loadingProperty: "Cargando detalles de la propiedad...",
      positionJob: "Posición / Trabajo",
      paintLocation: "Ubicación de Pintura",
      notProvided: "No proporcionado",
      viewUnitMap: "Ver Mapa de Unidad",
      paintColors: "Colores de Pintura",
      billingInfo: "Información de Facturación",
      subPayRates: "Tarifas de Pago:",
      subPay: "Pago:",
      noSubRates: "No hay tarifas de subcontratista disponibles",
      tomorrowsJobs: "Trabajos de Mañana",
      smsConsent: "Consentimiento de Mensajería SMS",
      unknownProperty: "Propiedad Desconocida",
      unknownPhase: "Fase Desconocida",
      unknownType: "Tipo Desconocido",
      noAddress: "Dirección no disponible",
      unit: "Unidad",
      language: "Idioma",
      english: "English",
      spanish: "Español",
      extraCharges: "Cargos Adicionales -",
      perHour: "/hora",
      loadingWorkspace: "Cargando su espacio de trabajo...",
      paintingDashboard: "PANEL DE PINTURA",
      propertyInfoTab: "Información de la Propiedad",
      notesTab: "Notas",
      generalPropertyNotes: "Notas Generales de la Propiedad",
      noGeneralPropertyNotes: "No hay notas generales de la propiedad",
      noGeneralPropertyNotesMessage: "No hay notas disponibles actualmente para esta propiedad.",
      addAfterPhotos: "Agregar Fotos Finales",
      addAfterPhotosShort: "Fotos Finales",
      afterPhotosModalTitle: "Subir Fotos Finales",
      afterPhotosModalSubtitle: "Sube fotos del trabajo completado para",
      afterPhotosDone: "Listo"
    }
  };

  const text = t[language];

  // Translation mappings for database content
  const translateRoomName = (room: string): string => {
    if (language === 'en') return room;
    
    const roomTranslations: { [key: string]: string } = {
      'Walls': 'Paredes',
      'KBA': 'KBA',
      'Trim/Backsplash': 'Moldura/Salpicadero',
      'Trim': 'Moldura',
      'Backsplash': 'Salpicadero',
      "Bathroom's": 'Baños',
      'Bathrooms': 'Baños',
      'Bathroom': 'Baño',
      'Bedroom': 'Dormitorio',
      'Bedrooms': 'Dormitorios',
      'Living Room': 'Sala de Estar',
      'Kitchen': 'Cocina',
      'Dining Room': 'Comedor',
      'Hallway': 'Pasillo',
      'Entry': 'Entrada',
      'Closet': 'Armario',
      'Ceilings': 'Techos',
      'Ceiling': 'Techo',
      'Doors': 'Puertas',
      'Door': 'Puerta',
      'Windows': 'Ventanas',
      'Window': 'Ventana',
      'Baseboards': 'Zócalos',
      'Baseboard': 'Zócalo',
      'Crown Molding': 'Moldura de Corona',
      'Accent Wall': 'Pared de Acento',
      'Other': 'Otro'
    };
    
    return roomTranslations[room] || room;
  };

  const translatePaintType = (paintType: string): string => {
    if (language === 'en') return paintType;
    
    const paintTypeTranslations: { [key: string]: string } = {
      'Regular Paint': 'Pintura Regular',
      'Painted Ceilings': 'Techos Pintados',
      'Painted Cabinets': 'Gabinetes Pintados',
      'Accent Wall': 'Pared de Acento',
      'Exterior Paint': 'Pintura Exterior',
      'Trim Paint': 'Pintura de Moldura',
      'Door Paint': 'Pintura de Puerta'
    };
    
    // Handle "Floorplan X" format
    if (paintType.startsWith('Floorplan ')) {
      return paintType.replace('Floorplan', 'Plano de Planta');
    }
    
    return paintTypeTranslations[paintType] || paintType;
  };

  const translateCategoryName = (categoryName: string): string => {
    if (language === 'en') return categoryName;
    
    const categoryTranslations: { [key: string]: string } = {
      'Regular Paint': 'Pintura Regular',
      'Painted Ceilings': 'Techos Pintados',
      'Painted Cabinets': 'Gabinetes Pintados',
      'Accent Wall': 'Pared de Acento',
      'Patch/Drywall/Ceiling': 'Parche/Drywall/Techo',
      'Extra Charges': 'Cargos Adicionales',
      'Paint One Accent Wall': 'Pintar Una Pared de Acento',
      'Exterior Paint': 'Pintura Exterior',
      'Trim Paint': 'Pintura de Moldura',
      'Door Paint': 'Pintura de Puerta',
      'Window Paint': 'Pintura de Ventana',
      'Cabinet Paint': 'Pintura de Gabinete',
      'Drywall Repair': 'Reparación de Drywall',
      'Ceiling Repair': 'Reparación de Techo',
      'Other': 'Otro'
    };
    
    return categoryTranslations[categoryName] || categoryName;
  };

  const translateUnitSize = (unitSize: string): string => {
    if (language === 'en') return unitSize;
    
    const unitSizeTranslations: { [key: string]: string } = {
      '1 Bedroom': '1 Dormitorio',
      '2 Bedroom': '2 Dormitorios',
      '3 Bedroom': '3 Dormitorios',
      '4 Bedroom': '4 Dormitorios',
      'Studio': 'Estudio',
      'Loft': 'Loft',
      'Paint One Accent Wall': 'Pintar Una Pared de Acento',
      'Patch/Drywall/Ceiling': 'Parche/Drywall/Techo',
      'Paint Bedroom': 'Pintar Dormitorio',
      'Paint Bathroom': 'Pintar Baño',
      'Per Hour': 'Por Hora',
      'Hourly': 'Por Hora',
      'Other': 'Otro',
      'Each': 'Cada Uno',
      'Per Room': 'Por Habitación',
      'Per Unit': 'Por Unidad'
    };
    
    return unitSizeTranslations[unitSize] || unitSize;
  };

  const translateJobPhase = (jobPhase: string): string => {
    if (language === 'en') return jobPhase;
    
    const jobPhaseTranslations: { [key: string]: string } = {
      'Job Request': 'Solicitud de Trabajo',
      'Approved': 'Aprobado',
      'In Progress': 'En Progreso',
      'Completed': 'Completado',
      'On Hold': 'En Espera',
      'Cancelled': 'Cancelado',
      'Pending': 'Pendiente',
      'Review': 'Revisión',
      'Scheduled': 'Programado',
      'Work Order Created': 'Orden de Trabajo Creada',
      'Ready for Invoice': 'Listo para Facturar',
      'Invoiced': 'Facturado',
      'Paid': 'Pagado'
    };
    
    return jobPhaseTranslations[jobPhase] || jobPhase;
  };

  // Initialize language from profile on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Priority: 1. Profile preference (admin-set), 2. Default 'en'
        // Note: We intentionally ignore localStorage to ensure admin-set language always loads
        // Users can toggle language temporarily, but it resets on page reload
        
        let userId: string | undefined;
        
        if (previewUserId) {
          userId = previewUserId;
        } else {
          const { data: userData } = await supabase.auth.getUser();
          userId = userData.user?.id;
        }

        if (userId) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('language_preference')
            .eq('id', userId)
            .single();

          if (profileData?.language_preference === 'es') {
            setLanguage('es');
          } else {
            setLanguage('en');
          }
        } else {
          setLanguage('en'); // Fallback to English if no user
        }
      } catch (error) {
        console.error('Error initializing language:', error);
        setLanguage('en'); // Fallback to English
      } finally {
        setLanguageInitialized(true);
      }
    };

    initializeLanguage();
  }, [previewUserId]);

  // Handle language toggle - temporary for current session only
  // Note: This does NOT persist to localStorage, so admin-set language always loads on refresh
  const handleLanguageChange = (newLanguage: 'en' | 'es') => {
    setLanguage(newLanguage);
    // Intentionally NOT saving to localStorage - admin-set language should always be the default
  };

  useEffect(() => {
    const fetchJobs = async () => {
      console.log('useEffect: Initial job fetch triggered.');
      try {
        // Fetch both today's and tomorrow's jobs initially
        const [todayData, tomorrowData] = await Promise.all([
          fetchJobsForDate(new Date()),
          fetchJobsForDate(addDays(new Date(), 1))
        ]);
        console.log('fetchJobs: Today data fetched:', todayData);
        console.log('fetchJobs: Tomorrow data fetched:', tomorrowData);
        setTodayJobs(todayData || []);
        setTomorrowJobs(tomorrowData || []);

        // Set initial tab based on pending jobs
        const hasPendingJobs = [...(todayData || []), ...(tomorrowData || [])]
          .some(j => j.assignment_status === 'pending' || !j.assignment_status);
        setActiveTab(hasPendingJobs ? 'pending' : 'accepted');
      } catch (err) {
        console.error('Error fetching initial jobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setTodayJobs([]);
        setTomorrowJobs([]);
      } finally {
      }
    };

    fetchJobs();
  }, [previewUserId]); // Re-run if preview user changes

  useEffect(() => {
    console.log('useEffect: selectedDate or jobs state changed.');
    console.log('  selectedDate:', selectedDate);
    console.log('  todayJobs count:', todayJobs.length);
    console.log('  tomorrowJobs count:', tomorrowJobs.length);
    
    // Update displayed jobs when selected date changes
    if (isSameDay(selectedDate, new Date())) {
      console.log('  Setting displayedJobs to todayJobs.');
      setDisplayedJobs(todayJobs);
    } else if (isSameDay(selectedDate, addDays(new Date(), 1))) {
      console.log('  Setting displayedJobs to tomorrowJobs.');
      setDisplayedJobs(tomorrowJobs);
    } else {
      console.log('  Fetching jobs for selected date:', selectedDate);
      // For other dates, fetch jobs specifically for that date
      fetchJobsForDate(selectedDate).then(jobs => {
        console.log('  fetchJobsForDate result for selected date:', jobs);
        setDisplayedJobs(jobs || []);
      }).catch(err => {
        console.error('Error setting displayed jobs for date:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
        setDisplayedJobs([]);
      });
    }
  }, [selectedDate, todayJobs, tomorrowJobs]);

  const refreshJobsForSelectedDate = useCallback(async () => {
    const jobs = await fetchJobsForDate(selectedDate);
    if (jobs) {
      if (isSameDay(selectedDate, new Date())) {
        setTodayJobs(jobs);
      } else if (isSameDay(selectedDate, addDays(new Date(), 1))) {
        setTomorrowJobs(jobs);
      }
      setDisplayedJobs(jobs);
    }
  }, [selectedDate]);

  const handleAssignmentDecision = useCallback(async (decision: 'accepted' | 'declined') => {
    if (decision === 'accepted') {
      setActiveTab('accepted');
    }
    await refreshJobsForSelectedDate();
  }, [refreshJobsForSelectedDate]);

  useEffect(() => {
    // Show loading screen for 4 seconds, but only after language is initialized
    if (!languageInitialized) return;
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [languageInitialized]);

  // Real-time subscription for job assignment changes
  useEffect(() => {
    if (!previewUserId && !isLoading) {
      // Only set up subscription for actual subcontractors, not admin previews
      const getUserId = async () => {
        const { data: userData } = await supabase.auth.getUser();
        return userData.user?.id;
      };

      getUserId().then(userId => {
        if (!userId) return;

        const channel = supabase
          .channel('job-assignment-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'jobs',
              filter: `assigned_to=eq.${userId}`
            },
            (payload) => {
              console.log('Job assignment changed:', payload);
              // Refresh jobs when assignment status changes
              refreshJobsForSelectedDate();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      });
    }
  }, [previewUserId, isLoading, refreshJobsForSelectedDate]);

  const fetchJobsForDate = async (date: Date): Promise<Job[] | undefined> => {
    console.log('fetchJobsForDate called for date:', date);
    try {
      // Get user ID - either from query param (for preview) or current user
      let userId: string | undefined;
      
      if (previewUserId) {
        // Admin/Management is previewing a subcontractor's dashboard
        userId = previewUserId;
        console.log('fetchJobsForDate: Using preview userId:', userId);
      } else {
        // Regular subcontractor viewing their own dashboard
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('fetchJobsForDate: Supabase getUser error:', userError);
          throw userError;
        }
        if (!userData.user) {
          console.error('fetchJobsForDate: Supabase getUser returned no user.');
          throw new Error('User not found');
        }
        userId = userData.user.id;
        console.log('fetchJobsForDate: Using current userId:', userId);
      }
      
      if (!userId) {
        console.error('fetchJobsForDate: userId is null or undefined.');
        throw new Error('No user ID available');
      }
      
      // Get date range in Eastern Time
      const startOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      
      const endOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'23:59:59XXX"
      );
      
      console.log(`fetchJobsForDate: Date range (ET): ${startOfDate} to ${endOfDate}`);

      // Get job phase ID for "Job Request" phase only
      console.log('fetchJobsForDate: Fetching Job Request phase ID.');
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id, job_phase_label')
        .in('job_phase_label', ['Job Request', 'Pending Work Order', 'Work Order']);
        
      if (phaseError) {
        console.error('fetchJobsForDate: Supabase job_phases fetch error:', phaseError);
        throw phaseError;
      }
      
      if (!phaseData || phaseData.length === 0) {
        console.warn('fetchJobsForDate: phases not found in job_phases table.');
        return [];
      }
      
      const jobRequestPhaseId = phaseData.find(p => p.job_phase_label === 'Job Request')?.id;
      const pendingWOPhaseId = phaseData.find(p => p.job_phase_label === 'Pending Work Order')?.id;
      const workOrderPhaseId = phaseData.find(p => p.job_phase_label === 'Work Order')?.id;

      if (!jobRequestPhaseId) {
        console.warn('fetchJobsForDate: "Job Request" phase not found in job_phases table.');
        return [];
      }

      const activePhaseIds = [jobRequestPhaseId, pendingWOPhaseId, workOrderPhaseId].filter(Boolean) as string[];

      console.log('fetchJobsForDate: Job Request phase ID:', jobRequestPhaseId);
      
      // Get jobs assigned to this subcontractor for the selected date
      // Include Job Request phase jobs + Pending Work Order / Work Order phase jobs (for After Photos)
      console.log(`fetchJobsForDate: Fetching jobs for userId ${userId} between ${startOfDate} and ${endOfDate}`);
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          assignment_status,
          assignment_decision_at,
          assigned_at,
          assignment_deadline,
          declined_reason_code,
          declined_reason_text,
          unit_size:unit_sizes (
            unit_size_label
          ),
          property:properties (
            id,
            property_name,
            address,
            city,
            state
          ),
          job_phase:current_phase_id (
            job_phase_label,
            color_dark_mode,
            id
          ),
          job_type:job_types (
            job_type_label
          ),
          work_order:work_orders (
            id,
            submission_date
          )
        `)
        .eq('assigned_to', userId)
        .in('current_phase_id', activePhaseIds)
        .gte('scheduled_date', startOfDate)
        .lte('scheduled_date', endOfDate)
        .order('scheduled_date', { ascending: true });
        
      if (jobsError) {
        console.error('fetchJobsForDate: Supabase jobs fetch error:', jobsError);
        throw jobsError;
      }
      
            console.log('fetchJobsForDate: Raw jobs data received:', jobsData);

      // Map the data to match the Job interface and flatten nested arrays
      const mappedJobs: Job[] = (jobsData || []).map(job => {
        const wo = Array.isArray(job.work_order) ? job.work_order[0] : job.work_order;
        const submissionDate = wo?.submission_date ? new Date(wo.submission_date) : null;
        const hasWorkOrderSubmittedToday = submissionDate ? dateFnsIsToday(submissionDate) : false;
        return {
          ...job,
          property: Array.isArray(job.property) ? job.property[0] : job.property,
          job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
          job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
          work_order: wo,
          unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
          hasWorkOrderSubmittedToday,
        };
      });

      
      console.log('fetchJobsForDate: Mapped jobs:', mappedJobs);
      return mappedJobs;
      
    } catch (err) {
      console.error('Error fetching jobs for date:', date, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
      return undefined; // Return undefined on error
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatAddress = (property: Job['property']) => {
     if (!property) return 'No address available';
    return `${property.address}, ${property.city}, ${property.state}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const filteredByTab = (jobs: Job[], tab: 'pending' | 'accepted') => {
    if (tab === 'pending') {
      return jobs.filter(j => j.assignment_status === 'pending' || !j.assignment_status);
    }
    // Accepted tab: accepted/active jobs + jobs that already have a WO submitted today (for After Photos)
    return jobs.filter(j =>
      (j.assignment_status && j.assignment_status !== 'pending' && j.assignment_status !== 'declined') ||
      j.hasWorkOrderSubmittedToday
    );
  };

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0] || fullName;
  };

  const formatDateLocalized = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const nextExpanded = !prev[jobId];
      if (nextExpanded) {
        setPropertyPanelTabs(tabPrev => ({
          ...tabPrev,
          [jobId]: tabPrev[jobId] || 'info'
        }));
      }
      return {
        ...prev,
        [jobId]: nextExpanded
      };
    });
  };

  const fetchPropertyDetails = useCallback(async (propertyId: string) => {
    if (propertyDataCache[propertyId]) {
      return propertyDataCache[propertyId];
    }

    setLoadingProperties(prev => ({ ...prev, [propertyId]: true }));

    try {
      // Fetch property details with all required nested data
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select(`
          id,
          property_name,
          address,
          city,
          state,
          zip,
          paint_location,
          unit_map_file_path,
          community_manager_name,
          community_manager_title,
          maintenance_supervisor_name,
          maintenance_supervisor_title,
          primary_contact_name,
          primary_contact_role,
          paint_colors
        `)
        .eq('id', propertyId)
        .single();

      if (propertyError) {
        console.error('Error fetching property details:', propertyError);
        throw propertyError;
      }

      let propertyGeneralNotes: PropertyGeneralNote[] = [];
      try {
        const { data: notesData, error: notesError } = await supabase
          .from('property_general_notes')
          .select(`
            id,
            topic,
            note_content,
            created_at,
            creator:profiles!property_general_notes_created_by_fkey(full_name)
          `)
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false });

        if (notesError) {
          console.error('Error fetching property general notes:', notesError);
        } else {
          propertyGeneralNotes = (notesData || []).map((note: any) => ({
            id: note.id,
            topic: note.topic,
            note_content: note.note_content,
            created_at: note.created_at,
            creator_name: note.creator?.full_name || 'Unknown'
          }));
        }
      } catch (notesErr) {
        console.error('Error fetching property general notes:', notesErr);
      }

      // Fetch billing categories and details
      let billingData: any[] = [];
      let billingError: any = null;
      
      try {
          // Fetch all billing categories first, ordered by sort_order
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('billing_categories')
          .select(`
            id,
            name,
            is_extra_charge,
            sort_order
          `)
          .eq('property_id', propertyId)
          .order('sort_order', { ascending: true });

        if (categoriesError) {
          console.error('Error fetching billing categories:', categoriesError);
          billingError = categoriesError;
        } else if (categoriesData) {
          // Fetch billing details for this specific property
          const { data: billingDetailsData, error: detailsError } = await supabase
          .from('billing_details')
          .select(`
              id,
              bill_amount,
              sub_pay_amount,
              is_hourly,
              sort_order,
              category_id,
              unit_size_id,
              unit_sizes!billing_details_unit_size_id_fkey (
                unit_size_label
              )
            `)
          .eq('property_id', propertyId)
          .order('category_id', { ascending: true })
          .order('sort_order', { ascending: true });

          if (detailsError) {
            console.error('Error fetching billing details:', detailsError);
            billingError = detailsError;
          } else if (billingDetailsData) {
            // Group billing details by category
            const detailsByCategory = billingDetailsData.reduce((acc: any, detail: any) => {
              if (!acc[detail.category_id]) {
                acc[detail.category_id] = [];
              }
              acc[detail.category_id].push(detail);
              return acc;
            }, {});

            // Map categories with their billing details
            billingData = categoriesData.map(category => ({
              ...category,
              billing_details: detailsByCategory[category.id] || []
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching billing data:', err);
        billingError = err;
      }

      if (billingError) {
        console.error('Error fetching billing data:', billingError);
        // Don't throw here, just log the error
      }

      // Process billing data to match our interface
      const processedBillingData: BillingCategory[] = (billingData || []).map(category => ({
        id: category.id,
        name: category.name,
        is_extra_charge: category.is_extra_charge ?? null,
        sort_order: category.sort_order,
        billing_details: (category.billing_details || [])
          .map((detail: any) => ({
            id: detail.id,
            bill_amount: detail.bill_amount,
            sub_pay_amount: detail.sub_pay_amount,
            is_hourly: !!detail.is_hourly,
            sort_order: detail.sort_order ?? null,
            unit_size: {
              unit_size_label: Array.isArray(detail.unit_sizes) 
                ? detail.unit_sizes[0]?.unit_size_label || 'Unknown'
                : detail.unit_sizes?.unit_size_label || 'Unknown'
            }
          }))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));



      // Fetch paint colors from the new schema if available
      let paintColors: PaintScheme[] = [];
      if (propertyData.paint_colors && Array.isArray(propertyData.paint_colors)) {
        paintColors = propertyData.paint_colors;
      } else {
        // Try to fetch from the new paint colors tables
        try {
          const { data: paintData, error: paintError } = await supabase
            .from('property_paint_colors_v')
            .select('*')
            .eq('property_id', propertyId)
            .order('floorplan')
            .order('sort_order');

          if (!paintError && paintData) {
            // Group by floorplan and convert to PaintScheme format
            const groupedByFloorplan = paintData.reduce((acc: any, row) => {
              if (!acc[row.floorplan]) {
                acc[row.floorplan] = {
                  paint_type: `Floorplan ${row.floorplan}`,
                  rooms: []
                };
              }
              if (row.room && row.paint_color) {
                acc[row.floorplan].rooms.push({
                  room: row.room,
                  color: row.paint_color
                });
              }
              return acc;
            }, {});

            paintColors = Object.values(groupedByFloorplan);
          }
        } catch (paintErr) {
          console.log('Paint colors from new schema not available, using legacy data');
        }
      }

      const propertyDetails: PropertyDetails = {
        ...propertyData,
        billing_categories: processedBillingData,
        paint_colors: paintColors,
        property_general_notes: propertyGeneralNotes,
        primary_contact_name: (propertyData as any).primary_contact_name || null,
        primary_contact_role: (propertyData as any).primary_contact_role || null,
        community_manager_name: (propertyData as any).community_manager_name || '',
        community_manager_title: (propertyData as any).community_manager_title || null
      };

      // Cache the data
      setPropertyDataCache(prev => ({
        ...prev,
        [propertyId]: propertyDetails
      }));

      return propertyDetails;
    } catch (error) {
      console.error('Error fetching property details:', error);
      throw error;
    } finally {
      setLoadingProperties(prev => ({ ...prev, [propertyId]: false }));
    }
  }, [propertyDataCache]);

  const handleMoreInfoClick = async (job: Job) => {
    if (!job.property?.id) return;

    const isExpanded = expandedJobs[job.id];
    
    if (!isExpanded && !propertyDataCache[job.property.id]) {
      try {
        await fetchPropertyDetails(job.property.id);
      } catch (error) {
        console.error('Failed to fetch property details:', error);
        return;
      }
    }

    toggleJobExpansion(job.id);
  };

  const openUnitMapModal = (imageUrl: string, propertyName: string) => {
    setUnitMapModalOpen({
      isOpen: true,
      imageUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/files/${imageUrl}`,
      propertyName
    });
  };

  const closeUnitMapModal = () => {
    setUnitMapModalOpen({
      isOpen: false,
      imageUrl: '',
      propertyName: ''
    });
  };

  // Determine if selected date is today
  const isToday = isSameDay(selectedDate, new Date());
  
  // Determine if selected date is tomorrow
  const isTomorrow = isSameDay(selectedDate, addDays(new Date(), 1));

  if (isLoading) {
    return <LoadingScreen message={text.loadingWorkspace} title={text.paintingDashboard} />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {isPreview && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-3 py-2 sm:px-4 sm:py-3 rounded-lg">
          <p className="flex items-center font-medium text-sm sm:text-base">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            {text.viewingAs} {role === 'admin' ? 'an administrator' : 'JG Management'}
          </p>
          <p className="mt-1 text-xs sm:text-sm">
            {text.previewNote}
          </p>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Mobile-optimized header with 2-column layout on larger screens */}
        <div className="flex flex-col space-y-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">{text.myAssignedJobs}</h1>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
               <div className="relative flex-1 sm:flex-none">
                 <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                   <Globe className="h-4 w-4 text-gray-400" />
                 </div>
                 <select
                   value={language}
                   onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'es')}
                   className="block w-full sm:w-auto pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-[#1E293B] dark:border-gray-600 dark:text-white"
                 >
                   <option value="en">{text.english}</option>
                   <option value="es">{text.spanish}</option>
                 </select>
               </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-3 py-2 sm:px-4 text-sm sm:text-base ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              {text.today}
            </button>
            <button
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
              className={`px-3 py-2 sm:px-4 text-sm sm:text-base ${isTomorrow ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              {text.tomorrow}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Today's Jobs Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-3 sm:p-4 lg:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
            <span className="text-sm sm:text-base">{text.jobsFor} {formatDateLocalized(selectedDate)}</span>
          </h2>
          
          {/* Tabs: Pending vs Accepted */}
          <div className="mb-4 flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {text.newPending}
            </button>
            <button
              onClick={() => setActiveTab('accepted')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                activeTab === 'accepted'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {text.acceptedActive}
            </button>
          </div>

          {filteredByTab(displayedJobs, activeTab).length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{text.noJobsTitle}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {text.noJobsMessage} {formatDateLocalized(selectedDate)}.
              </p>

            </div>
          ) : (
            <div className="space-y-4">
              {filteredByTab(displayedJobs, activeTab).map(job => (
                <div 
                  key={job.id}
                  className={`bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 sm:p-4 border-l-4 ${
                    job.assignment_status === 'pending' ? 'ring-2 ring-yellow-300' : ''
                  }`}
                  style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                >
                  <div className="flex flex-col space-y-3">
                    {/* Work Order Number and Property Name - Mobile optimized */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatWorkOrderNumber(job.work_order_num)}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
                          {job.property?.property_name || text.unknownProperty}
                        </p>
                      </div>
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium self-start"
                        style={{ 
                          backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                          color: 'white'
                        }}
                      >
                        {translateJobPhase(job.job_phase?.job_phase_label || text.unknownPhase)}
                      </span>
                    </div>

                    {/* Property Address and Unit Number - Mobile optimized */}
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                          {job.property ? formatAddress(job.property) : text.noAddress}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md">
                          {text.unit} #{job.unit_number}
                        </span>
                        {job.unit_size?.unit_size_label && (
                          <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                            {translateUnitSize(job.unit_size.unit_size_label)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Job Type */}
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {job.job_type?.job_type_label || text.unknownType}
                      </span>
                    </div>

                    {/* Assignment Countdown Timer - Show for pending assignments */}
                    {(() => {
                      console.log('🔍 Countdown Timer Check:', {
                        jobId: job.id,
                        workOrderNum: job.work_order_num,
                        assignment_status: job.assignment_status,
                        assignment_deadline: job.assignment_deadline,
                        shouldShow: job.assignment_status === 'pending' && job.assignment_deadline
                      });
                      
                      if (job.assignment_status === 'pending' && job.assignment_deadline) {
                        return (
                          <div className="mt-2">
                            <AssignmentCountdownTimer 
                              deadline={job.assignment_deadline}
                              size="medium"
                              showLabel={true}
                              showIcon={true}
                              language={language}
                              onExpire={() => {
                                // Refresh jobs when deadline expires
                                refreshJobsForSelectedDate();
                              }}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Action Buttons - Pending assignments get Accept/Decline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={() => handleMoreInfoClick(job)}
                        className="inline-flex items-center justify-center px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                        aria-expanded={expandedJobs[job.id]}
                        aria-controls={`job-details-${job.id}`}
                      >
                        <Info className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">{text.moreInfo}</span>
                        <span className="sm:hidden">{text.info}</span>
                        {expandedJobs[job.id] ? (
                          <ChevronDown className="h-4 w-4 ml-1 sm:ml-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />
                        )}
                      </button>
                      
                      {activeTab === 'pending' ? (
                        <div className="flex justify-end sm:justify-start">
                          <SubcontractorDashboardActions
                            jobId={job.id}
                            workOrderNum={job.work_order_num}
                            propertyName={job.property?.property_name}
                            scheduledDate={job.scheduled_date}
                            onDecision={handleAssignmentDecision}
                            language={language}
                          />
                        </div>
                      ) : job.hasWorkOrderSubmittedToday && job.work_order?.id ? (
                        // Work order submitted today — offer After Photos upload
                        <button
                          onClick={() => setAfterPhotosModal({
                            isOpen: true,
                            jobId: job.id,
                            workOrderId: job.work_order!.id,
                            workOrderNum: job.work_order_num,
                            propertyName: job.property?.property_name ?? '',
                          })}
                          className="inline-flex items-center justify-center w-full px-3 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors touch-manipulation"
                        >
                          <Camera className="h-4 w-4 mr-2 flex-shrink-0" />
                          {text.addAfterPhotos}
                        </button>
                      ) : (
                        <Link
                          to={`/dashboard/jobs/${job.id}/new-work-order${isPreview ? `?userId=${previewUserId}` : ''}`}
                          className="inline-flex items-center justify-center px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <FileEdit className="h-4 w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">{text.addWorkOrder}</span>
                          <span className="sm:hidden">{text.addWO}</span>
                        </Link>
                      )}
                    </div>

                    {/* Property Details Accordion Panel */}
                    {expandedJobs[job.id] && (
                      <div 
                        id={`job-details-${job.id}`}
                        className="mt-4 p-3 sm:p-4 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        {loadingProperties[job.property?.id || ''] ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600 dark:text-gray-400">{text.loadingProperty}</span>
                          </div>
                        ) : (
                          (() => {
                            const cachedPropertyDetails = propertyDataCache[job.property?.id || ''];
                            const activePropertyTab = propertyPanelTabs[job.id] || 'info';

                            return (
                              <div className="space-y-4">
                                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A] p-1">
                                  <button
                                    type="button"
                                    onClick={() => setPropertyPanelTabs(prev => ({ ...prev, [job.id]: 'info' }))}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                      activePropertyTab === 'info'
                                        ? 'bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                  >
                                    {text.propertyInfoTab}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPropertyPanelTabs(prev => ({ ...prev, [job.id]: 'notes' }))}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                      activePropertyTab === 'notes'
                                        ? 'bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                  >
                                    {text.notesTab}
                                  </button>
                                </div>

                                {activePropertyTab === 'notes' ? (
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                      <FileText className="h-5 w-5 mr-2 text-slate-600 dark:text-slate-300" />
                                      {text.generalPropertyNotes}
                                    </h4>
                                    {cachedPropertyDetails?.property_general_notes?.length ? (
                                      <div className="space-y-4">
                                        {cachedPropertyDetails.property_general_notes.map((note) => (
                                          <div
                                            key={note.id}
                                            className="border-l-4 border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] rounded-r-xl p-4"
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                {note.topic}
                                              </span>
                                            </div>
                                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap mt-3 text-sm">
                                              {note.note_content}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                                              <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                                              <span>•</span>
                                              <span>{format(new Date(note.created_at), 'h:mm a')}</span>
                                              <span>•</span>
                                              <span>{note.creator_name}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        <FileText className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                                        <p className="font-medium">{text.noGeneralPropertyNotes}</p>
                                        <p className="text-sm mt-1">{text.noGeneralPropertyNotesMessage}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    {(cachedPropertyDetails?.primary_contact_name || cachedPropertyDetails?.community_manager_name || cachedPropertyDetails?.maintenance_supervisor_name) && (
                                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                          <User className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                                          {cachedPropertyDetails?.primary_contact_role || cachedPropertyDetails?.community_manager_title || cachedPropertyDetails?.maintenance_supervisor_title || text.positionJob}
                                        </h4>
                                        <p className="text-gray-800 dark:text-gray-200 text-sm">
                                          {getFirstName(
                                            cachedPropertyDetails?.primary_contact_name ||
                                            cachedPropertyDetails?.community_manager_name ||
                                            cachedPropertyDetails?.maintenance_supervisor_name ||
                                            ''
                                          )}
                                        </p>
                                      </div>
                                    )}

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                        <Palette className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                                        {text.paintLocation}
                                      </h4>
                                      {cachedPropertyDetails?.paint_location ? (
                                        <p className="text-gray-800 dark:text-gray-200 text-sm mb-3">
                                          {cachedPropertyDetails.paint_location}
                                        </p>
                                      ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm italic mb-3">{text.notProvided}</p>
                                      )}

                                      {cachedPropertyDetails?.unit_map_file_path && (
                                        <div className="mt-3">
                                          <button
                                            onClick={() => openUnitMapModal(
                                              cachedPropertyDetails.unit_map_file_path || '',
                                              cachedPropertyDetails.property_name || ''
                                            )}
                                            className="inline-flex items-center px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
                                          >
                                            <FileText className="h-4 w-4 mr-2" />
                                            {text.viewUnitMap}
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                        <Palette className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                                        {text.paintColors}
                                      </h4>
                                      {cachedPropertyDetails?.paint_colors?.length > 0 ? (
                                        <div className="space-y-3">
                                          {cachedPropertyDetails.paint_colors.map((scheme, index) => (
                                            <div key={index} className="pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                              <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{translatePaintType(scheme.paint_type)}</h5>
                                              <div className="space-y-2">
                                                {scheme.rooms.map((room, roomIndex) => (
                                                  <div key={roomIndex} className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">{translateRoomName(room.room)}</span>
                                                    <span className="text-gray-800 dark:text-gray-200 font-medium">{room.color}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm italic">{text.notProvided}</p>
                                      )}
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                        <DollarSign className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                                        {text.billingInfo}
                                      </h4>
                                      {(() => {
                                        const allCategories = cachedPropertyDetails?.billing_categories || [];

                                        const subcontractorCategories = allCategories.filter(category =>
                                          category.billing_details.some(detail => detail.sub_pay_amount > 0)
                                        );

                                        const sortedSubcontractorCategories = [...subcontractorCategories].sort(
                                          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                                        );

                                        const standardCategories = sortedSubcontractorCategories.filter(
                                          category => !category.is_extra_charge
                                        );

                                        const extraChargeCategories = sortedSubcontractorCategories.filter(
                                          category => category.is_extra_charge && category.name !== 'Extra Charges'
                                        );

                                        const renderCategory = (category: BillingCategory, labelPrefix?: string) => {
                                          const subPayDetails = category.billing_details.filter(
                                            detail => detail.sub_pay_amount > 0
                                          );

                                          if (subPayDetails.length === 0) return null;

                                          return (
                                            <div key={category.id} className="pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                              <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                                                {labelPrefix ? `${labelPrefix} ${translateCategoryName(category.name)}` : translateCategoryName(category.name)}
                                              </h5>
                                              <div className="mb-3">
                                                <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                  {text.subPayRates}
                                                </h6>
                                                <div className="space-y-2">
                                                  {subPayDetails.map(detail => (
                                                    <div key={detail.id} className="flex justify-between items-center text-sm">
                                                      <span className="text-gray-600 dark:text-gray-400">
                                                        {translateUnitSize(detail.unit_size.unit_size_label)}
                                                      </span>
                                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                                        {text.subPay} {formatCurrency(detail.sub_pay_amount)}
                                                        {detail.is_hourly ? text.perHour : ''}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        };

                                        return subcontractorCategories.length > 0 ? (
                                          <div className="space-y-3">
                                            {standardCategories.map(category => renderCategory(category))}
                                            {extraChargeCategories.map(category =>
                                              renderCategory(category, text.extraCharges)
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                                            {text.noSubRates}
                                          </p>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow's Jobs Section */}
          {isToday && tomorrowJobs.length > 0 && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-3 sm:p-4 lg:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                {text.tomorrowsJobs}
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {tomorrowJobs.map(job => (
                  <div 
                    key={job.id}
                    className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 border-l-2"
                    style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {formatWorkOrderNumber(job.work_order_num)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {job.property?.property_name || text.unknownProperty}
                          </p>
                        </div>
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2"
                          style={{ 
                            backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                            color: 'white'
                          }}
                        >
                          {translateJobPhase(job.job_phase?.job_phase_label || text.unknownPhase)}
                        </span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {text.unit} #{job.unit_number}
                          </span>
                          {job.unit_size?.unit_size_label && (
                            <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                              {translateUnitSize(job.unit_size.unit_size_label)}
                            </span>
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {job.job_type?.job_type_label || text.unknownType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-6 text-center">
        <Link
          to="/sms-consent"
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2"
        >
          {text.smsConsent}
        </Link>
      </div>

      {/* Unit Map Modal */}
      {unitMapModalOpen.isOpen && (
        <Lightbox
          isOpen={unitMapModalOpen.isOpen}
          onClose={closeUnitMapModal}
          imageUrl={unitMapModalOpen.imageUrl}
          imageAlt={`${unitMapModalOpen.propertyName} Unit Map`}
        />
      )}

      {/* After Photos Upload Modal */}
      {afterPhotosModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            // Close when tapping the backdrop
            if (e.target === e.currentTarget)
              setAfterPhotosModal({ isOpen: false, jobId: '', workOrderId: '', workOrderNum: 0, propertyName: '' });
          }}
        >
          {/* Sheet on mobile (slides up), card on sm+ */}
          <div className="bg-white dark:bg-[#1E293B] rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg flex flex-col h-[92svh] sm:h-auto sm:max-h-[88vh]">

            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                  <Camera className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                    {text.afterPhotosModalTitle}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {afterPhotosModal.propertyName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAfterPhotosModal({ isOpen: false, jobId: '', workOrderId: '', workOrderNum: 0, propertyName: '' })}
                className="ml-3 flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable upload area */}
            <div className="flex-1 overflow-y-auto p-4">
              <ImageUpload
                jobId={afterPhotosModal.jobId}
                workOrderId={afterPhotosModal.workOrderId}
                folder="after"
                onUploadComplete={() => refreshJobsForSelectedDate()}
                onError={(err) => setError(err)}
              />
            </div>

            {/* Footer — full-width button on mobile */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setAfterPhotosModal({ isOpen: false, jobId: '', workOrderId: '', workOrderNum: 0, propertyName: '' })}
                className="w-full sm:w-auto sm:ml-auto flex items-center justify-center px-6 py-3 sm:py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base sm:text-sm font-semibold rounded-xl sm:rounded-lg transition-colors touch-manipulation"
              >
                <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                {text.afterPhotosDone}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubcontractorDashboard;
