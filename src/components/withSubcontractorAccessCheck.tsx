import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/utils/supabase';

/**
 * HOC to ensure only the assigned subcontractor (or admin/manager) can access a component for a job.
 * Redirects to dashboard if not allowed.
 */
export function withSubcontractorAccessCheck<T>(
  WrappedComponent: React.ComponentType<T>
) {
  return function SubcontractorAccessWrapper(props: T) {
    const navigate = useNavigate();
    const { jobId } = useParams<{ jobId: string }>();
    useEffect(() => {
      async function checkAccess() {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId || !jobId) {
          navigate('/dashboard/subcontractor');
          return;
        }
        // Fetch job and check assigned_to
        const { data: job } = await supabase
          .from('jobs')
          .select('assigned_to')
          .eq('id', jobId)
          .single();
        if (!job) {
          navigate('/dashboard/subcontractor');
          return;
        }
        // Fetch user role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (!profile) {
          navigate('/dashboard/subcontractor');
          return;
        }
        if (
          profile.role === 'admin' ||
          profile.role === 'jg_management' ||
          job.assigned_to === userId
        ) {
          // Allowed
          return;
        }
        // Not allowed
        navigate('/dashboard/subcontractor');
      }
      checkAccess();
    }, [jobId, navigate]);
    return <WrappedComponent {...props} />;
  };
}
