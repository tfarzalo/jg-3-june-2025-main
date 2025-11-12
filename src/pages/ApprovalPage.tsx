import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';

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
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  console.log('ApprovalPage component mounted with token:', token);

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
      
      try {
        // First try the join approach
        const { data: tokenData, error: tokenError } = await supabase
          .from('approval_tokens')
          .select(`
            *,
            jobs!inner (
              id,
              work_order_num,
              unit_number,
              property_id,
              properties!inner (
                name,
                address,
                address_2,
                city,
                state,
                zip
              )
            )
          `)
          .eq('id', basicTokenData.id)
          .single();

        if (tokenError) {
          console.error('Join query failed, trying alternative approach:', tokenError);
          throw new Error('Join failed');
        }
        
        fullTokenData = tokenData;
        console.log('Join query successful:', tokenData);
        
      } catch (joinError) {
        console.log('Join approach failed, trying separate queries...');
        
        // Get job data separately
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('id, work_order_num, unit_number, property_id')
          .eq('id', basicTokenData.job_id)
          .single();
          
        if (jobError || !jobData) {
          console.error('Job query failed:', jobError);
          throw new Error('Could not fetch job data');
        }
        
        console.log('Job data fetched:', jobData);
        
        // Get property data separately
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('name, address, address_2, city, state, zip')
          .eq('id', jobData.property_id)
          .single();
          
        if (propertyError || !propertyData) {
          console.error('Property query failed with details:', {
            error: propertyError,
            code: propertyError?.code,
            message: propertyError?.message,
            details: propertyError?.details,
            hint: propertyError?.hint
          });
          
          // Try an alternative approach - get property data through a different method
          console.log('Trying alternative property data fetch...');
          
          // Instead of failing, let's use the basic token data which might have some property info
          if (basicTokenData.extra_charges_data?.job_details?.property) {
            console.log('Using property data from token:', basicTokenData.extra_charges_data.job_details.property);
            fullTokenData = {
              ...basicTokenData,
              job: {
                ...jobData,
                property: basicTokenData.extra_charges_data.job_details.property
              }
            };
          } else {
            // Continue with job data but no property data
            fullTokenData = {
              ...basicTokenData,
              job: {
                ...jobData,
                property: {
                  name: 'Property information not available',
                  address: 'Address not available',
                  city: 'Unknown City',
                  state: 'Unknown State',
                  zip: 'Unknown Zip'
                }
              }
            };
          }
        } else {
          console.log('Property data fetched:', propertyData);
          fullTokenData = {
            ...basicTokenData,
            job: {
              ...jobData,
              property: propertyData
            }
          };
        }
      }

      console.log('Final approval data:', fullTokenData);
      setApprovalData(fullTokenData as ApprovalData);
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
    if (!approvalData) return;
    
    console.log('Starting approval process for:', approvalData);
    setProcessing(true);
    
    try {
      console.log('Calling approval function with token:', token);
      
      // Call the database function to process the approval
      const { data, error } = await supabase.rpc('process_approval_token', {
        p_token: token
      });

      console.log('Approval function result:', { data, error });

      if (error) {
        console.error('Approval function error:', error);
        throw new Error(`Approval failed: ${error.message}`);
      }

      if (!data?.success) {
        console.error('Approval function returned failure:', data);
        throw new Error(data?.error || 'Approval failed for unknown reason');
      }

      console.log('Approval processed successfully');
      setApproved(true);
      
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
      setError(`Failed to process approval: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
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
          <div className="text-xs text-gray-400 border-t pt-4">
            Approved by: {approvalData?.approver_name || approvalData?.approver_email}<br/>
            Date: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  if (!approvalData) return null;

  const propertyAddress = `${approvalData.job.property.address}${
    approvalData.job.property.address_2 ? `, ${approvalData.job.property.address_2}` : ''
  }, ${approvalData.job.property.city}, ${approvalData.job.property.state} ${approvalData.job.property.zip}`;

  const isExpiringSoon = new Date(approvalData.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000; // 24 hours

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-2xl">📋</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Approve Extra Charges
          </h1>
          <p className="text-lg text-gray-600">
            Job #{approvalData.job.work_order_num.toString().padStart(6, '0')} - {approvalData.job.property.name}
          </p>
          {isExpiringSoon && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm">
                ⚠️ This approval link expires soon. Please review and approve as soon as possible.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Property Information */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Property Details</h2>
            <div className="space-y-1 text-sm text-gray-700">
              <p className="font-medium">{approvalData.job.property.name}</p>
              <p>{propertyAddress}</p>
              <p>Unit: {approvalData.job.unit_number}</p>
            </div>
          </div>

          {/* Extra Charges */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Extra Charges for Approval</h2>
            
            <div className="space-y-3 mb-6">
              {approvalData.extra_charges_data.items.map((charge, index) => (
                <div key={index} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{charge.description}</p>
                    {charge.hours && (
                      <p className="text-sm text-gray-600">Hours: {charge.hours}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${charge.cost.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-blue-900">Total Extra Charges:</span>
                <span className="text-2xl font-bold text-blue-900">
                  ${approvalData.extra_charges_data.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Approval Section */}
            <div className="text-center">
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  By clicking "Approve Extra Charges" below, you authorize JG Painting Pros Inc. to proceed with the additional work and charges listed above.
                </p>
                <p className="text-sm text-gray-500">
                  This approval will move the job to the Work Order phase and our team will be notified to proceed immediately.
                </p>
              </div>

              <button
                onClick={handleApproval}
                disabled={processing}
                className={`inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg text-white transition-colors ${
                  processing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-500 focus:ring-opacity-50'
                }`}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    ✅ Approve Extra Charges - ${approvalData.extra_charges_data.total.toFixed(2)}
                  </>
                )}
              </button>

              <div className="mt-6 text-xs text-gray-400 space-y-1">
                <p>Secure approval link • Expires: {new Date(approvalData.expires_at).toLocaleString()}</p>
                <p>For questions, contact JG Painting Pros Inc.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>JG Painting Pros Inc. - Professional Painting Services</p>
        </div>
      </div>
    </div>
  );
};

export default ApprovalPage;
