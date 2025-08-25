import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobIds } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'Invalid job IDs' });
    }

    // Delete in the correct order to maintain referential integrity
    // 1. Delete work orders first (no cascade)
    const { error: workOrdersError } = await supabaseAdmin
      .from('work_orders')
      .delete()
      .in('job_id', jobIds);

    if (workOrdersError) {
      console.error('Error deleting work orders:', workOrdersError);
      return res.status(500).json({ error: 'Failed to delete work orders' });
    }

    // 2. Delete files associated with the jobs (no cascade)
    const { error: filesError } = await supabaseAdmin
      .from('files')
      .delete()
      .in('job_id', jobIds);

    if (filesError) {
      console.error('Error deleting files:', filesError);
      return res.status(500).json({ error: 'Failed to delete files' });
    }

    // 3. Delete the jobs themselves
    const { error: jobsError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .in('id', jobIds);

    if (jobsError) {
      console.error('Error deleting jobs:', jobsError);
      return res.status(500).json({ error: 'Failed to delete jobs' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in delete handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 