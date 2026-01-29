import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowUpDown,
  ClipboardList, 
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  Archive,
  RefreshCw,
  Trash2,
  X,
  Mailbox,
  CheckCircle
} from 'lucide-react';
import { parseISO, format, subMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';

export interface Job {
  id: string;
  property: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  };
  unit_number: string;
  unit_size: {
    unit_size_label: string;
    id?: string;
  };
  job_type: {
    job_type_label: string;
  };
  scheduled_date: string;
  due_date?: string;
  completed_date?: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  assigned_to?: string;
  assigned_to_profile?: {
    full_name: string;
  };
  job_phase: {
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  } | null;
  work_order_num: number;
  total_billing_amount?: number;
  invoice_sent?: boolean;
  invoice_paid?: boolean;
  invoice_sent_date?: string;
  invoice_paid_date?: string;
  billing_details?: {
    bill_amount?: number | null;
    sub_pay_amount?: number | null;
    profit_amount?: number | null;
  };
  extra_charges_details?: {
    bill_amount?: number;
    sub_pay_amount?: number;
    profit_amount?: number;
  };
  work_orders?: Array<{
    submission_date?: string;
    is_occupied?: boolean;
    is_full_paint?: boolean;
    unit_size?: string;
    paint_type?: string;
    has_sprinklers?: boolean;
    sprinklers_painted?: boolean;
    painted_ceilings?: boolean;
    ceiling_rooms_count?: number;
    painted_patio?: boolean;
    painted_garage?: boolean;
    painted_cabinets?: boolean;
    painted_crown_molding?: boolean;
    painted_front_door?: boolean;
    cabinet_removal_repair?: string;
    ceiling_lights_repair?: string;
    has_accent_wall?: boolean;
    accent_wall_type?: string;
    accent_wall_count?: number;
    has_extra_charges?: boolean;
    extra_charges_description?: string;
    extra_hours?: number;
    additional_comments?: string;
  }>;
  purchase_order?: string | null;
}

interface ExportConfig {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  columns: {
    // Job Information
    workOrder: boolean;
    phase: boolean;
    property: boolean;
    address: boolean;
    unitNumber: boolean;
    unitSize: boolean;
    jobType: boolean;
    purchaseOrder: boolean;
    scheduledDate: boolean;
    lastModificationDate: boolean;
    description: boolean;
    assignedTo: boolean;
    jobStatus: boolean;
    // Work Order Information
    submissionDate: boolean;
    isOccupied: boolean;
    isFullPaint: boolean;
    paintType: boolean;
    hasSprinklers: boolean;
    sprinklersPainted: boolean;
    paintedCeilings: boolean;
    ceilingRoomsCount: boolean;
    paintedPatio: boolean;
    paintedGarage: boolean;
    paintedCabinets: boolean;
    paintedCrownMolding: boolean;
    paintedFrontDoor: boolean;
    cabinetRemovalRepair: boolean;
    ceilingLightsRepair: boolean;
    hasAccentWall: boolean;
    accentWallType: boolean;
    accentWallCount: boolean;
    hasExtraCharges: boolean;
    extraChargesDescription: boolean;
    extraChargesLineItems: boolean;
    extraHours: boolean;
    additionalComments: boolean;
    // Billing/Invoice Information
    invoiceSent: boolean;
    invoicePaid: boolean;
    invoiceSentDate: boolean;
    invoicePaidDate: boolean;
    // Billing Breakdown
    baseBillToCustomer: boolean;
    basePayToSubcontractor: boolean;
    baseProfit: boolean;
    extraChargesBillToCustomer: boolean;
    extraChargesPayToSubcontractor: boolean;
    extraChargesProfit: boolean;
    totalBillToCustomer: boolean;
    totalPayToSubcontractor: boolean;
    totalProfit: boolean;
  };
}

export type SortField = 'work_order_num' | 'job_phase' | 'property_name' | 'unit_number' | 'unit_size' | 'job_type' | 'scheduled_date' | 'total_billing_amount';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface JobListingPageProps {
  title: string;
  jobs: Job[];
  loading: boolean;
  error: string | null;
  phaseLabel?: string | string[]; // Phase(s) to export - if not provided, uses all jobs passed in
  showAddButton?: boolean;
  addButtonLink?: string;
  isArchive?: boolean;
  refetch?: () => Promise<void>;
  hideAmountColumn?: boolean;
  showArchivesButton?: boolean;
  showInvoiceColumns?: boolean;
  initialSortConfig?: SortConfig;
}

const JOB_EXPORT_SELECT = `
  id,
  work_order_num,
  unit_number,
  scheduled_date,
  created_at,
  updated_at,
  description,
  purchase_order,
  total_billing_amount,
  invoice_sent,
  invoice_paid,
  invoice_sent_date,
  invoice_paid_date,
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
  ),
  job_phase:current_phase_id (
    job_phase_label,
    color_light_mode,
    color_dark_mode
  ),
  assigned_to_profile:assigned_to (
    full_name
  )
`;

export function formatAddress(property: Job['property']) {
  const parts = [
    property.address,
    property.city,
    property.state
  ].filter(Boolean);
  return parts.join(', ');
}

export function formatWorkOrderNumber(num: number) {
  return `WO-${String(num).padStart(6, '0')}`;
}

export function formatDate(dateString: string) {
  try {
    return formatInTimeZone(
      parseISO(dateString),
      'America/New_York',
      'MMM d, yyyy'
    );
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return dateString;
  }
}

