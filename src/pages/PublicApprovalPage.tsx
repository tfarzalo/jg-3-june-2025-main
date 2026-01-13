import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { formatDate } from '../lib/dateUtils';

interface ApprovalData {
  valid: boolean;
  approval?: {
    id: string;
    type: string;
    status: string;
    expiresAt: string;
    amount?: number;
    description?: string;
    requested_by?: string;
  };
  job?: any;
  images?: Array<{
    id: string;
    file_path: string;
    image_type: string;
    signedUrl: string;
    selected?: boolean;
  }>;
  error?: string;
}

export function PublicApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const [loading, setLoading] = useState(true);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('get-approval-details-by-token', {
        body: { token }
      });

      if (error || !data.valid) {
        setApprovalData({ valid: false, error: data.error || error?.message || 'Invalid token' });
        return;
      }

      setApprovalData(data);
    } catch (error) {
      console.error('Error validating token:', error);
      setApprovalData({ 
        valid: false, 
        error: 'Failed to validate approval link. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!token) return;

    try {
      setProcessing(true);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/process-approval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            action,
            notes: notes || null
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process approval');
      }

      toast.success(
        action === 'approve' 
          ? 'Request approved successfully!' 
          : 'Request rejected successfully!'
      );

      // Refresh the approval data to show updated status
      await validateToken();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const openImage = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validating approval link...</p>
        </div>
      </div>
    );
  }

  if (!approvalData?.valid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Approval Link
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {approvalData?.error || 'This approval link is invalid, expired, or has already been used.'}
          </p>
        </div>
      </div>
    );
  }

  const { approval, job, images } = approvalData;
  const isAlreadyProcessed = approval?.status !== 'pending';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Approval Request
            </h1>
            {isAlreadyProcessed && (
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                approval?.status === 'approved' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {approval?.status === 'approved' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-semibold capitalize">{approval?.status}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Approval Type:</span>
              <p className="font-semibold text-gray-900 dark:text-white capitalize">
                {approval?.type?.replace('_', ' ')}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Expires:</span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {approval?.expiresAt ? formatDate(approval.expiresAt) : 'N/A'}
              </p>
            </div>
            {approval?.amount && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  ${approval.amount.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Job Details */}
        {job && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Job Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Property:</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {job.property?.property_name || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Unit:</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {job.unit_number || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Work Order #:</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {job.work_order_num || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Scheduled Date:</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {job.scheduled_date ? formatDate(job.scheduled_date) : 'N/A'}
                </p>
              </div>
            </div>

            {approval?.description && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Description:</span>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {approval.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Images */}
        {images && images.length > 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              Images for Approval ({images.filter(img => img.selected).length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.filter(img => img.selected).map((image) => {
                const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${image.file_path}`;
                return (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer"
                    onClick={() => openImage(imageUrl)}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={image.image_type || 'Job image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-image.png';
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                      <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400 capitalize">
                      {image.image_type || 'Image'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes Section (always visible) */}
        {!isAlreadyProcessed && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#334155] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any comments or notes about your decision..."
            />
          </div>
        )}

        {/* Action Buttons */}
        {!isAlreadyProcessed ? (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleApproval('approve')}
                disabled={processing}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 font-semibold"
              >
                <CheckCircle className="h-5 w-5" />
                <span>{processing ? 'Processing...' : 'Approve Request'}</span>
              </button>
              <button
                onClick={() => handleApproval('reject')}
                disabled={processing}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 font-semibold"
              >
                <XCircle className="h-5 w-5" />
                <span>{processing ? 'Processing...' : 'Reject Request'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              This approval request has already been processed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicApprovalPage;
