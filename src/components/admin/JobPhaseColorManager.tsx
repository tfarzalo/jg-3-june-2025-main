import { useEffect, useState } from 'react';
import { Loader2, Palette, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabase';

interface JobPhaseColor {
  id: string;
  job_phase_label: string;
  color_light_mode: string;
  color_dark_mode: string;
  sort_order: number | null;
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isValidHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function JobPhaseColorManager() {
  const [phases, setPhases] = useState<JobPhaseColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_light_mode, color_dark_mode, sort_order')
        .neq('job_phase_label', 'Grading')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPhases((data || []) as JobPhaseColor[]);
    } catch (error) {
      console.error('Failed to load job phase colors:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load job phase colors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhases();
  }, []);

  const updateDraftColor = (phaseId: string, key: 'color_light_mode' | 'color_dark_mode', value: string) => {
    setPhases((current) => current.map((phase) => (
      phase.id === phaseId ? { ...phase, [key]: value } : phase
    )));
  };

  const savePhase = async (phase: JobPhaseColor) => {
    const lightColor = phase.color_light_mode.trim();
    const darkColor = phase.color_dark_mode.trim();

    if (!isValidHexColor(lightColor) || !isValidHexColor(darkColor)) {
      toast.error('Use full hex colors like #276EF1.');
      return;
    }

    try {
      setSavingId(phase.id);
      const { error } = await supabase
        .from('job_phases')
        .update({
          color_light_mode: lightColor,
          color_dark_mode: darkColor,
        })
        .eq('id', phase.id);
      if (error) throw error;
      setPhases((current) => current.map((candidate) => (
        candidate.id === phase.id
          ? { ...candidate, color_light_mode: lightColor, color_dark_mode: darkColor }
          : candidate
      )));
      toast.success(`${phase.job_phase_label} colors updated`);
    } catch (error) {
      console.error('Failed to save job phase colors:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save job phase colors');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1E293B]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1E293B]">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Palette className="h-5 w-5 text-violet-600" />
            Job Phase Colors
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            These colors are saved on each job phase and used by phase badges, job cards, calendars, dashboard accents, and phase navigation.
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {phases.map((phase) => {
            const lightColorValid = isValidHexColor(phase.color_light_mode);
            const darkColorValid = isValidHexColor(phase.color_dark_mode);

            return (
              <div key={phase.id} className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-4 w-4 rounded-full border border-white shadow" style={{ backgroundColor: phase.color_dark_mode }} />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{phase.job_phase_label}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Display order {phase.sort_order ?? '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Light mode color</span>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={lightColorValid ? phase.color_light_mode : '#ffffff'}
                          onChange={(event) => updateDraftColor(phase.id, 'color_light_mode', event.target.value.toUpperCase())}
                          className="h-11 w-12 rounded border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-[#0F172A]"
                          aria-label={`${phase.job_phase_label} light color picker`}
                        />
                        <input
                          value={phase.color_light_mode}
                          onChange={(event) => updateDraftColor(phase.id, 'color_light_mode', event.target.value)}
                          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#0F172A] dark:text-white ${
                            lightColorValid ? 'border-gray-300 dark:border-gray-600' : 'border-red-400 dark:border-red-500'
                          }`}
                          placeholder="#E0F2FE"
                        />
                      </div>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark mode / status color</span>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={darkColorValid ? phase.color_dark_mode : '#000000'}
                          onChange={(event) => updateDraftColor(phase.id, 'color_dark_mode', event.target.value.toUpperCase())}
                          className="h-11 w-12 rounded border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-[#0F172A]"
                          aria-label={`${phase.job_phase_label} dark color picker`}
                        />
                        <input
                          value={phase.color_dark_mode}
                          onChange={(event) => updateDraftColor(phase.id, 'color_dark_mode', event.target.value)}
                          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#0F172A] dark:text-white ${
                            darkColorValid ? 'border-gray-300 dark:border-gray-600' : 'border-red-400 dark:border-red-500'
                          }`}
                          placeholder="#0369A1"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="rounded-md border-l-4 bg-white p-3 shadow-sm dark:bg-[#111827]" style={{ borderLeftColor: phase.color_dark_mode }}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: phase.color_dark_mode }} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Menu icon and job card accent</span>
                      </div>
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: phase.color_dark_mode }}>
                        {phase.job_phase_label}
                      </span>
                    </div>
                    <div className="mt-3 rounded-md border-t-4 bg-white p-3 text-sm font-medium text-gray-900 shadow-sm dark:bg-[#111827] dark:text-white" style={{ borderTopColor: phase.color_dark_mode }}>
                      Dashboard top border preview
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={fetchPhases}
                      disabled={savingId === phase.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#0F172A]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Revert
                    </button>
                    <button
                      type="button"
                      onClick={() => savePhase(phase)}
                      disabled={savingId === phase.id || !lightColorValid || !darkColorValid}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingId === phase.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {phases.length === 0 && (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No job phases found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
