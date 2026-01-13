import React from 'react';

interface JobDetails {
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
}

interface ExtraChargesData {
  items: Array<{
    description: string;
    cost: number;
    hours?: number;
  }>;
  total: number;
  job_details?: any;
}

interface ApprovalDetailsCardProps {
  job: JobDetails;
  extraChargesData: ExtraChargesData;
  approverName?: string;
  approverEmail: string;
}

export function ApprovalDetailsCard({ 
  job, 
  extraChargesData, 
  approverName, 
  approverEmail 
}: ApprovalDetailsCardProps) {
  const propertyAddress = `${job.property.address}${
    job.property.address_2 ? `, ${job.property.address_2}` : ''
  }, ${job.property.city}, ${job.property.state} ${job.property.zip}`;

  return (
    <>
      {/* Property Information */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">🏢</span>
            Property Details
          </h2>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Property Name</p>
            <p className="text-base font-semibold text-gray-900">{job.property.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Address</p>
            <p className="text-base text-gray-700">{propertyAddress}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Unit Number</p>
            <p className="text-base text-gray-700">{job.unit_number}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Work Order Number</p>
            <p className="text-base font-mono text-blue-600">
              WO-{job.work_order_num.toString().padStart(6, '0')}
            </p>
          </div>
        </div>
      </div>

      {/* Extra Charges */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 px-6 py-4 border-b border-amber-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">💰</span>
            Extra Charges for Approval
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-4 mb-6">
            {extraChargesData.items.map((charge, index) => (
              <div 
                key={index} 
                className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-1 pr-4">
                  <p className="font-medium text-gray-900 mb-1">{charge.description}</p>
                  {charge.hours && (
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="mr-1">⏱️</span>
                      {charge.hours} hour{charge.hours !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-lg text-gray-900">
                    ${charge.cost.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 shadow-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-white">Total Extra Charges:</span>
              <span className="text-3xl font-bold text-white">
                ${extraChargesData.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Approver Info */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">👤</span>
            Approval Information
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Approver Name</p>
              <p className="text-base text-gray-900">{approverName || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
              <p className="text-base text-gray-700">{approverEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
