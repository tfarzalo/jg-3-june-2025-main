import { SupabaseClient } from '@supabase/supabase-js';

type DeleteJobResult = {
  success?: boolean;
  job_deleted?: boolean;
  file_paths?: string[];
  deleted_counts?: Record<string, number>;
  message?: string;
};

const normalizeStoragePath = (path: string) => path.replace(/^\/+/, '');

export const deleteJobSafely = async (
  supabase: SupabaseClient,
  jobId: string
): Promise<DeleteJobResult> => {
  const { data, error } = await supabase.rpc('delete_job_safely', {
    p_job_id: jobId,
  });

  if (error) {
    throw error;
  }

  const result = (data || {}) as DeleteJobResult;
  const filePaths = (result.file_paths || [])
    .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    .map(normalizeStoragePath);

  if (filePaths.length > 0) {
    const { error: storageDeleteError } = await supabase.storage
      .from('files')
      .remove(filePaths);

    if (storageDeleteError) {
      console.error('Job deleted, but storage cleanup failed:', storageDeleteError);
    }
  }

  return result;
};
