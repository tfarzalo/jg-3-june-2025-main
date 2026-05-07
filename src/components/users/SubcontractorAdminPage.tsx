import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, User as UserIcon } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { SubcontractorAdminView } from './SubcontractorAdminView';

interface SubcontractorProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export function SubcontractorAdminPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SubcontractorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setError('Subcontractor user ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        setProfile(data);
      } catch (err) {
        console.error('Error loading subcontractor profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load subcontractor profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !profile || !userId) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/dashboard/users')}
            className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to User List
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error || 'Subcontractor not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = profile.full_name || profile.email;

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/users')}
              className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to User List
            </button>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Subcontractor Admin View</p>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/dashboard/subcontractor/edit/${profile.id}`}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <UserIcon className="h-4 w-4 mr-2" />
              View User Profile
            </Link>
          </div>
        </div>
      </div>

      <SubcontractorAdminView
        userId={profile.id}
        userName={displayName}
        userEmail={profile.email}
      />
    </div>
  );
}
