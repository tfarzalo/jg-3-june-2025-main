import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity as ActivityIcon, ArrowRight, ChevronDown, Filter, Search, User, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { supabase } from '../utils/supabase';
import { formatJobPhaseLabel } from '../lib/jobPhaseLabels';

const PAGE_SIZE = 150;

interface ActivityItem {
  event_key: string; source: 'phase_change' | 'activity_log'; title: string; description: string;
  job_id: string | null; actor_name: string; occurred_at: string;
  from_phase_label: string | null; from_phase_color: string | null;
  to_phase_label: string | null; to_phase_color: string | null;
  work_order_num: number | null; unit_number: string | null;
  property_id: string | null; property_name: string | null;
}
type PhaseOption = { label: string; color: string };
type UserOption = { id: string; name: string };

function dateStart(filter: string) {
  if (filter === 'today') return formatInTimeZone(new Date(), 'America/New_York', "yyyy-MM-dd'T'00:00:00XXX");
  if (filter === 'week') return subDays(new Date(), 7).toISOString();
  if (filter === 'month') return subDays(new Date(), 30).toISOString();
  return null;
}

export function Activity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const requestId = useRef(0);
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchActivities = useCallback(async (append = false) => {
    const id = ++requestId.current;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    const cursor = append ? activities[activities.length - 1] : null;
    const { data, error: rpcError } = await supabase.rpc('get_activity_feed', {
      p_limit: PAGE_SIZE, p_before_at: cursor?.occurred_at ?? null,
      p_before_key: cursor?.event_key ?? null, p_date_from: dateStart(dateFilter),
      p_phase_labels: phaseFilter.length ? phaseFilter : null,
      p_user_ids: userFilter.length ? userFilter : null, p_search: debouncedSearch || null
    } as any);
    if (id !== requestId.current) return;
    if (rpcError) {
      console.error('Error fetching activity feed:', rpcError);
      setError('The activity log could not be loaded. Please try again.');
    } else {
      const rows = (data || []) as ActivityItem[];
      setHasMore(rows.length > PAGE_SIZE);
      setActivities(current => append ? [...current, ...rows.slice(0, PAGE_SIZE)] : rows.slice(0, PAGE_SIZE));
    }
    setLoading(false); setLoadingMore(false);
  }, [activities, dateFilter, debouncedSearch, phaseFilter, userFilter]);

  useEffect(() => { void fetchActivities(false); }, [dateFilter, debouncedSearch, phaseFilter, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void Promise.all([
      supabase.from('job_phases').select('job_phase_label, color_dark_mode').order('sort_order'),
      supabase.from('profiles').select('id, full_name').order('full_name')
    ]).then(([phaseResult, userResult]) => {
      if (!phaseResult.error) setPhases((phaseResult.data || []).map(p => ({ label: p.job_phase_label, color: p.color_dark_mode })));
      if (!userResult.error) setUsers((userResult.data || []).map(u => ({ id: u.id, name: u.full_name || 'Unknown User' })));
    });
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => void fetchActivities(false), 250);
    };
    const channel = supabase.channel('global-activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_phase_changes' }, refresh)
      .subscribe();
    return () => { if (realtimeTimer.current) clearTimeout(realtimeTimer.current); void supabase.removeChannel(channel); };
  }, [fetchActivities]);

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) =>
    setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  const formatDate = (value: string) => formatInTimeZone(new Date(value), 'America/New_York', 'MMM d, yyyy h:mm a');
  const woLabel = (num: number | null) => num == null ? 'Job' : `WO-${String(num).padStart(6, '0')}`;

  return <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
    <div className="flex items-center gap-3 mb-8"><ActivityIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" /><h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Activity Log</h1></div>
    <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search activities..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white" /></div>
      <div className="flex gap-4"><div className="relative">
        <button onClick={() => setFilterOpen(v => !v)} className="flex items-center px-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300"><Filter className="h-4 w-4 mr-2" />Filters<ChevronDown className="h-4 w-4 ml-2" /></button>
        {filterOpen && <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#1E293B] rounded-lg shadow-xl z-20 border border-gray-200 dark:border-[#2D3B4E]">
          <div className="p-4"><h3 className="text-sm font-medium dark:text-white mb-2">Job phases</h3><div className="space-y-2 max-h-44 overflow-y-auto">{phases.map(p => <label key={p.label} className="flex items-center text-sm dark:text-gray-200"><input type="checkbox" checked={phaseFilter.includes(p.label)} onChange={() => toggle(p.label, phaseFilter, setPhaseFilter)} className="mr-2" /><span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color }} />{formatJobPhaseLabel(p.label)}</label>)}</div></div>
          <div className="p-4 border-t dark:border-[#2D3B4E]"><h3 className="text-sm font-medium dark:text-white mb-2">Users</h3><div className="space-y-2 max-h-44 overflow-y-auto">{users.map(u => <label key={u.id} className="flex items-center text-sm dark:text-gray-200"><input type="checkbox" checked={userFilter.includes(u.id)} onChange={() => toggle(u.id, userFilter, setUserFilter)} className="mr-2" />{u.name}</label>)}</div></div>
          <div className="p-4 border-t dark:border-[#2D3B4E] text-right"><button onClick={() => { setPhaseFilter([]); setUserFilter([]); }} className="text-sm text-blue-600 dark:text-blue-400">Reset filters</button></div>
        </div>}
      </div><select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg dark:text-gray-300"><option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></div>
    </div>
    {(phaseFilter.length > 0 || userFilter.length > 0) && <div className="mb-5 flex flex-wrap gap-2">{phaseFilter.map(p => <button key={p} onClick={() => toggle(p, phaseFilter, setPhaseFilter)} className="flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">{formatJobPhaseLabel(p)}<XCircle className="h-4 w-4 ml-2" /></button>)}{userFilter.map(id => <button key={id} onClick={() => toggle(id, userFilter, setUserFilter)} className="flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"><User className="h-3 w-3 mr-1" />{users.find(u => u.id === id)?.name}<XCircle className="h-4 w-4 ml-2" /></button>)}</div>}
    {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {loading ? <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div> : activities.length === 0 ? <div className="bg-white dark:bg-[#1E293B] rounded-lg p-12 text-center text-gray-500">No activity matches these filters.</div> : <>
      <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">Showing {activities.length} event{activities.length === 1 ? '' : 's'} (150 per page)</div>
      <div className="space-y-3">{activities.map(item => <div key={item.event_key} className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm p-4 border border-gray-200 dark:border-[#2D3B4E]"><div className="flex flex-col md:flex-row md:justify-between gap-3"><div className="min-w-0"><div className="font-medium text-gray-900 dark:text-white">{item.title}</div><div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</div>{item.source === 'phase_change' && <div className="flex items-center gap-2 mt-2 text-sm">{item.from_phase_label && <span className="px-2 py-1 rounded text-white" style={{ backgroundColor: item.from_phase_color || '#64748B' }}>{formatJobPhaseLabel(item.from_phase_label)}</span>}{item.from_phase_label && <ArrowRight className="h-4 w-4 text-gray-400" />}<span className="px-2 py-1 rounded text-white" style={{ backgroundColor: item.to_phase_color || '#475569' }}>{formatJobPhaseLabel(item.to_phase_label || 'Unknown')}</span></div>}<div className="mt-2 text-xs text-gray-500">{item.actor_name} · {formatDate(item.occurred_at)}</div></div><div className="md:text-right text-sm">{item.job_id ? <Link to={`/dashboard/jobs/${item.job_id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{woLabel(item.work_order_num)}</Link> : <span className="font-medium dark:text-gray-200">{woLabel(item.work_order_num)}</span>}<div className="text-gray-600 dark:text-gray-400">{item.property_name || 'Unknown Property'}{item.unit_number ? ` · Unit ${item.unit_number}` : ''}</div></div></div></div>)}</div>
      {hasMore && <div className="flex justify-center py-8"><button disabled={loadingMore} onClick={() => void fetchActivities(true)} className="px-5 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">{loadingMore ? 'Loading…' : 'Load 150 more'}</button></div>}
    </>}
  </div>;
}
