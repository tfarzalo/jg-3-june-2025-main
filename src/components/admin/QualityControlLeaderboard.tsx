import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ClipboardCheck, RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { QUALITY_CONTROL_SCORE_TOTAL } from '../../lib/qualityControl';

type QualityControlLeaderboardRow = {
  id: string;
  score_total: number | null;
  created_at: string;
  form_data: {
    subcontractor_id?: string | null;
    subcontractor_name?: string | null;
    painter_name?: string | null;
    painter_first_name?: string | null;
    painter_last_name?: string | null;
  } | null;
};

type SubcontractorScore = {
  key: string;
  name: string;
  submissions: number;
  totalScore: number;
  average: number;
};

type MonthScore = {
  key: string;
  label: string;
  submissions: number;
  average: number;
  subcontractors: SubcontractorScore[];
};

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getSubcontractorName(row: QualityControlLeaderboardRow) {
  const formData = row.form_data || {};
  const fullName = [formData.painter_first_name, formData.painter_last_name].filter(Boolean).join(' ');
  return formData.subcontractor_name || formData.painter_name || fullName || 'Unassigned subcontractor';
}

function buildLeaderboard(rows: QualityControlLeaderboardRow[]): MonthScore[] {
  const months = new Map<string, {
    label: string;
    submissions: number;
    totalScore: number;
    subcontractors: Map<string, Omit<SubcontractorScore, 'average'>>;
  }>();

  rows.forEach((row) => {
    const submittedAt = new Date(row.created_at);
    if (Number.isNaN(submittedAt.getTime())) return;

    const score = Math.min(QUALITY_CONTROL_SCORE_TOTAL, Math.max(0, Number(row.score_total || 0)));
    const monthKey = getMonthKey(submittedAt);
    const month = months.get(monthKey) || {
      label: monthFormatter.format(submittedAt),
      submissions: 0,
      totalScore: 0,
      subcontractors: new Map<string, Omit<SubcontractorScore, 'average'>>(),
    };

    const formData = row.form_data || {};
    const subcontractorName = getSubcontractorName(row);
    const subcontractorKey = formData.subcontractor_id || subcontractorName.toLowerCase();
    const subcontractor = month.subcontractors.get(subcontractorKey) || {
      key: subcontractorKey,
      name: subcontractorName,
      submissions: 0,
      totalScore: 0,
    };

    subcontractor.submissions += 1;
    subcontractor.totalScore += score;
    month.submissions += 1;
    month.totalScore += score;
    month.subcontractors.set(subcontractorKey, subcontractor);
    months.set(monthKey, month);
  });

  return Array.from(months.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, month]) => ({
      key,
      label: month.label,
      submissions: month.submissions,
      average: month.submissions ? month.totalScore / month.submissions : 0,
      subcontractors: Array.from(month.subcontractors.values())
        .map((subcontractor) => ({
          ...subcontractor,
          average: subcontractor.submissions ? subcontractor.totalScore / subcontractor.submissions : 0,
        }))
        .sort((a, b) => b.average - a.average || b.submissions - a.submissions || a.name.localeCompare(b.name)),
    }));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function LeaderboardTable({ month, highlight }: { month: MonthScore; highlight?: boolean }) {
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className={`px-5 py-4 border-b border-gray-200 dark:border-gray-700 ${highlight ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-[#0F172A]'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {highlight ? <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> : <ClipboardCheck className="h-5 w-5 text-gray-500 dark:text-gray-300" />}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{month.label}</h3>
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatPercent(month.average)} average across {month.submissions} submission{month.submissions === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {month.subcontractors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-[#0F172A]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Rank</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Subcontractor</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Submissions</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {month.subcontractors.map((subcontractor, index) => (
                <tr key={subcontractor.key}>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">#{index + 1}</td>
                  <td className="px-5 py-3 text-sm text-gray-800 dark:text-gray-200">{subcontractor.name}</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{subcontractor.submissions}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatPercent(subcontractor.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5 text-sm text-gray-500 dark:text-gray-400">No QC submissions for this month.</div>
      )}
    </div>
  );
}

export function QualityControlLeaderboard() {
  const [rows, setRows] = useState<QualityControlLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('job_quality_control_submissions')
        .select('id, score_total, created_at, form_data')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setRows((data || []) as QualityControlLeaderboardRow[]);
    } catch (err) {
      console.error('Error loading QC leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load QC leaderboard');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const months = useMemo(() => buildLeaderboard(rows), [rows]);
  const currentMonthKey = getMonthKey(new Date());
  const currentMonth = months.find(month => month.key === currentMonthKey) || null;
  const pastMonths = months.filter(month => month.key !== currentMonthKey);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading QC leaderboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              QC Leaderboard
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Monthly average Quality Control percentages by subcontractor.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLeaderboard}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-[#0F172A] dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {currentMonth ? (
        <LeaderboardTable month={currentMonth} highlight />
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-400">
          No QC submissions have been submitted for {monthFormatter.format(new Date())}.
        </div>
      )}

      {pastMonths.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Past Months</h3>
          {pastMonths.map(month => (
            <LeaderboardTable key={month.key} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}
