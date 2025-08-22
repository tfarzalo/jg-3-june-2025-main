import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface JobPhase {
  id: string;
  job_phase_label: string;
}

interface Job {
  id: string;
  job_phase: JobPhase;
}

const EditJobRequest = () => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [canNoLongerEdit, setCanNoLongerEdit] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [selectedUnitSize, setSelectedUnitSize] = useState('');
  const [selectedJobType, setSelectedJobType] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkJobPhase = async () => {
      if (!jobId) return;

      try {
        const { data: job, error } = await supabase
          .from('jobs')
          .select(`
            id,
            job_phase:current_phase_id (
              id,
              job_phase_label
            )
          `)
          .eq('id', jobId)
          .single() as { data: Job | null; error: any };

        if (error) throw error;
        if (!job) throw new Error('Job not found');

        // Set canNoLongerEdit to true if the job is not in Job Request phase
        setCanNoLongerEdit(job.job_phase.job_phase_label !== 'Job Request');
      } catch (err) {
        console.error('Error checking job phase:', err);
        setCanNoLongerEdit(true);
      } finally {
        setLoading(false);
      }
    };

    void checkJobPhase();
  }, [jobId]);

  const properties = [
    { id: '1', name: 'Property A' },
    { id: '2', name: 'Property B' },
    { id: '3', name: 'Property C' },
  ];

  const unitSizes = [
    { id: '1', label: 'Unit Size 1' },
    { id: '2', label: 'Unit Size 2' },
    { id: '3', label: 'Unit Size 3' },
  ];

  const jobTypes = [
    { id: '1', label: 'Job Type 1' },
    { id: '2', label: 'Job Type 2' },
    { id: '3', label: 'Job Type 3' },
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Handle form submission
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Job Request
            </h1>
          </div>
        </div>

        {canNoLongerEdit && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="font-medium">Can no longer edit</p>
                <p className="mt-1 text-sm">This job request can no longer be edited because it has been moved to a different phase.</p>
              </div>
            </div>
          </div>
        )}

        {!canNoLongerEdit && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Property Selection */}
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Property Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="property" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Property
                  </label>
                  <select
                    id="property"
                    value={selectedProperty || ''}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a property</option>
                    {properties.map(property => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProperty && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Unit Number
                      </label>
                      <input
                        type="text"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Unit Size
                      </label>
                      <select
                        value={selectedUnitSize || ''}
                        onChange={(e) => setSelectedUnitSize(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select unit size</option>
                        {unitSizes.map(size => (
                          <option key={size.id} value={size.id}>
                            {size.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Type
                  </label>
                  <select
                    value={selectedJobType || ''}
                    onChange={(e) => setSelectedJobType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select job type</option>
                    {jobTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter job description"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditJobRequest;