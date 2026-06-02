import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, Search } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { formatDisplayDate } from '../../lib/dateUtils';

interface SubcontractorAdminViewProps {
  userId: string;
  userName?: string;
  userEmail?: string;
}

interface JobRow {
  id: string;
  work_order_num: number;
  unit_number: string | null;
  scheduled_date: string | null;
  assigned_to_name_snapshot?: string | null;
  property: { id: string; property_name: string } | null;
  job_phase: { job_phase_label: string; color_dark_mode: string | null } | null;
  unit_size: { unit_size_label: string } | null;
  job_type: { job_type_label: string } | null;
}

interface PropertyRow {
  id: string;
  property_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  preferred_subcontractor_a_id: string | null;
  preferred_subcontractor_b_id: string | null;
  preferred_subcontractor_c_id: string | null;
  preferred_subcontractor_d_id: string | null;
}

type RawJobRow = Omit<JobRow, 'property' | 'job_phase' | 'unit_size' | 'job_type'> & {
  property: JobRow['property'] | JobRow['property'][];
  job_phase: JobRow['job_phase'] | JobRow['job_phase'][];
  unit_size: JobRow['unit_size'] | JobRow['unit_size'][];
  job_type: JobRow['job_type'] | JobRow['job_type'][];
};

const terminalPhases = new Set(['Completed', 'Archived']);

const formatWorkOrderNumber = (num: number) => `WO-${String(num).padStart(6, '0')}`;

const firstRelated = <T,>(value: T | T[] | null): T | null => (
  Array.isArray(value) ? value[0] ?? null : value
);

export function SubcontractorAdminView({ userId, userName, userEmail }: SubcontractorAdminViewProps) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentJobsOpen, setCurrentJobsOpen] = useState(true);
  const [jobHistoryOpen, setJobHistoryOpen] = useState(true);

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        setLoading(true);
        setError(null);

        const [{ data: jobData, error: jobsError }, { data: propertyData, error: propertiesError }] = await Promise.all([
          supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              assigned_to_name_snapshot,
              property:properties(id, property_name),
              job_phase:job_phases(job_phase_label, color_dark_mode),
              unit_size:unit_sizes(unit_size_label),
              job_type:job_types(job_type_label)
            `)
            .eq('assigned_to', userId)
            .order('scheduled_date', { ascending: false }),
          supabase
            .from('properties')
            .select(`
              id,
              property_name,
              address,
              city,
              state,
              preferred_subcontractor_a_id,
              preferred_subcontractor_b_id,
              preferred_subcontractor_c_id,
              preferred_subcontractor_d_id
            `)
            .or(`preferred_subcontractor_a_id.eq.${userId},preferred_subcontractor_b_id.eq.${userId},preferred_subcontractor_c_id.eq.${userId},preferred_subcontractor_d_id.eq.${userId}`)
            .order('property_name', { ascending: true }),
        ]);

        if (jobsError) throw jobsError;
        if (propertiesError) throw propertiesError;

        setJobs((jobData || []).map((job) => {
          const row = job as unknown as RawJobRow;
          return {
            ...row,
            property: firstRelated(row.property),
            job_phase: firstRelated(row.job_phase),
            unit_size: firstRelated(row.unit_size),
            job_type: firstRelated(row.job_type),
          };
        }));
        setProperties(propertyData || []);
      } catch (err) {
        console.error('Error loading subcontractor admin breakdown:', err);
        setError(err instanceof Error ? err.message : 'Failed to load subcontractor breakdown');
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [userId]);

  const filteredJobs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return jobs;

    return jobs.filter(job => (
      formatWorkOrderNumber(job.work_order_num).toLowerCase().includes(q) ||
      (job.property?.property_name || '').toLowerCase().includes(q) ||
      (job.unit_number || '').toLowerCase().includes(q)
    ));
  }, [jobs, searchTerm]);

  const currentJobs = filteredJobs.filter(job => !terminalPhases.has(job.job_phase?.job_phase_label || ''));
  const historicalJobs = filteredJobs.filter(job => terminalPhases.has(job.job_phase?.job_phase_label || ''));
  const slotOneProperties = properties.filter(property => property.preferred_subcontractor_a_id === userId);
  const slotTwoProperties = properties.filter(property => property.preferred_subcontractor_b_id === userId);
  const slotThreeProperties = properties.filter(property => property.preferred_subcontractor_c_id === userId);
  const slotFourProperties = properties.filter(property => property.preferred_subcontractor_d_id === userId);

  const renderJobList = (items: JobRow[], emptyText: string) => (
    <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      ) : (
        items.map(job => (
          <div key={job.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <Link to={`/dashboard/jobs/${job.id}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                {formatWorkOrderNumber(job.work_order_num)}
              </Link>
              <p className="text-sm text-gray-900 dark:text-white">
                {job.property?.property_name || 'Unknown property'}{job.unit_number ? `, Unit ${job.unit_number}` : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[job.unit_size?.unit_size_label, job.job_type?.job_type_label].filter(Boolean).join(' - ') || 'No unit/job type'}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              {job.job_phase && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: job.job_phase.color_dark_mode || '#4B5563' }}
                >
                  {job.job_phase.job_phase_label}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {job.scheduled_date ? formatDisplayDate(job.scheduled_date) : 'No date'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderPropertyList = (items: PropertyRow[], emptyText: string) => (
    <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      ) : (
        items.map(property => (
          <div key={property.id} className="px-4 py-3">
            <Link to={`/dashboard/properties/${property.id}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              {property.property_name}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {[property.address, property.city, property.state].filter(Boolean).join(', ') || 'No address'}
            </p>
          </div>
        ))
      )}
    </div>
  );

  const renderJobSection = (
    title: string,
    items: JobRow[],
    emptyText: string,
    icon: ReactNode,
    isOpen: boolean,
    onToggle: () => void
  ) => (
    <section className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden bg-white dark:bg-[#1E293B]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-[#162033] transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">({items.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && renderJobList(items, emptyText)}
    </section>
  );

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-gray-600 dark:text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
        Loading subcontractor breakdown...
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#2D3B4E] rounded-lg">
          <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{jobs.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Assigned jobs</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#2D3B4E] rounded-lg">
          <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentJobs.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current jobs</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#2D3B4E] rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{historicalJobs.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Historical jobs</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#2D3B4E] rounded-lg">
          <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{properties.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Preferred properties</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subcontractor Work Overview</h3>
          {(userName || userEmail) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[userName, userEmail].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <aside className="xl:col-span-1 space-y-4">
          <section className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden bg-white dark:bg-[#1E293B]">
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#0F172A]">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Preferred Subcontractor 1</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{slotOneProperties.length} propert{slotOneProperties.length === 1 ? 'y' : 'ies'}</p>
            </div>
            {renderPropertyList(slotOneProperties, 'No properties list this subcontractor in slot 1.')}
          </section>
          <section className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden bg-white dark:bg-[#1E293B]">
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#0F172A]">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Preferred Subcontractor 2</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{slotTwoProperties.length} propert{slotTwoProperties.length === 1 ? 'y' : 'ies'}</p>
            </div>
            {renderPropertyList(slotTwoProperties, 'No properties list this subcontractor in slot 2.')}
          </section>
          <section className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden bg-white dark:bg-[#1E293B]">
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#0F172A]">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Preferred Subcontractor 3</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{slotThreeProperties.length} propert{slotThreeProperties.length === 1 ? 'y' : 'ies'}</p>
            </div>
            {renderPropertyList(slotThreeProperties, 'No properties list this subcontractor in slot 3.')}
          </section>
          <section className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg overflow-hidden bg-white dark:bg-[#1E293B]">
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#0F172A]">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Preferred Subcontractor 4</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{slotFourProperties.length} propert{slotFourProperties.length === 1 ? 'y' : 'ies'}</p>
            </div>
            {renderPropertyList(slotFourProperties, 'No properties list this subcontractor in slot 4.')}
          </section>
        </aside>

        <div className="xl:col-span-2 space-y-4">
          {renderJobSection(
            'Current Jobs',
            currentJobs,
            'No current jobs assigned.',
            <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
            currentJobsOpen,
            () => setCurrentJobsOpen(prev => !prev)
          )}
          {renderJobSection(
            'Job History',
            historicalJobs,
            'No completed or archived jobs assigned.',
            <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-400" />,
            jobHistoryOpen,
            () => setJobHistoryOpen(prev => !prev)
          )}
        </div>
      </div>
    </div>
  );
}
