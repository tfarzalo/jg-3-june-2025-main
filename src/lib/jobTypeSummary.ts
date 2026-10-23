export type JobTypeSummary = {
  paint: number;
  clean: number;
  callback: number;
  repair: number;
  other: number;
  total: number;
};

type JobTypeRelation = { job_type_label?: string | null } | Array<{ job_type_label?: string | null }> | null;
type JobWithType = { job_type?: JobTypeRelation };

export function getJobTypeLabel(job: JobWithType): string {
  const relation = Array.isArray(job?.job_type) ? job.job_type[0] : job?.job_type;
  return String(relation?.job_type_label || 'Unknown').trim();
}

export function summarizeJobTypes(jobs: JobWithType[]): JobTypeSummary {
  const summary: JobTypeSummary = {
    paint: 0,
    clean: 0,
    callback: 0,
    repair: 0,
    other: 0,
    total: jobs.length,
  };

  jobs.forEach((job) => {
    const label = getJobTypeLabel(job).toLowerCase();
    if (label === 'paint') summary.paint += 1;
    else if (label === 'clean') summary.clean += 1;
    else if (label === 'callback') summary.callback += 1;
    else if (label === 'repair') summary.repair += 1;
    else summary.other += 1;
  });

  return summary;
}