export function JobListingPage({ 
  title, 
  jobs, 
  loading, 
  error,
  phaseLabel,
  showAddButton = false,
  addButtonLink = '/dashboard/jobs/new',
  isArchive = false,
  refetch,
  hideAmountColumn = false,
  showArchivesButton = false,
  showInvoiceColumns = false,
  initialSortConfig
}: JobListingPageProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
  
  // Load export preferences from localStorage or use defaults
  const [exportConfig, setExportConfig] = useState<ExportConfig>(() => {
    const saved = localStorage.getItem('jobExportConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved export config:', e);
      }
    }
    return {
      dateRange: {
        startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      },
      columns: {
        // Job Information
        workOrder: true,
        phase: true,
        property: true,
        address: true,
        unitNumber: true,
        unitSize: true,
        jobType: true,
        purchaseOrder: false,
        scheduledDate: true,
        lastModificationDate: false,
        description: false,
        assignedTo: false,
        jobStatus: false,
        // Work Order Information
        submissionDate: false,
        isOccupied: false,
        isFullPaint: false,
        paintType: false,
        hasSprinklers: false,
        sprinklersPainted: false,
        paintedCeilings: false,
        ceilingRoomsCount: false,
        paintedPatio: false,
        paintedGarage: false,
        paintedCabinets: false,
        paintedCrownMolding: false,
        paintedFrontDoor: false,
        cabinetRemovalRepair: false,
        ceilingLightsRepair: false,
        hasAccentWall: false,
        accentWallType: false,
        accentWallCount: false,
        hasExtraCharges: false,
        extraChargesDescription: false,
        extraChargesLineItems: false,
        extraHours: false,
        additionalComments: false,
        // Billing/Invoice Information
        invoiceSent: false,
        invoicePaid: false,
        invoiceSentDate: false,
        invoicePaidDate: false,
        // Billing Breakdown
        baseBillToCustomer: false,
        basePayToSubcontractor: false,
        baseProfit: false,
        extraChargesBillToCustomer: false,
        extraChargesPayToSubcontractor: false,
        extraChargesProfit: false,
        totalBillToCustomer: false,
        totalPayToSubcontractor: false,
        totalProfit: false
      }
    };
  });
  
  const [expandedSections, setExpandedSections] = useState({
    jobInfo: false,
    billingInfo: false,
    workOrderInfo: false
  });
  
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSortConfig || {
    field: 'scheduled_date',
    direction: 'desc'
  });

  useEffect(() => {
    if (initialSortConfig) {
      setSortConfig(initialSortConfig);
    }
  }, [initialSortConfig]);

  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSort = (field: SortField) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedJobs = (jobs: Job[]) => {
    return [...jobs].sort((a, b) => {
      let comparison = 0;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.field) {
        case 'work_order_num':
          comparison = a.work_order_num - b.work_order_num;
          break;
        case 'job_phase':
          comparison = (a.job_phase?.job_phase_label || '').localeCompare(b.job_phase?.job_phase_label || '');
          break;
        case 'property_name':
          comparison = a.property.property_name.localeCompare(b.property.property_name);
          break;
        case 'unit_number':
          comparison = a.unit_number.localeCompare(b.unit_number);
          break;
        case 'unit_size':
          comparison = a.unit_size.unit_size_label.localeCompare(b.unit_size.unit_size_label);
          break;
        case 'job_type':
          comparison = a.job_type.job_type_label.localeCompare(b.job_type.job_type_label);
          break;
        case 'scheduled_date':
          // Use string comparison for date-only fields (YYYY-MM-DD)
          // This avoids timezone issues from parseISO treating YYYY-MM-DD as UTC
          comparison = a.scheduled_date.localeCompare(b.scheduled_date);
          break;
        case 'total_billing_amount':
          comparison = (a.total_billing_amount || 0) - (b.total_billing_amount || 0);
          break;
      }

      // If primary sort is not equal, return it
      if (comparison !== 0) {
        return comparison * direction;
      }

      // Secondary sort: Most recent (updated_at or scheduled_date) first
      // This is always descending (newest first)
      // Use string comparison for scheduled_date (YYYY-MM-DD), parseISO for updated_at (timestamp)
      const dateA = a.updated_at || a.scheduled_date;
      const dateB = b.updated_at || b.scheduled_date;
      return dateB.localeCompare(dateA);
    });
  };

  const handleExportClick = (type: 'csv' | 'pdf') => {
    setExportType(type);
    // Always reset date range to current default (30 days prior to today)
    setExportConfig(prev => ({
      ...prev,
      dateRange: {
        startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      }
    }));
    setShowExportConfig(true);
    setShowExportMenu(false);
  };

  const handleExportConfigSubmit = async () => {
    // Save preferences to localStorage
    localStorage.setItem('jobExportConfig', JSON.stringify(exportConfig));
    
    if (exportType === 'csv') {
      await exportToCSV();
    } else if (exportType === 'pdf') {
      await exportToPDF();
    }
    setShowExportConfig(false);
  };

  const toggleSection = (section: 'jobInfo' | 'billingInfo' | 'workOrderInfo') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleAllInSection = (section: 'jobInfo' | 'billingInfo' | 'workOrderInfo', checked: boolean) => {
    setExportConfig(prev => {
      const newColumns = { ...prev.columns };
      if (section === 'jobInfo') {
        const jobFields: (keyof typeof newColumns)[] = [
          'workOrder', 'phase', 'property', 'address', 'unitNumber', 'unitSize',
          'jobType', 'purchaseOrder', 'scheduledDate', 'lastModificationDate', 'description', 'assignedTo', 'jobStatus'
        ];
        jobFields.forEach(field => {
          newColumns[field] = checked;
        });
      } else if (section === 'billingInfo') {
        const billingFields: (keyof typeof newColumns)[] = [
          'invoiceSent', 'invoicePaid', 'invoiceSentDate', 'invoicePaidDate',
          'baseBillToCustomer', 'basePayToSubcontractor', 'baseProfit',
          'extraChargesBillToCustomer', 'extraChargesPayToSubcontractor', 'extraChargesProfit', 'extraChargesLineItems',
          'totalBillToCustomer', 'totalPayToSubcontractor', 'totalProfit'
        ];
        billingFields.forEach(field => {
          newColumns[field] = checked;
        });
      } else {
        const workOrderFields: (keyof typeof newColumns)[] = [
          'submissionDate', 'isOccupied', 'isFullPaint', 'paintType', 'hasSprinklers',
          'sprinklersPainted', 'paintedCeilings', 'ceilingRoomsCount', 'paintedPatio',
          'paintedGarage', 'paintedCabinets', 'paintedCrownMolding', 'paintedFrontDoor',
          'cabinetRemovalRepair', 'ceilingLightsRepair', 'hasAccentWall', 'accentWallType',
          'accentWallCount', 'hasExtraCharges', 'extraChargesDescription', 'extraChargesLineItems', 'extraHours',
          'additionalComments'
        ];
        workOrderFields.forEach(field => {
          newColumns[field] = checked;
        });
      }
      return { ...prev, columns: newColumns };
    });
  };

  const calculateExtraChargesTotals = (lineItems: any[]) => {
    return lineItems.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity) || 0;
        const billRate = Number(item.billRate) || 0;
        const subRate = Number(item.subRate) || 0;
        const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
        const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
        acc.bill += billAmount;
        acc.sub += subAmount;
        if (item.isHourly) acc.hours += quantity;
        return acc;
      },
      { bill: 0, sub: 0, hours: 0 }
    );
  };

  const formatExtraChargeLineItems = (lineItems: any[]) => {
    if (!lineItems.length) return 'N/A';
    return lineItems
      .map((item) => {
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.billRate) || 0;
        const unitLabel = item.isHourly ? 'hrs' : 'units';
        const rateText = rate ? ` @ $${rate.toFixed(2)}` : '';
        return `${item.categoryName}: ${item.detailName} (${quantity} ${unitLabel}${rateText})`;
      })
      .join('; ');
  };

  const exportToCSV = async () => {
    try {
      let allJobsForExport: Job[] = [];

      const transformJobsData = (jobsData: any[] | null | undefined): Job[] =>
        (jobsData || []).map(job => ({
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          scheduled_date: job.scheduled_date,
          created_at: job.created_at,
          updated_at: job.updated_at,
          description: job.description,
          total_billing_amount: job.total_billing_amount,
          invoice_sent: job.invoice_sent,
          invoice_paid: job.invoice_paid,
          invoice_sent_date: job.invoice_sent_date,
          invoice_paid_date: job.invoice_paid_date,
          property: Array.isArray(job.property) ? job.property[0] : job.property,
          unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
          job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
          purchase_order: job.purchase_order,
          job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase
        }));

      if (phaseLabel) {
        console.log(`Fetching all jobs for phase(s): ${Array.isArray(phaseLabel) ? phaseLabel.join(', ') : phaseLabel}`);
        
        // Get phase IDs
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel]);

        if (phaseError) {
          console.error('Error fetching phases:', phaseError);
          toast.error('Failed to fetch job phases');
          return;
        }

        if (!phaseData || phaseData.length === 0) {
          toast.error('No matching job phases found');
          return;
        }

        // Fetch ALL jobs for these phases (with explicit no limit)
        const phaseIds = phaseData.map(p => p.id);
        console.log('Phase IDs for export:', phaseIds);
        
        const { data: jobsData, error: jobsError, count } = await supabase
          .from('jobs')
          .select(JOB_EXPORT_SELECT, { count: 'exact' })
          .in('current_phase_id', phaseIds)
          .order('created_at', { ascending: false })
          .limit(10000); // Explicit high limit to ensure we get all jobs
        
        console.log(`Database returned ${jobsData?.length || 0} jobs out of ${count} total for phase IDs:`, phaseIds);

        if (jobsError) {
          console.error('Error fetching jobs:', jobsError);
          toast.error('Failed to fetch jobs for export');
          return;
        }

        if (!jobsData || jobsData.length === 0) {
          toast.error('No jobs found for this phase');
          return;
        }

        // Transform to Job interface
        allJobsForExport = transformJobsData(jobsData);
        console.log(`Fetched ${allJobsForExport.length} total jobs from database for export`);
      } else {
        // Use jobs from props if no phaseLabel provided
        allJobsForExport = jobs;
        console.log(`Using ${allJobsForExport.length} jobs from page props for export`);
      }

      // Filter by date range only
      const filteredJobs = allJobsForExport.filter(job => {
        // Check date range - use string comparison for YYYY-MM-DD dates
        // This avoids timezone issues from parseISO treating YYYY-MM-DD as UTC
        try {
          const jobDate = job.scheduled_date;
          const startDate = exportConfig.dateRange.startDate;
          const endDate = exportConfig.dateRange.endDate;
          
          // String comparison works for YYYY-MM-DD format
          const isInDateRange = jobDate >= startDate && jobDate <= endDate;
          return isInDateRange;
        } catch (error) {
          console.error('Error comparing date for job', job.id, error);
          return false; // Exclude jobs with invalid dates
        }
      });

      console.log(`Exporting ${filteredJobs.length} jobs out of ${allJobsForExport.length} total jobs after date filtering`);
      console.log(`Date range: ${exportConfig.dateRange.startDate} to ${exportConfig.dateRange.endDate}`);

      if (filteredJobs.length === 0) {
        toast.error('No jobs match the selected date range');
        return;
      }

      // Check if we need to fetch full billing data
      const needsBillingData = Object.entries(exportConfig.columns).some(([key, val]) => 
        ['baseBillToCustomer', 'basePayToSubcontractor', 'baseProfit',
         'extraChargesBillToCustomer', 'extraChargesPayToSubcontractor', 'extraChargesProfit', 'extraChargesLineItems',
         'totalBillToCustomer', 'totalPayToSubcontractor', 'totalProfit'].includes(key) && val
      );

      // Fetch full job details for each job if billing data is needed
    let jobDetailsMap: Record<string, any> = {};
    
    if (needsBillingData) {
      try {
        console.log(`Fetching billing data for ${filteredJobs.length} jobs...`);
        
        // Fetch job details in batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < filteredJobs.length; i += batchSize) {
          const batch = filteredJobs.slice(i, i + batchSize);
          const batchPromises = batch.map(async (job) => {
            try {
              const { data, error } = await supabase.rpc('get_job_details', { p_job_id: job.id });
              if (error) {
                console.error(`Error fetching details for job ${job.id}:`, error);
                return { jobId: job.id, data: null };
              }
              
              return { jobId: job.id, data };
            } catch (err) {
              console.error(`Exception fetching details for job ${job.id}:`, err);
              return { jobId: job.id, data: null };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(result => {
            if (result.data) {
              jobDetailsMap[result.jobId] = result.data;
            }
          });
        }
        
        console.log(`Successfully fetched billing data for ${Object.keys(jobDetailsMap).length} jobs`);
      } catch (error) {
        console.error('Error fetching job details for export:', error);
        toast.error('Some billing data may be missing from export');
      }
    }

    // Fetch work orders for the filtered jobs if needed
    const hasWorkOrderFields = Object.entries(exportConfig.columns).some(([key, val]) => 
      (key.includes('is') || key.includes('painted') || key.includes('has') || 
      key.includes('extra') || key.includes('accent') || key.includes('submission') ||
      key.includes('cabinet') || key.includes('ceiling') || key.includes('additional') ||
      key.includes('sprinklers') || key === 'paintType') && val
    );

    let workOrdersMap: Record<string, any> = {};
    if (hasWorkOrderFields || needsBillingData) {
      const { data: workOrdersData } = await supabase
        .from('work_orders')
        .select('*')
        .in('job_id', filteredJobs.map(j => j.id));
      
      if (workOrdersData) {
        workOrdersMap = workOrdersData.reduce((acc, wo) => {
          acc[wo.job_id] = wo;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    const data = filteredJobs.map(job => {
      const row: Record<string, string> = {};
      const workOrder = workOrdersMap[job.id];
      const jobDetails = jobDetailsMap[job.id]; // Full job details with billing breakdown
      const extraChargeLineItems = Array.isArray(jobDetails?.work_order?.extra_charges_line_items)
        ? jobDetails.work_order.extra_charges_line_items
        : (Array.isArray(workOrder?.extra_charges_line_items) ? workOrder.extra_charges_line_items : []);
      const hasExtraChargeItems = extraChargeLineItems.length > 0;
      const extraChargeTotals = hasExtraChargeItems ? calculateExtraChargesTotals(extraChargeLineItems) : { bill: null, sub: null, hours: null };
      
      // Job Information
      if (exportConfig.columns.workOrder) row['Work Order #'] = formatWorkOrderNumber(job.work_order_num);
      if (exportConfig.columns.phase) row['Phase'] = job.job_phase?.job_phase_label || 'N/A';
      if (exportConfig.columns.property) row['Property'] = job.property.property_name || 'N/A';
      if (exportConfig.columns.address) row['Address'] = formatAddress(job.property) || 'N/A';
      if (exportConfig.columns.unitNumber) row['Unit #'] = job.unit_number || 'N/A';
      if (exportConfig.columns.unitSize) row['Unit Size'] = job.unit_size.unit_size_label || 'N/A';
      if (exportConfig.columns.jobType) row['Job Type'] = job.job_type.job_type_label || 'N/A';
      if (exportConfig.columns.purchaseOrder) row['PO#'] = job.purchase_order || 'None';
      if (exportConfig.columns.scheduledDate) row['Scheduled Date'] = job.scheduled_date ? formatDate(job.scheduled_date) : 'N/A';
      if (exportConfig.columns.lastModificationDate) row['Last Modification Date'] = job.updated_at ? formatDate(job.updated_at) : 'N/A';
      if (exportConfig.columns.description) row['Description'] = job.description || 'N/A';
      if (exportConfig.columns.assignedTo) row['Assigned To'] = job.assigned_to_profile?.full_name || 'Unassigned';
      if (exportConfig.columns.jobStatus) row['Job Status'] = job.job_phase?.job_phase_label || 'N/A';
      
      // Work Order Information
      if (exportConfig.columns.submissionDate) row['Submission Date'] = job.created_at ? formatDate(job.created_at) : 'N/A';
      if (exportConfig.columns.isOccupied) row['Is Occupied'] = workOrder?.is_occupied === true ? 'Yes' : workOrder?.is_occupied === false ? 'No' : 'N/A';
      if (exportConfig.columns.isFullPaint) row['Full Paint'] = workOrder?.is_full_paint === true ? 'Yes' : workOrder?.is_full_paint === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintType) row['Paint Type'] = workOrder?.paint_type || 'N/A';
      if (exportConfig.columns.hasSprinklers) row['Has Sprinklers'] = workOrder?.has_sprinklers === true ? 'Yes' : workOrder?.has_sprinklers === false ? 'No' : 'N/A';
      if (exportConfig.columns.sprinklersPainted) row['Sprinklers Painted'] = workOrder?.sprinklers_painted === true ? 'Yes' : workOrder?.sprinklers_painted === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintedCeilings) row['Painted Ceilings'] = workOrder?.painted_ceilings === true ? 'Yes' : workOrder?.painted_ceilings === false ? 'No' : 'N/A';
      if (exportConfig.columns.ceilingRoomsCount) row['Ceiling Rooms Count'] = workOrder?.ceiling_rooms_count ? String(workOrder.ceiling_rooms_count) : 'N/A';
      if (exportConfig.columns.paintedPatio) row['Painted Patio'] = workOrder?.painted_patio === true ? 'Yes' : workOrder?.painted_patio === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintedGarage) row['Painted Garage'] = workOrder?.painted_garage === true ? 'Yes' : workOrder?.painted_garage === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintedCabinets) row['Painted Cabinets'] = workOrder?.painted_cabinets === true ? 'Yes' : workOrder?.painted_cabinets === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintedCrownMolding) row['Painted Crown Molding'] = workOrder?.painted_crown_molding === true ? 'Yes' : workOrder?.painted_crown_molding === false ? 'No' : 'N/A';
      if (exportConfig.columns.paintedFrontDoor) row['Painted Front Door'] = workOrder?.painted_front_door === true ? 'Yes' : workOrder?.painted_front_door === false ? 'No' : 'N/A';
      if (exportConfig.columns.cabinetRemovalRepair) row['Cabinet Removal/Repair'] = workOrder?.cabinet_removal_repair || 'N/A';
      if (exportConfig.columns.ceilingLightsRepair) row['Ceiling Lights Repair'] = workOrder?.ceiling_lights_repair || 'N/A';
      if (exportConfig.columns.hasAccentWall) row['Has Accent Wall'] = workOrder?.has_accent_wall === true ? 'Yes' : workOrder?.has_accent_wall === false ? 'No' : 'N/A';
      if (exportConfig.columns.accentWallType) row['Accent Wall Type'] = workOrder?.accent_wall_type || 'N/A';
      if (exportConfig.columns.accentWallCount) row['Accent Wall Count'] = workOrder?.accent_wall_count ? String(workOrder.accent_wall_count) : 'N/A';
      if (exportConfig.columns.hasExtraCharges) row['Has Extra Charges'] = workOrder?.has_extra_charges === true ? 'Yes' : workOrder?.has_extra_charges === false ? 'No' : 'N/A';
      if (exportConfig.columns.extraChargesDescription) {
        row['Extra Charges Description'] = hasExtraChargeItems ? 'Itemized Extra Charges' : (workOrder?.extra_charges_description || 'N/A');
      }
      if (exportConfig.columns.extraChargesLineItems) {
        row['Extra Charges Line Items'] = formatExtraChargeLineItems(extraChargeLineItems);
      }
      if (exportConfig.columns.extraHours) {
        const hoursValue = hasExtraChargeItems ? extraChargeTotals.hours : workOrder?.extra_hours;
        row['Extra Hours'] = (hoursValue ?? null) !== null ? String(hoursValue) : 'N/A';
      }
      if (exportConfig.columns.additionalComments) row['Additional Comments'] = workOrder?.additional_comments || 'N/A';
      
      // Billing/Invoice Information
      if (exportConfig.columns.invoiceSent) row['Invoice Sent'] = job.invoice_sent === true ? 'Yes' : job.invoice_sent === false ? 'No' : 'N/A';
      if (exportConfig.columns.invoicePaid) row['Invoice Paid'] = job.invoice_paid === true ? 'Yes' : job.invoice_paid === false ? 'No' : 'N/A';
      if (exportConfig.columns.invoiceSentDate) row['Invoice Sent Date'] = job.invoice_sent_date ? formatDate(job.invoice_sent_date) : 'N/A';
      if (exportConfig.columns.invoicePaidDate) row['Invoice Paid Date'] = job.invoice_paid_date ? formatDate(job.invoice_paid_date) : 'N/A';
      
      // Billing Breakdown - Use data from jobDetails (get_job_details RPC)
      // Base Billing
      const baseBillAmount = jobDetails?.billing_details?.bill_amount ?? null;
      const baseSubPayAmount = jobDetails?.billing_details?.sub_pay_amount ?? null;
      const baseProfit = (baseBillAmount !== null && baseSubPayAmount !== null) ? baseBillAmount - baseSubPayAmount : null;
      
      if (exportConfig.columns.baseBillToCustomer) row['Base Bill to Customer'] = baseBillAmount !== null ? `$${baseBillAmount.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.basePayToSubcontractor) row['Base Pay to Subcontractor'] = baseSubPayAmount !== null ? `$${baseSubPayAmount.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.baseProfit) row['Base Profit'] = baseProfit !== null ? `$${baseProfit.toFixed(2)}` : 'N/A';
      
      // Extra Charges
      const extraChargesBillAmount = hasExtraChargeItems
        ? extraChargeTotals.bill
        : (jobDetails?.extra_charges_details?.bill_amount ?? null);
      const extraChargesSubPayAmount = hasExtraChargeItems
        ? extraChargeTotals.sub
        : (jobDetails?.extra_charges_details?.sub_pay_amount ?? null);
      const extraChargesProfit = (extraChargesBillAmount !== null && extraChargesSubPayAmount !== null) 
        ? extraChargesBillAmount - extraChargesSubPayAmount 
        : null;

      if (exportConfig.columns.extraChargesBillToCustomer) row['Extra Charges Bill to Customer'] = extraChargesBillAmount !== null ? `$${extraChargesBillAmount.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.extraChargesPayToSubcontractor) row['Extra Charges Pay to Subcontractor'] = extraChargesSubPayAmount !== null ? `$${extraChargesSubPayAmount.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.extraChargesProfit) row['Extra Charges Profit'] = extraChargesProfit !== null ? `$${extraChargesProfit.toFixed(2)}` : 'N/A';
      
      // Grand Totals - matching the BillingBreakdownV2 calculation exactly
      const totalBillToCustomer = 
        (baseBillAmount ?? 0) + 
        (extraChargesBillAmount ?? 0);
      const totalPayToSubcontractor = 
        (baseSubPayAmount ?? 0) + 
        (extraChargesSubPayAmount ?? 0);
      const totalProfit = totalBillToCustomer - totalPayToSubcontractor;
      
      // Only show N/A if ALL billing components are null
      const hasBillingData = baseBillAmount !== null || extraChargesBillAmount !== null;
      
      if (exportConfig.columns.totalBillToCustomer) row['Total Bill to Customer'] = hasBillingData ? `$${totalBillToCustomer.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.totalPayToSubcontractor) row['Total Pay to Subcontractor'] = hasBillingData ? `$${totalPayToSubcontractor.toFixed(2)}` : 'N/A';
      if (exportConfig.columns.totalProfit) row['Total Profit'] = hasBillingData ? `$${totalProfit.toFixed(2)}` : 'N/A';
      
      return row;
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success(`Exported ${filteredJobs.length} jobs successfully`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Failed to export jobs');
    }
  };

  const exportToPDF = async () => {
    try {
      // Use landscape orientation for better column fitting
      const doc = new jsPDF('landscape');
      
      let allJobsForExport: Job[] = [];

      const transformJobsData = (jobsData: any[] | null | undefined): Job[] =>
        (jobsData || []).map(job => ({
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          scheduled_date: job.scheduled_date,
          created_at: job.created_at,
          updated_at: job.updated_at,
          description: job.description,
          total_billing_amount: job.total_billing_amount,
          invoice_sent: job.invoice_sent,
          invoice_paid: job.invoice_paid,
          invoice_sent_date: job.invoice_sent_date,
          invoice_paid_date: job.invoice_paid_date,
          property: Array.isArray(job.property) ? job.property[0] : job.property,
          unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
          job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
          job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase
        }));

      // Fetch all jobs if phaseLabel is provided, otherwise use jobs from props
      if (phaseLabel) {
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel]);

        if (phaseError || !phaseData || phaseData.length === 0) {
          toast.error('Failed to fetch job phases');
          return;
        }

        const phaseIds = phaseData.map(p => p.id);
        
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select(JOB_EXPORT_SELECT)
          .in('current_phase_id', phaseIds)
          .order('created_at', { ascending: false })
          .limit(10000);

        if (jobsError || !jobsData || jobsData.length === 0) {
          toast.error('Failed to fetch jobs for export');
          return;
        }

        allJobsForExport = transformJobsData(jobsData);
      } else {
        allJobsForExport = jobs;
      }
      
      // Filter by date range only
      const filteredJobs = allJobsForExport.filter(job => {
        try {
          // Use string comparison for YYYY-MM-DD dates
          const jobDate = job.scheduled_date;
          const startDate = exportConfig.dateRange.startDate;
          const endDate = exportConfig.dateRange.endDate;
          
          // String comparison works for YYYY-MM-DD format
          return jobDate >= startDate && jobDate <= endDate;
        } catch (error) {
          console.error('Error comparing date for job', job.id, error);
          return false;
        }
      });

      if (filteredJobs.length === 0) {
        toast.error('No jobs match the selected date range');
        return;
      }

      // Check if we need to fetch full billing data
      const needsBillingData = Object.entries(exportConfig.columns).some(([key, val]) => 
        ['baseBillToCustomer', 'basePayToSubcontractor', 'baseProfit',
         'extraChargesBillToCustomer', 'extraChargesPayToSubcontractor', 'extraChargesProfit', 'extraChargesLineItems',
         'totalBillToCustomer', 'totalPayToSubcontractor', 'totalProfit'].includes(key) && val
      );

      // Fetch full job details for each job if billing data is needed
      let jobDetailsMap: Record<string, any> = {};
      
      if (needsBillingData) {
        const batchSize = 10;
        for (let i = 0; i < filteredJobs.length; i += batchSize) {
          const batch = filteredJobs.slice(i, i + batchSize);
          const batchPromises = batch.map(async (job) => {
            try {
              const { data, error } = await supabase.rpc('get_job_details', { p_job_id: job.id });
              if (error) {
                return { jobId: job.id, data: null };
              }
              
              return { jobId: job.id, data };
            } catch (err) {
              return { jobId: job.id, data: null };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(result => {
            if (result.data) {
              jobDetailsMap[result.jobId] = result.data;
            }
          });
        }
      }

      // Fetch work orders for the filtered jobs if needed
      const hasWorkOrderFields = Object.entries(exportConfig.columns).some(([key, val]) => 
        (key.includes('is') || key.includes('painted') || key.includes('has') || 
        key.includes('extra') || key.includes('accent') || key.includes('submission') ||
        key.includes('cabinet') || key.includes('ceiling') || key.includes('additional') ||
        key.includes('sprinklers') || key === 'paintType') && val
      );

      let workOrdersMap: Record<string, any> = {};
      if (hasWorkOrderFields || needsBillingData) {
        const { data: workOrdersData } = await supabase
          .from('work_orders')
          .select('*')
          .in('job_id', filteredJobs.map(j => j.id));
        
        if (workOrdersData) {
          workOrdersMap = workOrdersData.reduce((acc, wo) => {
            acc[wo.job_id] = wo;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Build headers and column widths based on selected columns
      const headers: string[] = [];
      const colWidths: number[] = [];
      const columnKeys: string[] = [];

      // Define column mappings with appropriate widths for landscape orientation
      const columnConfig: Record<string, { header: string; width: number }> = {
        workOrder: { header: 'WO #', width: 18 },
        phase: { header: 'Phase', width: 22 },
        property: { header: 'Property', width: 30 },
        address: { header: 'Address', width: 35 },
        unitNumber: { header: 'Unit #', width: 15 },
        unitSize: { header: 'Size', width: 15 },
        jobType: { header: 'Type', width: 20 },
        purchaseOrder: { header: 'PO#', width: 20 },
        scheduledDate: { header: 'Scheduled', width: 22 },
        lastModificationDate: { header: 'Modified', width: 22 },
        description: { header: 'Description', width: 30 },
        submissionDate: { header: 'Submitted', width: 22 },
        isOccupied: { header: 'Occupied', width: 18 },
        isFullPaint: { header: 'Full Paint', width: 18 },
        paintType: { header: 'Paint Type', width: 20 },
        hasSprinklers: { header: 'Sprinklers', width: 18 },
        sprinklersPainted: { header: 'Sprinklers Ptd', width: 20 },
        paintedCeilings: { header: 'Ceilings Ptd', width: 18 },
        ceilingRoomsCount: { header: 'Ceiling Rms', width: 18 },
        paintedPatio: { header: 'Patio Ptd', width: 16 },
        paintedGarage: { header: 'Garage Ptd', width: 16 },
        paintedCabinets: { header: 'Cabinets Ptd', width: 18 },
        paintedCrownMolding: { header: 'Crown Ptd', width: 16 },
        paintedFrontDoor: { header: 'Door Ptd', width: 16 },
        cabinetRemovalRepair: { header: 'Cabinet Repair', width: 22 },
        ceilingLightsRepair: { header: 'Ceiling Lights', width: 22 },
        hasAccentWall: { header: 'Accent Wall', width: 18 },
        accentWallType: { header: 'Accent Type', width: 20 },
        accentWallCount: { header: 'Accent Cnt', width: 16 },
        hasExtraCharges: { header: 'Extra Chgs', width: 16 },
        extraChargesDescription: { header: 'Extra Desc', width: 25 },
        extraChargesLineItems: { header: 'Extra Chgs Items', width: 45 },
        extraHours: { header: 'Extra Hrs', width: 16 },
        additionalComments: { header: 'Comments', width: 30 },
        invoiceSent: { header: 'Inv Sent', width: 16 },
        invoicePaid: { header: 'Inv Paid', width: 16 },
        invoiceSentDate: { header: 'Inv Sent Date', width: 22 },
        invoicePaidDate: { header: 'Inv Paid Date', width: 22 },
        baseBillToCustomer: { header: 'Base Bill', width: 20 },
        basePayToSubcontractor: { header: 'Base Pay', width: 20 },
        baseProfit: { header: 'Base Profit', width: 20 },
        extraChargesBillToCustomer: { header: 'Extra Bill', width: 20 },
        extraChargesPayToSubcontractor: { header: 'Extra Pay', width: 20 },
        extraChargesProfit: { header: 'Extra Profit', width: 20 },
        totalBillToCustomer: { header: 'Total Bill', width: 20 },
        totalPayToSubcontractor: { header: 'Total Pay', width: 20 },
        totalProfit: { header: 'Total Profit', width: 20 },
      };

      // Build headers array based on selected columns
      Object.entries(exportConfig.columns).forEach(([key, isSelected]) => {
        if (isSelected && columnConfig[key]) {
          headers.push(columnConfig[key].header);
          colWidths.push(columnConfig[key].width);
          columnKeys.push(key);
        }
      });

      // Build data rows
      const data = filteredJobs.map(job => {
        const workOrder = workOrdersMap[job.id];
        const jobDetails = jobDetailsMap[job.id];
        const extraChargeLineItems = Array.isArray(jobDetails?.work_order?.extra_charges_line_items)
          ? jobDetails.work_order.extra_charges_line_items
          : (Array.isArray(workOrder?.extra_charges_line_items) ? workOrder.extra_charges_line_items : []);
        const hasExtraChargeItems = extraChargeLineItems.length > 0;
        const extraChargeTotals = hasExtraChargeItems ? calculateExtraChargesTotals(extraChargeLineItems) : { bill: null, sub: null, hours: null };
        
        // Calculate billing values
        const baseBillAmount = jobDetails?.billing_details?.bill_amount ?? null;
        const baseSubPayAmount = jobDetails?.billing_details?.sub_pay_amount ?? null;
        const baseProfit = (baseBillAmount !== null && baseSubPayAmount !== null) ? baseBillAmount - baseSubPayAmount : null;
        
        const extraChargesBillAmount = hasExtraChargeItems
          ? extraChargeTotals.bill
          : (jobDetails?.extra_charges_details?.bill_amount ?? null);
        const extraChargesSubPayAmount = hasExtraChargeItems
          ? extraChargeTotals.sub
          : (jobDetails?.extra_charges_details?.sub_pay_amount ?? null);
        const extraChargesProfit = (extraChargesBillAmount !== null && extraChargesSubPayAmount !== null) 
          ? extraChargesBillAmount - extraChargesSubPayAmount 
          : null;
        
        const totalBillToCustomer = (baseBillAmount ?? 0) + (extraChargesBillAmount ?? 0);
        const totalPayToSubcontractor = (baseSubPayAmount ?? 0) + (extraChargesSubPayAmount ?? 0);
        const totalProfit = totalBillToCustomer - totalPayToSubcontractor;
        const hasBillingData = baseBillAmount !== null || extraChargesBillAmount !== null;
        
        // Map each column key to its value
        const valueMap: Record<string, string> = {
          workOrder: formatWorkOrderNumber(job.work_order_num),
          phase: job.job_phase?.job_phase_label || 'N/A',
          property: job.property.property_name || 'N/A',
          address: formatAddress(job.property) || 'N/A',
          unitNumber: job.unit_number || 'N/A',
          unitSize: job.unit_size.unit_size_label || 'N/A',
          jobType: job.job_type.job_type_label || 'N/A',
          purchaseOrder: job.purchase_order || 'N/A',
          scheduledDate: job.scheduled_date ? formatDate(job.scheduled_date) : 'N/A',
          lastModificationDate: job.updated_at ? formatDate(job.updated_at) : 'N/A',
          description: job.description || 'N/A',
          submissionDate: job.created_at ? formatDate(job.created_at) : 'N/A',
          isOccupied: workOrder?.is_occupied === true ? 'Yes' : workOrder?.is_occupied === false ? 'No' : 'N/A',
          isFullPaint: workOrder?.is_full_paint === true ? 'Yes' : workOrder?.is_full_paint === false ? 'No' : 'N/A',
          paintType: workOrder?.paint_type || 'N/A',
          hasSprinklers: workOrder?.has_sprinklers === true ? 'Yes' : workOrder?.has_sprinklers === false ? 'No' : 'N/A',
          sprinklersPainted: workOrder?.sprinklers_painted === true ? 'Yes' : workOrder?.sprinklers_painted === false ? 'No' : 'N/A',
          paintedCeilings: workOrder?.painted_ceilings === true ? 'Yes' : workOrder?.painted_ceilings === false ? 'No' : 'N/A',
          ceilingRoomsCount: workOrder?.ceiling_rooms_count ? String(workOrder.ceiling_rooms_count) : 'N/A',
          paintedPatio: workOrder?.painted_patio === true ? 'Yes' : workOrder?.painted_patio === false ? 'No' : 'N/A',
          paintedGarage: workOrder?.painted_garage === true ? 'Yes' : workOrder?.painted_garage === false ? 'No' : 'N/A',
          paintedCabinets: workOrder?.painted_cabinets === true ? 'Yes' : workOrder?.painted_cabinets === false ? 'No' : 'N/A',
          paintedCrownMolding: workOrder?.painted_crown_molding === true ? 'Yes' : workOrder?.painted_crown_molding === false ? 'No' : 'N/A',
          paintedFrontDoor: workOrder?.painted_front_door === true ? 'Yes' : workOrder?.painted_front_door === false ? 'No' : 'N/A',
          cabinetRemovalRepair: workOrder?.cabinet_removal_repair || 'N/A',
          ceilingLightsRepair: workOrder?.ceiling_lights_repair || 'N/A',
          hasAccentWall: workOrder?.has_accent_wall === true ? 'Yes' : workOrder?.has_accent_wall === false ? 'No' : 'N/A',
          accentWallType: workOrder?.accent_wall_type || 'N/A',
          accentWallCount: workOrder?.accent_wall_count ? String(workOrder.accent_wall_count) : 'N/A',
          hasExtraCharges: workOrder?.has_extra_charges === true ? 'Yes' : workOrder?.has_extra_charges === false ? 'No' : 'N/A',
          extraChargesDescription: hasExtraChargeItems ? 'Itemized Extra Charges' : (workOrder?.extra_charges_description || 'N/A'),
          extraChargesLineItems: formatExtraChargeLineItems(extraChargeLineItems),
          extraHours: ((hasExtraChargeItems ? extraChargeTotals.hours : workOrder?.extra_hours) ?? null) !== null
            ? String(hasExtraChargeItems ? extraChargeTotals.hours : workOrder?.extra_hours)
            : 'N/A',
          additionalComments: workOrder?.additional_comments || 'N/A',
          invoiceSent: job.invoice_sent === true ? 'Yes' : job.invoice_sent === false ? 'No' : 'N/A',
          invoicePaid: job.invoice_paid === true ? 'Yes' : job.invoice_paid === false ? 'No' : 'N/A',
          invoiceSentDate: job.invoice_sent_date ? formatDate(job.invoice_sent_date) : 'N/A',
          invoicePaidDate: job.invoice_paid_date ? formatDate(job.invoice_paid_date) : 'N/A',
          baseBillToCustomer: baseBillAmount !== null ? `$${baseBillAmount.toFixed(2)}` : 'N/A',
          basePayToSubcontractor: baseSubPayAmount !== null ? `$${baseSubPayAmount.toFixed(2)}` : 'N/A',
          baseProfit: baseProfit !== null ? `$${baseProfit.toFixed(2)}` : 'N/A',
          extraChargesBillToCustomer: extraChargesBillAmount !== null ? `$${extraChargesBillAmount.toFixed(2)}` : 'N/A',
          extraChargesPayToSubcontractor: extraChargesSubPayAmount !== null ? `$${extraChargesSubPayAmount.toFixed(2)}` : 'N/A',
          extraChargesProfit: extraChargesProfit !== null ? `$${extraChargesProfit.toFixed(2)}` : 'N/A',
          totalBillToCustomer: hasBillingData ? `$${totalBillToCustomer.toFixed(2)}` : 'N/A',
          totalPayToSubcontractor: hasBillingData ? `$${totalPayToSubcontractor.toFixed(2)}` : 'N/A',
          totalProfit: hasBillingData ? `$${totalProfit.toFixed(2)}` : 'N/A',
        };
        
        return columnKeys.map(key => valueMap[key] || 'N/A');
      });

      // Set up page dimensions and margins for landscape
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const startX = margin;
      const startY = 25;
      const rowHeight = 6; // Smaller row height for better fit
      const maxRowsPerPage = Math.floor((pageHeight - startY - margin) / rowHeight);

      // Add title with date range
      const formattedStartDate = format(parseISO(exportConfig.dateRange.startDate), 'MMM d, yyyy');
      const formattedEndDate = format(parseISO(exportConfig.dateRange.endDate), 'MMM d, yyyy');
      const titleWithDateRange = `${title} - ${formattedStartDate} to ${formattedEndDate}`;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(titleWithDateRange, startX, startY - 13);
      
      // Add a subtle line under the title
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(startX, startY - 10, pageWidth - margin, startY - 10);

      // Function to add a page of data
      const addPage = (startIndex: number) => {
        if (startIndex > 0) {
          doc.addPage('landscape');
        }

        // Add headers
        doc.setFontSize(7); // Smaller font for better fit
        doc.setFont('helvetica', 'bold');
        let currentX = startX;
        headers.forEach((header, i) => {
          const maxWidth = colWidths[i] - 2;
          const wrappedHeader = doc.splitTextToSize(header, maxWidth);
          // For headers, just use first line but ensure it fits
          doc.text(wrappedHeader[0] || header, currentX, startY);
          currentX += colWidths[i];
        });

        // Add data rows with proper text wrapping
        doc.setFont('helvetica', 'normal');
        const endIndex = Math.min(startIndex + maxRowsPerPage, data.length);
        for (let i = startIndex; i < endIndex; i++) {
          const row = data[i];
          currentX = startX;
          let maxLinesInRow = 1;
          const wrappedCells: string[][] = [];
          
          // First pass: wrap all cells and find max lines needed
          row.forEach((cell, j) => {
            const text = cell?.toString() || '';
            const maxWidth = colWidths[j] - 2;
            const wrapped = doc.splitTextToSize(text, maxWidth);
            wrappedCells.push(wrapped);
            maxLinesInRow = Math.max(maxLinesInRow, wrapped.length);
          });
          
          // Second pass: render all cells with proper alignment
          wrappedCells.forEach((wrappedText, j) => {
            const cellX = currentX;
            const baseY = startY + ((i - startIndex + 1) * rowHeight);
            
            // Render each line of wrapped text
            wrappedText.forEach((line, lineIndex) => {
              if (lineIndex < 3) { // Limit to 3 lines max per cell for readability
                doc.text(line, cellX, baseY + (lineIndex * 3)); // 3 points between lines
              }
            });
            
            currentX += colWidths[j];
          });
          
          // Adjust row height if we had wrapped content (up to 3 lines)
          if (maxLinesInRow > 1) {
            // Skip extra rows to account for wrapped content
            const extraHeight = Math.min(maxLinesInRow - 1, 2) * 3;
            // This is handled by the line spacing in the render above
          }
        }

        return endIndex;
      };

      // Add data in pages
      let currentIndex = 0;
      while (currentIndex < data.length) {
        currentIndex = addPage(currentIndex);
      }

      doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(`Exported ${filteredJobs.length} jobs to PDF successfully`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export jobs to PDF');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedJobs(sortedAndFilteredJobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobs(prev => {
      if (prev.includes(jobId)) {
        return prev.filter(id => id !== jobId);
      } else {
        return [...prev, jobId];
      }
    });
  };

  const handleArchiveSelected = async () => {
    if (selectedJobs.length === 0) return;
    
    setProcessing(true);
    try {
      // Get the "Archived" phase ID
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Archived')
        .single();

      if (phaseError) {
        // If the Archived phase doesn't exist, create it
        if (phaseError.code === 'PGRST116') {
          const { data: newPhase, error: createError } = await supabase
            .from('job_phases')
            .insert({
              job_phase_label: 'Archived',
              color_light_mode: '#D4D4D8',
              color_dark_mode: '#52525B',
              sort_order: 100,
              order_index: 100
            })
            .select()
            .single();

          if (createError) throw createError;
          
          if (!newPhase) throw new Error('Failed to create Archived phase');
          
          // Use a new variable instead of reassigning phaseData
          const archivedPhaseData = newPhase;

          // Get current user
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;
          if (!userData.user) throw new Error('User not found');

          // Get current phases for selected jobs
          const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('id, current_phase_id')
            .in('id', selectedJobs);

          if (jobsError) throw jobsError;

          // Update jobs to Archived phase
          const { error: updateError } = await supabase
            .from('jobs')
            .update({ current_phase_id: archivedPhaseData.id })
            .in('id', selectedJobs);

          if (updateError) throw updateError;

          // Create phase change records
          const phaseChanges = jobsData.map(job => ({
            job_id: job.id,
            changed_by: userData.user.id,
            from_phase_id: job.current_phase_id,
            to_phase_id: archivedPhaseData.id,
            change_reason: 'Job archived'
          }));

          const { error: phaseChangeError } = await supabase
            .from('job_phase_changes')
            .insert(phaseChanges);

          if (phaseChangeError) throw phaseChangeError;
        } else {
          throw phaseError;
        }
      } else {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) throw new Error('User not found');

        // Get current phases for selected jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, current_phase_id')
          .in('id', selectedJobs);

        if (jobsError) throw jobsError;

        // Update jobs to Archived phase
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ current_phase_id: phaseData.id })
          .in('id', selectedJobs);

        if (updateError) throw updateError;

        // Create phase change records
        const phaseChanges = jobsData.map(job => ({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job.current_phase_id,
          to_phase_id: phaseData.id,
          change_reason: 'Job archived'
        }));

        const { error: phaseChangeError } = await supabase
          .from('job_phase_changes')
          .insert(phaseChanges);

        if (phaseChangeError) throw phaseChangeError;
      }

      // Clear selection and close confirmation
      setSelectedJobs([]);
      setShowArchiveConfirm(false);
      
      toast.success(`Successfully archived ${selectedJobs.length} job${selectedJobs.length !== 1 ? 's' : ''}`);
      
      // Refresh the job list
      if (refetch) {
        await refetch();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Error archiving jobs:', err);
      toast.error('Failed to archive jobs. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnarchiveSelected = async () => {
    if (selectedJobs.length === 0) return;
    
    setProcessing(true);
    try {
      // Get the "Job Request" phase ID (default phase to restore to)
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Job Request')
        .single();

      if (phaseError) throw phaseError;

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      // Get current phases for selected jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, current_phase_id')
        .in('id', selectedJobs);

      if (jobsError) throw jobsError;

      // Update jobs to Job Request phase
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: phaseData.id })
        .in('id', selectedJobs);

      if (updateError) throw updateError;

      // Create phase change records
      const phaseChanges = jobsData.map(job => ({
        job_id: job.id,
        changed_by: userData.user.id,
        from_phase_id: job.current_phase_id,
        to_phase_id: phaseData.id,
        change_reason: 'Job unarchived'
      }));

      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert(phaseChanges);

      if (phaseChangeError) throw phaseChangeError;

      // Clear selection and close confirmation
      setSelectedJobs([]);
      setShowUnarchiveConfirm(false);
      
      toast.success(`Successfully unarchived ${selectedJobs.length} job${selectedJobs.length !== 1 ? 's' : ''}`);
      
      // Refresh the job list
      if (refetch) {
        await refetch();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Error unarchiving jobs:', err);
      toast.error('Failed to unarchive jobs. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedJobs.length === 0) return;
    
    setProcessing(true);
    try {
      // Get job data to verify phase
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          current_phase_id,
          job_phases (
            job_phase_label
          )
        `)
        .in('id', selectedJobs);

      if (jobsError) throw jobsError;

      // Verify all jobs are in Archived phase
      const nonArchivedJobs = jobsData.filter(job => {
        const phaseLabel = (job.job_phases as unknown as { job_phase_label: string })?.job_phase_label;
        console.log('Job phase label:', phaseLabel);
        return phaseLabel !== 'Archived';
      });

      if (nonArchivedJobs.length > 0) {
        toast.error('Only archived jobs can be deleted');
        return;
      }

      console.log('Deleting jobs via edge function with IDs:', selectedJobs);
      const { data: deleteResult, error: deleteError } = await supabase.functions.invoke('delete-jobs', {
        body: { jobIds: selectedJobs }
      });

      if (deleteError) {
        throw new Error(deleteError.message || 'Failed to delete jobs');
      }
      if (deleteResult && deleteResult.error) {
        throw new Error(typeof deleteResult.error === 'string' ? deleteResult.error : 'Failed to delete jobs');
      }

      // Refresh the jobs list
      if (refetch) {
        await refetch();
      } else {
        window.location.reload();
      }
      setSelectedJobs([]);
      setShowDeleteConfirm(false);
      toast.success('Selected jobs deleted successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete jobs');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    if (!refetch) return;
    
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Job list refreshed');
    } catch (err) {
      console.error('Error refreshing jobs:', err);
      toast.error('Failed to refresh jobs. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const sortedAndFilteredJobs = getSortedJobs(
    jobs.filter(job => 
      job.property.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.unit_size.unit_size_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_type.job_type_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.purchase_order?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      formatWorkOrderNumber(job.work_order_num).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="ml-2 h-4 w-4 text-gray-900 dark:text-white" />
      : <ChevronDown className="ml-2 h-4 w-4 text-gray-900 dark:text-white" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-gray-500 dark:text-gray-400" />
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {refetch && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 sm:px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          {selectedJobs.length > 0 && (
            <>
              {isArchive ? (
                <>
                  <button
                    onClick={() => setShowUnarchiveConfirm(true)}
                    className="inline-flex items-center px-3 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Unarchive Selected ({selectedJobs.length})</span>
                    <span className="sm:hidden">Unarchive</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center px-3 py-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Delete Selected ({selectedJobs.length})</span>
                    <span className="sm:hidden">Delete</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="inline-flex items-center px-3 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Archive Selected ({selectedJobs.length})</span>
                  <span className="sm:hidden">Archive</span>
                </button>
              )}
            </>
          )}
          {showAddButton && (
            <Link
              to={addButtonLink}
              className="inline-flex items-center px-3 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Job Request</span>
              <span className="sm:hidden">Add</span>
            </Link>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center px-3 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-10">
                <button
                  onClick={() => handleExportClick('csv')}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] rounded-t-lg"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExportClick('pdf')}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] rounded-b-lg"
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-4 py-2 text-sm sm:text-base bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#1E293B] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
          {/* Mobile horizontal scroll wrapper */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2D3B4E]">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-4 text-left">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length > 0 && selectedJobs.length === sortedAndFilteredJobs.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-24 sm:w-auto">
                  <button
                    onClick={() => handleSort('work_order_num')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Work Order #</span>
                    <SortIcon field="work_order_num" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-32 sm:w-auto">
                  <button
                    onClick={() => handleSort('job_phase')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Job Phase</span>
                    <SortIcon field="job_phase" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('property_name')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Property Name</span>
                    <SortIcon field="property_name" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-16 sm:w-auto">
                  <button
                    onClick={() => handleSort('unit_number')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Unit #</span>
                    <SortIcon field="unit_number" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-20 sm:w-auto">
                  <button
                    onClick={() => handleSort('unit_size')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Unit Size</span>
                    <SortIcon field="unit_size" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-20 sm:w-auto">
                  <button
                    onClick={() => handleSort('job_type')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Job Type</span>
                    <SortIcon field="job_type" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-24 sm:w-auto">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PO#
                  </span>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-24 sm:w-auto">
                  <button
                    onClick={() => handleSort('scheduled_date')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Scheduled Date</span>
                    <SortIcon field="scheduled_date" />
                  </button>
                </th>
                {!hideAmountColumn && (
                  <th scope="col" className="px-6 py-4 text-left w-20 sm:w-auto">
                    <button
                      onClick={() => handleSort('total_billing_amount')}
                      className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                    >
                      <span className="text-xs sm:text-xs">Amount</span>
                      <SortIcon field="total_billing_amount" />
                    </button>
                  </th>
                )}
                {showInvoiceColumns && (
                  <>
                    <th scope="col" className="px-6 py-4 text-center w-16 sm:w-auto">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sent
                      </span>
                    </th>
                    <th scope="col" className="px-6 py-4 text-center w-16 sm:w-auto">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Paid
                      </span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {sortedAndFilteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-[#2D3B4E]/30 transition-colors">
                  <td className="px-3 py-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 w-24 sm:w-auto">
                    <Link
                      to={`/dashboard/jobs/${job.id}`}
                      className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium text-xs sm:text-sm whitespace-nowrap"
                    >
                      {formatWorkOrderNumber(job.work_order_num)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 w-32 sm:w-auto">
                    {job.job_phase && (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: job.job_phase.color_dark_mode || '#4B5563',
                          color: 'white'
                        }}
                      >
                        {job.job_phase.job_phase_label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/dashboard/properties/${job.property.id}`}
                      className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-sm"
                    >
                      {job.property.property_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 w-16 sm:w-auto">
                    <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      {job.unit_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-20 sm:w-auto">
                    <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      {job.unit_size.unit_size_label}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-20 sm:w-auto">
                    <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      {job.job_type.job_type_label}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-24 sm:w-auto">
                    <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      {job.purchase_order || 'None'}
                    </div>
                  </td>
                  <td className="px-6 py-4 w-24 sm:w-auto">
                    <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      {formatDate(job.scheduled_date)}
                    </div>
                  </td>
                  {!hideAmountColumn && (
                    <td className="px-6 py-4 w-20 sm:w-auto">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                        {job.total_billing_amount && job.total_billing_amount !== 0
                          ? `$${job.total_billing_amount.toFixed(2)}`
                          : '—'}
                      </div>
                    </td>
                  )}
                  {showInvoiceColumns && (
                    <>
                      <td className="px-6 py-4 w-16 sm:w-auto text-center">
                        <div className="flex items-center justify-center">
                          <Mailbox className={`h-5 w-5 ${job.invoice_sent ? 'text-green-500' : 'text-gray-300'}`} />
                        </div>
                      </td>
                      <td className="px-6 py-4 w-16 sm:w-auto text-center">
                        <div className="flex items-center justify-center">
                          <CheckCircle className={`h-5 w-5 ${job.invoice_paid ? 'text-green-500' : 'text-gray-300'}`} />
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {sortedAndFilteredJobs.length === 0 && (
                <tr>
              <td colSpan={hideAmountColumn ? (showInvoiceColumns ? 11 : 9) : (showInvoiceColumns ? 12 : 10)} className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Archive Selected Jobs</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to archive {selectedJobs.length} selected job{selectedJobs.length !== 1 ? 's' : ''}? 
              Archived jobs will be moved to the Archives section.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveSelected}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Archiving...' : 'Archive Jobs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Unarchive Selected Jobs</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to unarchive {selectedJobs.length} selected job{selectedJobs.length !== 1 ? 's' : ''}? 
              Unarchived jobs will be moved back to the Job Requests section.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUnarchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnarchiveSelected}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Unarchiving...' : 'Unarchive Jobs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Selected Jobs</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to permanently delete {selectedJobs.length} selected job{selectedJobs.length !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Deleting...' : 'Delete Jobs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Configuration Modal */}
      {showExportConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Configuration
              </h3>
              <button
                onClick={() => setShowExportConfig(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* PDF Export Warning */}
              {exportType === 'pdf' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">PDF Export Notice</h4>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Depending on the number of fields selected, the exported PDF may have unpredictable formatting results due to page width constraints. 
                        <strong className="block mt-1">For comprehensive data with many columns, use the CSV export option instead.</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Range Selection */}
              <div className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Range</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exportConfig.dateRange.startDate}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, startDate: e.target.value }
                      }))}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full px-3 py-2 bg-white dark:bg-[#2D3B4E] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={exportConfig.dateRange.endDate}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, endDate: e.target.value }
                      }))}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full px-3 py-2 bg-white dark:bg-[#2D3B4E] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Column Selection with Accordions */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Fields to Export</h4>
                
                {/* Job Information Accordion */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg mb-3">
                  <button
                    onClick={() => toggleSection('jobInfo')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Job Information</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.entries(exportConfig.columns).filter(([key, val]) => 
                          !['submissionDate', 'isOccupied', 'isFullPaint', 'paintType', 'hasSprinklers',
                          'sprinklersPainted', 'paintedCeilings', 'ceilingRoomsCount', 'paintedPatio',
                          'paintedGarage', 'paintedCabinets', 'paintedCrownMolding', 'paintedFrontDoor',
                          'cabinetRemovalRepair', 'ceilingLightsRepair', 'hasAccentWall', 'accentWallType',
                          'accentWallCount', 'hasExtraCharges', 'extraChargesDescription', 'extraHours',
                          'additionalComments', 'invoiceSent', 'invoicePaid', 'invoiceSentDate', 'invoicePaidDate',
                          'baseBillToCustomer', 'basePayToSubcontractor', 'baseProfit',
                          'extraChargesBillToCustomer', 'extraChargesPayToSubcontractor', 'extraChargesProfit', 'extraChargesLineItems',
                          'totalBillToCustomer', 'totalPayToSubcontractor', 'totalProfit'].includes(key) && val
                        ).length} selected)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('jobInfo', true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('jobInfo', false);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Clear All
                      </button>
                      {expandedSections.jobInfo ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </button>
                  {expandedSections.jobInfo && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A]">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.workOrder}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, workOrder: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Work Order #</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.phase}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, phase: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Phase</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.property}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, property: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Property</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.address}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, address: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Address</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.unitNumber}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, unitNumber: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Unit #</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.unitSize}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, unitSize: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Unit Size</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.jobType}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, jobType: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Job Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.purchaseOrder}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, purchaseOrder: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">PO#</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.scheduledDate}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, scheduledDate: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Scheduled Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.lastModificationDate}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, lastModificationDate: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Last Modification Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.description}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, description: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Work Order Information Accordion */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <button
                    onClick={() => toggleSection('workOrderInfo')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Work Order Details</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.entries(exportConfig.columns).filter(([key, val]) => 
                          ['submissionDate', 'isOccupied', 'isFullPaint', 'paintType', 'hasSprinklers',
                          'sprinklersPainted', 'paintedCeilings', 'ceilingRoomsCount', 'paintedPatio',
                          'paintedGarage', 'paintedCabinets', 'paintedCrownMolding', 'paintedFrontDoor',
                          'cabinetRemovalRepair', 'ceilingLightsRepair', 'hasAccentWall', 'accentWallType',
                          'accentWallCount', 'hasExtraCharges', 'extraChargesDescription', 'extraChargesLineItems', 'extraHours',
                          'additionalComments'].includes(key) && val
                        ).length} selected)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('workOrderInfo', true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('workOrderInfo', false);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Clear All
                      </button>
                      {expandedSections.workOrderInfo ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </button>
                  {expandedSections.workOrderInfo && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A]">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.submissionDate}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, submissionDate: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Submission Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.isOccupied}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, isOccupied: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Is Occupied</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.isFullPaint}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, isFullPaint: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Full Paint</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintType}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintType: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Paint Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.hasSprinklers}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, hasSprinklers: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Sprinklers</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.sprinklersPainted}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, sprinklersPainted: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Sprinklers Painted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedCeilings}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedCeilings: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Ceilings</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.ceilingRoomsCount}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, ceilingRoomsCount: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ceiling Rooms Count</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedPatio}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedPatio: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Patio</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedGarage}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedGarage: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Garage</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedCabinets}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedCabinets: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Cabinets</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedCrownMolding}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedCrownMolding: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Crown Molding</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.paintedFrontDoor}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, paintedFrontDoor: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Front Door</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.cabinetRemovalRepair}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, cabinetRemovalRepair: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Cabinet Removal/Repair</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.ceilingLightsRepair}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, ceilingLightsRepair: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ceiling Lights Repair</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.hasAccentWall}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, hasAccentWall: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Accent Wall</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.accentWallType}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, accentWallType: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Accent Wall Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.accentWallCount}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, accentWallCount: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Accent Wall Count</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.hasExtraCharges}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, hasExtraCharges: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Extra Charges</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.extraChargesDescription}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesDescription: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Extra Charges Description</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.extraChargesLineItems}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesLineItems: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Extra Charges Line Items</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.extraHours}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraHours: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Extra Hours</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={exportConfig.columns.additionalComments}
                            onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, additionalComments: e.target.checked }}))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Additional Comments</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing/Invoice Information Accordion */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <button
                    onClick={() => toggleSection('billingInfo')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Billing/Invoice Information</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.entries(exportConfig.columns).filter(([key, val]) => 
                          ['invoiceSent', 'invoicePaid', 'invoiceSentDate', 'invoicePaidDate',
                          'baseBillToCustomer', 'basePayToSubcontractor', 'baseProfit',
                          'extraChargesBillToCustomer', 'extraChargesPayToSubcontractor', 'extraChargesProfit',
                          'totalBillToCustomer', 'totalPayToSubcontractor', 'totalProfit'].includes(key) && val
                        ).length} selected)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('billingInfo', true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInSection('billingInfo', false);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Clear All
                      </button>
                      {expandedSections.billingInfo ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </button>
                  {expandedSections.billingInfo && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A]">
                      <div className="grid grid-cols-1 gap-4">
                        {/* Invoice Status Section */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Invoice Status</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.invoiceSent}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, invoiceSent: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Sent</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.invoicePaid}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, invoicePaid: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Paid</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.invoiceSentDate}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, invoiceSentDate: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Sent Date</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.invoicePaidDate}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, invoicePaidDate: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Paid Date</span>
                            </label>
                          </div>
                        </div>

                        {/* Base Billing Section */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Base Billing</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.baseBillToCustomer}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, baseBillToCustomer: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Bill to Customer</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.basePayToSubcontractor}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, basePayToSubcontractor: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Pay to Subcontractor</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.baseProfit}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, baseProfit: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Profit</span>
                            </label>
                          </div>
                        </div>

                        {/* Extra Charges Section */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Extra Charges</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.extraChargesBillToCustomer}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesBillToCustomer: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Bill to Customer</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.extraChargesPayToSubcontractor}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesPayToSubcontractor: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Pay to Subcontractor</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.extraChargesProfit}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesProfit: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Profit</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.extraChargesLineItems}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, extraChargesLineItems: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Extra Charges Line Items</span>
                            </label>
                          </div>
                        </div>

                        {/* Grand Totals Section */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Grand Totals</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.totalBillToCustomer}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, totalBillToCustomer: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Total Bill to Customer</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.totalPayToSubcontractor}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, totalPayToSubcontractor: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Total Pay to Subcontractor</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input type="checkbox" checked={exportConfig.columns.totalProfit}
                                onChange={(e) => setExportConfig(prev => ({...prev, columns: { ...prev.columns, totalProfit: e.target.checked }}))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Total Profit</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your field preferences will be saved for future exports.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowExportConfig(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportConfigSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Export {exportType?.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Archives Button - Under the table */}
      {showArchivesButton && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate('/dashboard/jobs/archives')}
            className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Archive className="h-4 w-4 mr-2" />
            View Archives
          </button>
        </div>
      )}
    </div>
  );
}
