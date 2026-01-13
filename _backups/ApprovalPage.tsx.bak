import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { ApprovalDetailsCard } from '../components/approval/ApprovalDetailsCard';
import { ApprovalImageGallery } from '../components/approval/ApprovalImageGallery';
import { generateApprovalPDF } from '../utils/generateApprovalPDF';
import { sendInternalApprovalNotification } from '../utils/sendInternalApprovalNotification';
import { Download } from 'lucide-react';

interface JobImage {
  id: string;
  file_path: string;
  file_name: string;
  image_type: string;
  mime_type: string;
  public_url?: string;
}

interface ApprovalData {
  id: string;
  job_id: string;
  token: string;
  extra_charges_data: {
    items: Array<{
      description: string;
      cost: number;
      hours?: number;
    }>;
    total: number;
    job_details?: any;
    selected_images?: string[]; // Array of image IDs
    selected_image_types?: string[]; // Array of image types (for categorization)
    selected_image_entries?: Array<{
      id: string;
      source?: 'job_images' | 'files';
      bucket?: string;
      file_path: string;
      file_name: string;
      normalized_type?: string;
    }>;
  };
  approver_email: string;
  approver_name: string;
  expires_at: string;
  job: {
    id: string;
    work_order_num: number;
    unit_number: string;
    property: {
      name: string;
      address: string;
      address_2?: string;
      city: string;
      state: string;
      zip: string;
    };
  };
}

const ApprovalPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [jobImages, setJobImages] = useState<JobImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [approvalLocked, setApprovalLocked] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  console.log('ApprovalPage component mounted with token:', token);

  // Force light mode for consistent presentation to recipients
  useEffect(() => {
    // Add light mode class to html element
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    
    // Override any dark mode preferences
    const style = document.createElement('style');
    style.id = 'force-light-mode';
    style.textContent = `
      html, body {
        color-scheme: light !important;
      }
      * {
        color-scheme: light !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup on unmount
    return () => {
      const styleEl = document.getElementById('force-light-mode');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  useEffect(() => {
    console.log('ApprovalPage useEffect - token:', token);
    if (token) {
      validateAndLoadApproval();
    } else {
      console.error('No token provided in URL');
      setError('Invalid approval link - no token provided');
      setLoading(false);
    }
  }, [token]);

  const validateAndLoadApproval = async () => {
    try {
      console.log('Validating approval token:', token);
      
      // Add a timeout to the query to avoid hanging
      const queryTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      );
      
      // First, try to get just the approval token data
      const basicTokenQuery = supabase
        .from('approval_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      console.log('Starting basic token query...');
      
      const { data: basicTokenData, error: basicTokenError } = await Promise.race([
        basicTokenQuery,
        queryTimeout
      ]) as any;

      console.log('Basic token query result:', { basicTokenData, basicTokenError });

      if (basicTokenError) {
        console.error('Basic token validation error:', basicTokenError);
        if (basicTokenError.code === 'PGRST116') {
          console.log('Token not found with current criteria, checking if token exists at all...');
          // Check if token exists at all (might be used or expired)
          const { data: anyTokenData, error: anyTokenError } = await supabase
            .from('approval_tokens')
            .select('used_at, expires_at, created_at')
            .eq('token', token)
            .single();
          
          console.log('Any token query result:', { anyTokenData, anyTokenError });
          
          if (anyTokenError) {
            setError('Invalid approval link - token not found in database');
          } else if (anyTokenData.used_at) {
            setError(`This approval link has already been used on ${new Date(anyTokenData.used_at).toLocaleString()}`);
          } else if (new Date(anyTokenData.expires_at) < new Date()) {
            setError(`This approval link expired on ${new Date(anyTokenData.expires_at).toLocaleString()}`);
          } else {
            setError('Invalid approval link - unknown issue');
          }
        } else {
          setError(`Database error: ${basicTokenError.message}`);
        }
        return;
      }

      if (!basicTokenData) {
        console.error('No basic token data returned');
        setError('Invalid or expired approval link - no data returned');
        return;
      }

      console.log('Basic token data found:', basicTokenData);

      // Now try to get the full data with joins
      console.log('Fetching full token data with job and property info...');
      
      // Try a different approach - separate queries if the join fails
      let fullTokenData = basicTokenData;
      
      // Use the extra_charges_data stored in the token instead of querying
      // This avoids RLS issues and is more reliable since we stored all needed data at send time
      console.log('Using stored job details from token extra_charges_data');
      
      if (basicTokenData.extra_charges_data?.job_details) {
        const jobDetails = basicTokenData.extra_charges_data.job_details;
        fullTokenData = {
          ...basicTokenData,
          job: {
            id: basicTokenData.job_id,
            work_order_num: jobDetails.work_order_num,
            unit_number: jobDetails.unit_number,
            property: {
              name: jobDetails.property_name || 'Property',
              address: jobDetails.property_address || 'Address not available',
              address_2: '',
              city: '',
              state: '',
              zip: ''
            }
          }
        };
        console.log('Successfully loaded approval data from token:', fullTokenData);
      } else {
        console.error('No job details found in token extra_charges_data');
        throw new Error('Approval data incomplete - please request a new approval link');
      }

      console.log('Final approval data:', fullTokenData);
      setApprovalData(fullTokenData as ApprovalData);

      const selectedEntries = basicTokenData.extra_charges_data?.selected_image_entries;
      if (selectedEntries && Array.isArray(selectedEntries) && selectedEntries.length > 0) {
        console.log('📸 Loading image entries stored with token:', selectedEntries.length);
        const normalizedImages: JobImage[] = [];
        for (const entry of selectedEntries) {
          const bucket = entry.bucket || (entry.source === 'files' ? 'files' : 'job-images');
          let publicUrl: string | undefined;
          try {
            const { data: signedData } = await supabase.storage
              .from(bucket)
              .createSignedUrl(entry.file_path, 60 * 60);
            publicUrl = signedData?.signedUrl;
          } catch (signedError) {
            console.warn('Signed URL failed, falling back to public URL', signedError);
          }
          if (!publicUrl && supabaseUrl) {
            publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${entry.file_path}`;
          }
          normalizedImages.push({
            id: entry.id,
            file_path: entry.file_path,
            file_name: entry.file_name,
            image_type: entry.normalized_type || entry.source || 'photo',
            mime_type: 'image/jpeg',
            public_url: publicUrl,
          });
        }
        setJobImages(normalizedImages);
      } else if (basicTokenData.extra_charges_data?.selected_images &&
        Array.isArray(basicTokenData.extra_charges_data.selected_images) &&
        basicTokenData.extra_charges_data.selected_images.length > 0) {
        console.log('📸 Loading selected images from job_images table...');
        const { data: imagesData, error: imagesError } = await supabase
          .from('job_images')
          .select('id, file_path, file_name, image_type, mime_type')
          .in('id', basicTokenData.extra_charges_data.selected_images);

        if (imagesError) {
          console.error('❌ Error loading images:', imagesError);
        } else if (imagesData) {
          setJobImages(
            imagesData.map((img) => ({
              ...img,
              public_url: supabaseUrl
                ? `${supabaseUrl}/storage/v1/object/public/job-images/${img.file_path}`
                : undefined,
            }))
          );
        }
      } else {
        console.log('ℹ️ No images selected in token (this is OK, but images are recommended for approval)');
        console.log('   extra_charges_data:', basicTokenData.extra_charges_data);
      }
    } catch (err) {
      console.error('Error loading approval data:', err);
      if (err instanceof Error && err.message === 'Query timeout after 10 seconds') {
        setError('Request timed out. Please check your internet connection and try again.');
      } else {
        setError(`Failed to load approval data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!approvalData || approvalLocked) return;

    console.log('Starting approval process for:', approvalData);
    setProcessing(true);
    setApprovalLocked(true); // Lock to prevent double-clicks

    try {
      console.log('Calling approval function with token:', token);

      // Create timeout promise (30 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      );

      // Create approval promise
      const approvalPromise = supabase.rpc('process_approval_token', {
        p_token: token
      });

      // Race between approval and timeout
      const { data, error } = await Promise.race([
        approvalPromise,
        timeoutPromise
      ]) as any;

      console.log('Approval function result:', { data, error });

      if (error) {
        console.error('Approval function error:', error);
        throw new Error(getUserFriendlyError(error.message));
      }

      if (!data?.success) {
        console.error('Approval function returned failure:', data);
        throw new Error(getUserFriendlyError(data?.error || 'Approval failed for unknown reason'));
      }

      console.log('Approval processed successfully');
      setApproved(true);

      // Send internal notification email (best-effort, non-blocking)
      try {
        const propertyAddress = [
          approvalData.job.property.address,
          approvalData.job.property.address_2,
          `${approvalData.job.property.city}, ${approvalData.job.property.state} ${approvalData.job.property.zip}`
        ].filter(Boolean).join(', ');

        await sendInternalApprovalNotification({
          decision: 'approved',
          jobId: approvalData.job_id,
          workOrderNum: approvalData.job.work_order_num,
          propertyName: approvalData.job.property.name,
          unitNumber: approvalData.job.unit_number,
          propertyAddress,
          extraChargesAmount: approvalData.extra_charges_data.total,
          approverName: approvalData.approver_name,
          approverEmail: approvalData.approver_email,
        });
      } catch (emailError) {
        console.warn('Failed to send internal notification email:', emailError);
        // Don't fail the approval if email fails
      }

      // Force refresh notifications in the main application
      // This will trigger a manual refresh to ensure notifications appear
      try {
        // Try to send a message to the parent window if this is opened in a new tab
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'APPROVAL_COMPLETED',
            jobId: approvalData.job_id,
            timestamp: Date.now()
          }, window.location.origin);
        }

        // Also dispatch a custom event
        window.dispatchEvent(new CustomEvent('approvalCompleted', {
          detail: { jobId: approvalData.job_id }
        }));
      } catch (e) {
        console.log('Could not notify parent window:', e);
      }
    } catch (err) {
      console.error('Error processing approval:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage === 'TIMEOUT'
        ? 'The approval request timed out. Please check your internet connection and try again.'
        : errorMessage
      );
      // Don't unlock on error - prevent retry that might cause issues
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!approvalData || approvalLocked) return;

    // Confirm decline action
    const confirmMessage = `Are you sure you want to decline these extra charges of $${approvalData.extra_charges_data.total.toFixed(2)}?\n\nThe job will remain in "Pending Work Order" status.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    console.log('Starting decline process for:', approvalData);
    setDeclining(true);
    setApprovalLocked(true); // Lock to prevent double-clicks

    try {
      console.log('Calling decline function with token:', token);

      // Create timeout promise (30 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      );

      // Create decline promise
      const declinePromise = supabase.rpc('process_decline_token', {
        p_token: token,
        p_decline_reason: null // Can be expanded later to capture user input
      });

      // Race between decline and timeout
      const { data, error } = await Promise.race([
        declinePromise,
        timeoutPromise
      ]) as any;

      console.log('Decline function result:', { data, error });

      if (error) {
        console.error('Decline function error:', error);
        throw new Error(getUserFriendlyError(error.message));
      }

      if (!data?.success) {
        console.error('Decline function returned failure:', data);
        throw new Error(getUserFriendlyError(data?.error || 'Decline failed for unknown reason'));
      }

      console.log('Decline processed successfully');
      setDeclined(true);

      // Send internal notification email (best-effort, non-blocking)
      try {
        const propertyAddress = [
          approvalData.job.property.address,
          approvalData.job.property.address_2,
          `${approvalData.job.property.city}, ${approvalData.job.property.state} ${approvalData.job.property.zip}`
        ].filter(Boolean).join(', ');

        await sendInternalApprovalNotification({
          decision: 'declined',
          jobId: approvalData.job_id,
          workOrderNum: approvalData.job.work_order_num,
          propertyName: approvalData.job.property.name,
          unitNumber: approvalData.job.unit_number,
          propertyAddress,
          extraChargesAmount: approvalData.extra_charges_data.total,
          approverName: approvalData.approver_name,
          approverEmail: approvalData.approver_email,
        });
      } catch (emailError) {
        console.warn('Failed to send internal notification email:', emailError);
        // Don't fail the decline if email fails
      }

      // Notify parent window if applicable
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'APPROVAL_DECLINED',
            jobId: approvalData.job_id,
            timestamp: Date.now()
          }, window.location.origin);
        }

        window.dispatchEvent(new CustomEvent('approvalDeclined', {
          detail: { jobId: approvalData.job_id }
        }));
      } catch (e) {
        console.log('Could not notify parent window:', e);
      }
    } catch (err) {
      console.error('Error processing decline:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage === 'TIMEOUT'
        ? 'The decline request timed out. Please check your internet connection and try again.'
        : errorMessage
      );
      // Don't unlock on error - prevent retry that might cause issues
    } finally {
      setDeclining(false);
    }
  };

  // Helper function to provide user-friendly error messages
  const getUserFriendlyError = (error: string): string => {
    if (error.includes('already been used')) {
      return 'This approval link has already been used. If you believe this is an error, please contact JG Painting Pros Inc.';
    }
    if (error.includes('expired')) {
      return 'This approval link has expired. Please request a new approval link from JG Painting Pros Inc.';
    }
    if (error.includes('not found') || error.includes('Invalid')) {
      return 'This approval link is invalid. Please verify the link or contact JG Painting Pros Inc.';
    }
    if (error.includes('configuration error') || error.includes('MISSING_PHASE')) {
      return 'A system configuration error occurred. Our team has been notified. Please contact JG Painting Pros Inc. for immediate assistance.';
    }
    if (error.includes('currently being processed')) {
      return 'This approval is already being processed. Please wait a moment and refresh the page.';
    }
    if (error.includes('deleted')) {
      return 'The associated job could not be found. Please contact JG Painting Pros Inc. for assistance.';
    }
    return `An unexpected error occurred: ${error}. Please contact JG Painting Pros Inc. for assistance.`;
  };

  const handleDownloadPDF = async () => {
    if (!approvalData) return;
    
    setDownloadingPDF(true);
    try {
      await generateApprovalPDF({
        job: approvalData.job,
        extraChargesData: approvalData.extra_charges_data,
        approverName: approvalData.approver_name,
        approverEmail: approvalData.approver_email,
        images: jobImages,
        supabaseUrl,
        approvedAt: approved ? new Date().toISOString() : undefined,
        status: approved ? 'approved' : 'pending'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading approval request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact JG Painting Pros Inc.
          </p>
        </div>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="max-w-lg mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-3xl font-bold text-green-600 mb-4">
            Extra Charges Approved!
          </h1>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              Job #{approvalData?.job.work_order_num.toString().padStart(6, '0')}
            </p>
            <p className="text-green-700">
              {approvalData?.job.property.name}
            </p>
            <p className="text-green-700 text-sm">
              Unit: {approvalData?.job.unit_number}
            </p>
          </div>
          <p className="text-gray-600 mb-4">
            Thank you for approving the extra charges of{' '}
            <span className="font-bold text-green-600">
              ${approvalData?.extra_charges_data.total.toFixed(2)}
            </span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            We will proceed with the work order phase immediately. You will receive updates as work progresses.
          </p>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors mb-6"
          >
            {downloadingPDF ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-2"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download Approval PDF
              </>
            )}
          </button>

          <div className="text-xs text-gray-400 border-t pt-4">
            Approved by: {approvalData?.approver_name || approvalData?.approver_email}<br/>
            Date: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-lg mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Extra Charges Declined
          </h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">
              Job #{approvalData?.job.work_order_num.toString().padStart(6, '0')}
            </p>
            <p className="text-red-700">
              {approvalData?.job.property.name}
            </p>
            <p className="text-red-700 text-sm">
              Unit: {approvalData?.job.unit_number}
            </p>
          </div>
          <p className="text-gray-600 mb-4">
            You have declined the extra charges of{' '}
            <span className="font-bold text-red-600">
              ${approvalData?.extra_charges_data.total.toFixed(2)}
            </span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            The job will remain in "Pending Work Order" status. Our team has been notified and will contact you to discuss alternative options.
          </p>

          <div className="text-xs text-gray-400 border-t pt-4">
            Declined by: {approvalData?.approver_name || approvalData?.approver_email}<br/>
            Date: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  if (!approvalData) return null;

  const isExpiringSoon = new Date(approvalData.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000; // 24 hours

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mb-4 shadow-lg">
              <span className="text-3xl">📋</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Extra Charges Approval
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Work Order #{approvalData.job.work_order_num.toString().padStart(6, '0')}
          </p>
          <p className="text-lg text-gray-500">
            {approvalData.job.property.name}
          </p>
          
          {/* Expiration Warning */}
          {isExpiringSoon && (
            <div className="mt-6 mx-auto max-w-2xl bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-4 shadow-md">
              <p className="text-red-800 font-semibold flex items-center justify-center">
                <span className="text-2xl mr-2">⏰</span>
                This approval link expires soon - please review and respond promptly
              </p>
            </div>
          )}
        </div>

        {/* Details Cards */}
        <ApprovalDetailsCard
          job={approvalData.job}
          extraChargesData={approvalData.extra_charges_data}
          approverName={approvalData.approver_name}
          approverEmail={approvalData.approver_email}
        />

        {/* Job Images Gallery */}
        {jobImages.length > 0 && (
          <ApprovalImageGallery images={jobImages} supabaseUrl={supabaseUrl} />
        )}

        {/* Action Buttons */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-lg">
          <div className="text-center">
            <div className="mb-6">
              <p className="text-gray-700 text-lg mb-3 font-medium">
                Review the information above carefully
              </p>
              <p className="text-gray-600 mb-2">
                By clicking "Approve Extra Charges" below, you authorize JG Painting Pros Inc. to proceed with the additional work and charges.
              </p>
              <p className="text-sm text-gray-500">
                Your approval will move the job to the Work Order phase and our team will begin work immediately.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4 justify-center items-center">
              {/* Download PDF Button */}
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium shadow-sm"
              >
                {downloadingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-2"></div>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Download PDF
                  </>
                )}
              </button>

              {/* Approve Button */}
              <button
                onClick={handleApproval}
                disabled={processing || declining}
                className={`inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-lg text-white transition-all shadow-lg ${
                  processing || declining
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:shadow-xl transform hover:scale-105'
                }`}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Processing Approval...
                  </>
                ) : (
                  <>
                    <span className="text-2xl mr-2">✅</span>
                    Approve Extra Charges - ${approvalData.extra_charges_data.total.toFixed(2)}
                  </>
                )}
              </button>

              {/* Decline Link - Subtle text link below */}
              <button
                onClick={handleDecline}
                disabled={processing || declining}
                className={`text-sm transition-colors ${
                  processing || declining
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-red-600 hover:underline'
                }`}
              >
                {declining ? (
                  <span className="inline-flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                    Processing decline...
                  </span>
                ) : (
                  'I decline to approve these charges at this time'
                )}
              </button>
            </div>

            {/* Footer Info */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Secure approval link • Expires: {new Date(approvalData.expires_at).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Questions? Contact JG Painting Pros Inc.
              </p>
            </div>
          </div>
        </div>

        {/* Company Footer */}
        <div className="text-center mt-8 pb-8">
          <div className="inline-block bg-white rounded-lg shadow px-6 py-4">
            <p className="text-sm font-semibold text-gray-700">JG Painting Pros Inc.</p>
            <p className="text-xs text-gray-500">Professional Painting Services</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalPage;
