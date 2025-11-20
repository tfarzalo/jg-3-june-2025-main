import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  X
} from 'lucide-react';
import { parseISO, format, subMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { supabase } from '@/utils/supabase';
import { createClient } from '@supabase/supabase-js';
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
  job_phase: {
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  } | null;
  work_order_num: number;
  total_billing_amount?: number;
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
    scheduledDate: boolean;
    dueDate: boolean;
    completedDate: boolean;
    description: boolean;
    status: boolean;
    amount: boolean;
    createdBy: boolean;
    assignedTo: boolean;
    createdAt: boolean;
    updatedAt: boolean;
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
    extraHours: boolean;
    additionalComments: boolean;
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
  showAddButton?: boolean;
  addButtonLink?: string;
  isArchive?: boolean;
  refetch?: () => Promise<void>;
}

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
  showAddButton = false,
  addButtonLink = '/dashboard/jobs/new',
  isArchive = false,
  refetch
}: JobListingPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
  // Load export preferences from localStorage or use defaults
  const [exportConfig, setExportConfig] = useState(() => {
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
        scheduledDate: true,
        dueDate: false,
        completedDate: false,
        description: false,
        status: false,
        amount: true,
        createdBy: false,
        assignedTo: false,
        createdAt: false,
        updatedAt: false,
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
        extraHours: false,
        additionalComments: false
      }
    };
  });
  const [expandedSections, setExpandedSections] = useState({
    jobInfo: true,
    workOrderInfo: false
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'scheduled_date',
    direction: 'asc'
  });
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
          // Parse dates and compare
          const dateA = parseISO(a.scheduled_date);
          const dateB = parseISO(b.scheduled_date);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'total_billing_amount':
          comparison = (a.total_billing_amount || 0) - (b.total_billing_amount || 0);
          break;
      }

      return comparison * direction;
    });
  };

  const handleExportClick = (type: 'csv' | 'pdf') => {
    setExportType(type);
    setShowExportConfig(true);
    setShowExportMenu(false);
  };

  const handleExportConfigSubmit = () => {
    // Save preferences to localStorage
    localStorage.setItem('jobExportConfig', JSON.stringify(exportConfig));
    
    if (exportType === 'csv') {
      exportToCSV();
    } else if (exportType === 'pdf') {
      exportToPDF();
    }
    setShowExportConfig(false);
  };

  const toggleSection = (section: 'jobInfo' | 'workOrderInfo') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleAllInSection = (section: 'jobInfo' | 'workOrderInfo', checked: boolean) => {
    setExportConfig((prev: ExportConfig) => {
      const newColumns = { ...prev.columns };
      if (section === 'jobInfo') {
        const jobFields: (keyof typeof newColumns)[] = [
          'workOrder', 'phase', 'property', 'address', 'unitNumber', 'unitSize',
          'jobType', 'scheduledDate', 'dueDate', 'completedDate', 'description',
          'status', 'amount', 'createdBy', 'assignedTo', 'createdAt', 'updatedAt'
        ];
        jobFields.forEach(field => {
          newColumns[field] = checked;
        });
      } else {
        const workOrderFields: (keyof typeof newColumns)[] = [
          'submissionDate', 'isOccupied', 'isFullPaint', 'paintType', 'hasSprinklers',
          'sprinklersPainted', 'paintedCeilings', 'ceilingRoomsCount', 'paintedPatio',
          'paintedGarage', 'paintedCabinets', 'paintedCrownMolding', 'paintedFrontDoor',
          'cabinetRemovalRepair', 'ceilingLightsRepair', 'hasAccentWall', 'accentWallType',
          'accentWallCount', 'hasExtraCharges', 'extraChargesDescription', 'extraHours',
          'additionalComments'
        ];
        workOrderFields.forEach(field => {
          newColumns[field] = checked;
        });
      }
      return { ...prev, columns: newColumns };
    });
  };

  const exportToCSV = () => {
    const filteredJobs = sortedAndFilteredJobs.filter(job => {
      const jobDate = parseISO(job.scheduled_date);
      const startDate = parseISO(exportConfig.dateRange.startDate);
      const endDate = parseISO(exportConfig.dateRange.endDate);
      return jobDate >= startDate && jobDate <= endDate;
    });

    const data = filteredJobs.map(job => {
      const row: Record<string, string> = {};
      const workOrder = job.work_orders?.[0]; // Get first work order if exists
      
      // Job Information
      if (exportConfig.columns.workOrder) row['Work Order #'] = formatWorkOrderNumber(job.work_order_num);
      if (exportConfig.columns.phase) row['Phase'] = job.job_phase?.job_phase_label || '';
      if (exportConfig.columns.property) row['Property'] = job.property.property_name;
      if (exportConfig.columns.address) row['Address'] = formatAddress(job.property);
      if (exportConfig.columns.unitNumber) row['Unit #'] = job.unit_number;
      if (exportConfig.columns.unitSize) row['Unit Size'] = job.unit_size.unit_size_label;
      if (exportConfig.columns.jobType) row['Job Type'] = job.job_type.job_type_label;
      if (exportConfig.columns.scheduledDate) row['Scheduled Date'] = formatDate(job.scheduled_date);
      if (exportConfig.columns.dueDate && job.due_date) row['Due Date'] = formatDate(job.due_date);
      if (exportConfig.columns.completedDate && job.completed_date) row['Completed Date'] = formatDate(job.completed_date);
      if (exportConfig.columns.description && job.description) row['Description'] = job.description;
      if (exportConfig.columns.status && job.status) row['Status'] = job.status;
      if (exportConfig.columns.amount) row['Amount'] = job.total_billing_amount ? `$${job.total_billing_amount.toFixed(2)}` : '$0.00';
      if (exportConfig.columns.createdBy && job.created_by) row['Created By'] = job.created_by;
      if (exportConfig.columns.assignedTo && job.assigned_to) row['Assigned To'] = job.assigned_to;
      if (exportConfig.columns.createdAt && job.created_at) row['Created At'] = formatDate(job.created_at);
      if (exportConfig.columns.updatedAt && job.updated_at) row['Updated At'] = formatDate(job.updated_at);
      
      // Work Order Information
      if (workOrder) {
        if (exportConfig.columns.submissionDate && workOrder.submission_date) row['Submission Date'] = formatDate(workOrder.submission_date);
        if (exportConfig.columns.isOccupied) row['Is Occupied'] = workOrder.is_occupied ? 'Yes' : 'No';
        if (exportConfig.columns.isFullPaint) row['Full Paint'] = workOrder.is_full_paint ? 'Yes' : 'No';
        if (exportConfig.columns.paintType && workOrder.paint_type) row['Paint Type'] = workOrder.paint_type;
        if (exportConfig.columns.hasSprinklers) row['Has Sprinklers'] = workOrder.has_sprinklers ? 'Yes' : 'No';
        if (exportConfig.columns.sprinklersPainted) row['Sprinklers Painted'] = workOrder.sprinklers_painted ? 'Yes' : 'No';
        if (exportConfig.columns.paintedCeilings) row['Painted Ceilings'] = workOrder.painted_ceilings ? 'Yes' : 'No';
        if (exportConfig.columns.ceilingRoomsCount && workOrder.ceiling_rooms_count) row['Ceiling Rooms Count'] = String(workOrder.ceiling_rooms_count);
        if (exportConfig.columns.paintedPatio) row['Painted Patio'] = workOrder.painted_patio ? 'Yes' : 'No';
        if (exportConfig.columns.paintedGarage) row['Painted Garage'] = workOrder.painted_garage ? 'Yes' : 'No';
        if (exportConfig.columns.paintedCabinets) row['Painted Cabinets'] = workOrder.painted_cabinets ? 'Yes' : 'No';
        if (exportConfig.columns.paintedCrownMolding) row['Painted Crown Molding'] = workOrder.painted_crown_molding ? 'Yes' : 'No';
        if (exportConfig.columns.paintedFrontDoor) row['Painted Front Door'] = workOrder.painted_front_door ? 'Yes' : 'No';
        if (exportConfig.columns.cabinetRemovalRepair && workOrder.cabinet_removal_repair) row['Cabinet Removal/Repair'] = workOrder.cabinet_removal_repair;
        if (exportConfig.columns.ceilingLightsRepair && workOrder.ceiling_lights_repair) row['Ceiling Lights Repair'] = workOrder.ceiling_lights_repair;
        if (exportConfig.columns.hasAccentWall) row['Has Accent Wall'] = workOrder.has_accent_wall ? 'Yes' : 'No';
        if (exportConfig.columns.accentWallType && workOrder.accent_wall_type) row['Accent Wall Type'] = workOrder.accent_wall_type;
        if (exportConfig.columns.accentWallCount && workOrder.accent_wall_count) row['Accent Wall Count'] = String(workOrder.accent_wall_count);
        if (exportConfig.columns.hasExtraCharges) row['Has Extra Charges'] = workOrder.has_extra_charges ? 'Yes' : 'No';
        if (exportConfig.columns.extraChargesDescription && workOrder.extra_charges_description) row['Extra Charges Description'] = workOrder.extra_charges_description;
        if (exportConfig.columns.extraHours && workOrder.extra_hours) row['Extra Hours'] = String(workOrder.extra_hours);
        if (exportConfig.columns.additionalComments && workOrder.additional_comments) row['Additional Comments'] = workOrder.additional_comments;
      }
      
      return row;
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Filter jobs by date range
    const filteredJobs = sortedAndFilteredJobs.filter(job => {
      const jobDate = parseISO(job.scheduled_date);
      const startDate = parseISO(exportConfig.dateRange.startDate);
      const endDate = parseISO(exportConfig.dateRange.endDate);
      return jobDate >= startDate && jobDate <= endDate;
    });

    // Create headers and data arrays based on selected columns
    const headers: string[] = [];
    const colWidths: number[] = [];
    let totalWidth = 0;

    if (exportConfig.columns.workOrder) {
      headers.push('WO #');
      colWidths.push(20);
      totalWidth += 20;
    }
    if (exportConfig.columns.phase) {
      headers.push('Phase');
      colWidths.push(25);
      totalWidth += 25;
    }
    if (exportConfig.columns.property) {
      headers.push('Property');
      colWidths.push(35);
      totalWidth += 35;
    }
    if (exportConfig.columns.unitNumber) {
      headers.push('Unit #');
      colWidths.push(15);
      totalWidth += 15;
    }
    if (exportConfig.columns.unitSize) {
      headers.push('Size');
      colWidths.push(15);
      totalWidth += 15;
    }
    if (exportConfig.columns.jobType) {
      headers.push('Type');
      colWidths.push(20);
      totalWidth += 20;
    }
    if (exportConfig.columns.scheduledDate) {
      headers.push('Work Order Date');
      colWidths.push(25);
      totalWidth += 25;
    }
    if (exportConfig.columns.amount) {
      headers.push('Amount');
      colWidths.push(20);
      totalWidth += 20;
    }

    const data = filteredJobs.map(job => {
      const row: string[] = [];
      if (exportConfig.columns.workOrder) row.push(formatWorkOrderNumber(job.work_order_num));
      if (exportConfig.columns.phase) row.push(job.job_phase?.job_phase_label || '');
      if (exportConfig.columns.property) row.push(job.property.property_name);
      if (exportConfig.columns.unitNumber) row.push(job.unit_number);
      if (exportConfig.columns.unitSize) row.push(job.unit_size.unit_size_label);
      if (exportConfig.columns.jobType) row.push(job.job_type.job_type_label);
      if (exportConfig.columns.scheduledDate) row.push(formatDate(job.scheduled_date));
      if (exportConfig.columns.amount) row.push(job.total_billing_amount ? `$${job.total_billing_amount.toFixed(2)}` : '$0.00');
      return row;
    });

    // Set up page dimensions and margins
    const margin = 10;
    const startX = margin;
    const startY = 20;
    const rowHeight = 8;
    const maxRowsPerPage = Math.floor((doc.internal.pageSize.getHeight() - startY - margin) / rowHeight);

    // Add title
    doc.setFontSize(12);
    doc.text(title, startX, startY - 5);

    // Function to add a page of data
    const addPage = (startIndex: number) => {
      if (startIndex > 0) {
        doc.addPage();
      }

      // Add headers
      doc.setFontSize(8);
      let currentX = startX;
      headers.forEach((header, i) => {
        doc.text(header, currentX, startY);
        currentX += colWidths[i];
      });

      // Add data rows
      const endIndex = Math.min(startIndex + maxRowsPerPage, data.length);
      for (let i = startIndex; i < endIndex; i++) {
        const row = data[i];
        currentX = startX;
        row.forEach((cell, j) => {
          // Truncate text if it's too long
          const text = cell?.toString() || '';
          const maxLength = Math.floor(colWidths[j] / 1.5); // Approximate characters that fit
          const truncatedText = text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
          doc.text(truncatedText, currentX, startY + ((i - startIndex + 1) * rowHeight));
          currentX += colWidths[j];
        });
      }

      return endIndex;
    };

    // Add data in pages
    let currentIndex = 0;
    while (currentIndex < data.length) {
      currentIndex = addPage(currentIndex);
    }

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
          job_phases!current_phase_id (
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

      console.log('Deleting jobs with IDs:', selectedJobs);
      
      // For deletion operations, we need admin privileges to bypass RLS
      // Create admin client with service role key
      const adminClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      // Delete in the correct order to maintain referential integrity
      // 1. Delete work orders first
      console.log('Step 1: Deleting work orders...');
      const { error: workOrdersError, count: workOrdersCount } = await adminClient
        .from('work_orders')
        .delete({ count: 'exact' })
        .in('job_id', selectedJobs);

      if (workOrdersError) {
        console.error('Error deleting work orders:', workOrdersError);
        throw new Error(`Failed to delete work orders: ${workOrdersError.message}`);
      }
      console.log(`Deleted ${workOrdersCount || 0} work orders`);

      // 2. Delete files associated with the jobs
      console.log('Step 2: Deleting files...');
      const { error: filesError, count: filesCount } = await adminClient
        .from('files')
        .delete({ count: 'exact' })
        .in('job_id', selectedJobs);

      if (filesError) {
        console.error('Error deleting files:', filesError);
        throw new Error(`Failed to delete files: ${filesError.message}`);
      }
      console.log(`Deleted ${filesCount || 0} files`);

      // 3. Delete the jobs themselves
      console.log('Step 3: Deleting jobs...');
      const { error: jobsDeleteError, count: jobsCount } = await adminClient
        .from('jobs')
        .delete({ count: 'exact' })
        .in('id', selectedJobs);

      if (jobsDeleteError) {
        console.error('Error deleting jobs:', jobsDeleteError);
        throw new Error(`Failed to delete jobs: ${jobsDeleteError.message}`);
      }
      console.log(`Deleted ${jobsCount || 0} jobs`);

      // 4. Verify deletion by checking if jobs still exist
      console.log('Step 4: Verifying deletion...');
      const { data: remainingJobs, error: verifyError } = await adminClient
        .from('jobs')
        .select('id')
        .in('id', selectedJobs);

      if (verifyError) {
        console.error('Error verifying deletion:', verifyError);
      } else {
        console.log(`Remaining jobs after deletion:`, remainingJobs);
        if (remainingJobs && remainingJobs.length > 0) {
          throw new Error(`Deletion failed: ${remainingJobs.length} jobs still exist in database`);
        }
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
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <ClipboardList className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>
        <div className="flex space-x-3">
          {refetch && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          {selectedJobs.length > 0 && (
            <>
              {isArchive ? (
                <>
                  <button
                    onClick={() => setShowUnarchiveConfirm(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Unarchive Selected ({selectedJobs.length})
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedJobs.length})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Selected ({selectedJobs.length})
                </button>
              )}
            </>
          )}
          {showAddButton && (
            <Link
              to={addButtonLink}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Job Request
            </Link>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
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

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#1E293B] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
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
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('work_order_num')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Work Order #
                    <SortIcon field="work_order_num" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('job_phase')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Job Phase
                    <SortIcon field="job_phase" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('property_name')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Property Name
                    <SortIcon field="property_name" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('unit_number')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Unit #
                    <SortIcon field="unit_number" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('unit_size')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Unit Size
                    <SortIcon field="unit_size" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('job_type')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Job Type
                    <SortIcon field="job_type" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('scheduled_date')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Scheduled Date
                    <SortIcon field="scheduled_date" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('total_billing_amount')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Amount
                    <SortIcon field="total_billing_amount" />
                  </button>
                </th>
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
                  <td className="px-6 py-4">
                    <Link
                      to={`/dashboard/jobs/${job.id}`}
                      className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                    >
                      {formatWorkOrderNumber(job.work_order_num)}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {job.job_phase && (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
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
                      className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {job.property.property_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 dark:text-gray-400">
                      {job.unit_number}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 dark:text-gray-400">
                      {job.unit_size.unit_size_label}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 dark:text-gray-400">
                      {job.job_type.job_type_label}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 dark:text-gray-400">
                      {formatDate(job.scheduled_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 dark:text-gray-400">
                      {job.total_billing_amount ? `$${job.total_billing_amount.toFixed(2)}` : '$0.00'}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedAndFilteredJobs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              {/* Date Range Selection */}
              <div className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Range</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exportConfig.dateRange.startDate}
                      onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, startDate: e.target.value }
                      }))}
                      className="w-full px-3 py-2 bg-white dark:bg-[#2D3B4E] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={exportConfig.dateRange.endDate}
                      onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, endDate: e.target.value }
                      }))}
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
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Job Information</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.entries(exportConfig.columns).filter(([key, val]) => 
                          !key.includes('is') && !key.includes('painted') && !key.includes('has') && 
                          !key.includes('extra') && !key.includes('accent') && !key.includes('submission') &&
                          !key.includes('cabinet') && !key.includes('ceiling') && !key.includes('additional') &&
                          !key.includes('sprinklers') && !key.includes('paint') && val
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
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.workOrder}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, workOrder: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Work Order #</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.phase}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, phase: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Phase</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.property}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, property: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Property</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.address}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, address: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Address</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.unitNumber}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, unitNumber: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Unit #</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.unitSize}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, unitSize: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Unit Size</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.jobType}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, jobType: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Job Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.scheduledDate}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, scheduledDate: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Scheduled Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.dueDate}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, dueDate: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Due Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.completedDate}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, completedDate: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Completed Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.amount}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, amount: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Amount</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.description}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, description: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.status}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, status: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Status</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.createdBy}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, createdBy: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Created By</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.assignedTo}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, assignedTo: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Assigned To</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.createdAt}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, createdAt: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Created At</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.updatedAt}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, updatedAt: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Updated At</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Work Order Information Accordion */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <button
                    onClick={() => toggleSection('workOrderInfo')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Work Order Details</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.entries(exportConfig.columns).filter(([key, val]) => 
                          (key.includes('is') || key.includes('painted') || key.includes('has') || 
                          key.includes('extra') || key.includes('accent') || key.includes('submission') ||
                          key.includes('cabinet') || key.includes('ceiling') || key.includes('additional') ||
                          key.includes('sprinklers') || key === 'paintType') && val
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
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.submissionDate}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, submissionDate: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Submission Date</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.isOccupied}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, isOccupied: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Is Occupied</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.isFullPaint}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, isFullPaint: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Full Paint</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintType}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintType: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Paint Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.hasSprinklers}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, hasSprinklers: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Sprinklers</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.sprinklersPainted}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, sprinklersPainted: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Sprinklers Painted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedCeilings}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedCeilings: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Ceilings</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.ceilingRoomsCount}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, ceilingRoomsCount: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ceiling Rooms Count</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedPatio}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedPatio: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Patio</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedGarage}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedGarage: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Garage</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedCabinets}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedCabinets: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Cabinets</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedCrownMolding}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedCrownMolding: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Crown Molding</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.paintedFrontDoor}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, paintedFrontDoor: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Painted Front Door</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.cabinetRemovalRepair}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, cabinetRemovalRepair: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Cabinet Removal/Repair</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.ceilingLightsRepair}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, ceilingLightsRepair: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Ceiling Lights Repair</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.hasAccentWall}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, hasAccentWall: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Accent Wall</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.accentWallType}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, accentWallType: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Accent Wall Type</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.accentWallCount}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, accentWallCount: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Accent Wall Count</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.hasExtraCharges}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, hasExtraCharges: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Has Extra Charges</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.extraChargesDescription}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, extraChargesDescription: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Extra Charges Description</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.extraHours}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, extraHours: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Extra Hours</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={exportConfig.columns.additionalComments}
                            onChange={(e) => setExportConfig((prev: ExportConfig) => ({
                              ...prev,
                              columns: { ...prev.columns, additionalComments: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Additional Comments</span>
                        </label>
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
    </div>
  );
}