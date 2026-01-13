import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApprovalDetailsCard } from '../components/approval/ApprovalDetailsCard';
import { ApprovalImageGallery } from '../components/approval/ApprovalImageGallery';
import { generateApprovalPDF } from '../utils/generateApprovalPDF';
import { Download, AlertCircle } from 'lucide-react';

interface PreviewData {
  job: any;
  extraChargesData: any;
  approverName?: string;
  approverEmail: string;
  jobImages: any[];
}

const ApprovalPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Force light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    
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

    return () => {
      const styleEl = document.getElementById('force-light-mode');
      if (styleEl) styleEl.remove();
    };
  }, []);

  useEffect(() => {
    // Load preview data from localStorage (not sessionStorage because it doesn't transfer to new windows)
    console.log('🔍 ApprovalPreviewPage: Loading preview data from localStorage...');
    const dataString = localStorage.getItem('approvalPreviewData');
    console.log('📦 Raw data string:', dataString ? `Found (${dataString.length} chars)` : 'Not found');
    
    if (dataString) {
      try {
        const data = JSON.parse(dataString);
        console.log('✅ Preview data parsed successfully');
        console.log('📸 Images in preview data:', data.jobImages?.length || 0);
        console.log('📸 Full image details:');
        if (data.jobImages && Array.isArray(data.jobImages)) {
          data.jobImages.forEach((img: any, index: number) => {
            console.log(`   Image ${index + 1}:`, {
              id: img.id,
              file_name: img.file_name,
              file_path: img.file_path,
              image_type: img.image_type
            });
          });
        } else {
          console.warn('⚠️ jobImages is not an array or is undefined:', data.jobImages);
        }
        setPreviewData(data);
        
        // Clean up after loading to avoid stale data
        // Wait a bit to ensure page is rendered
        setTimeout(() => {
          localStorage.removeItem('approvalPreviewData');
          console.log('🧹 Cleaned up preview data from localStorage');
        }, 1000);
      } catch (error) {
        console.error('❌ Error parsing preview data:', error);
      }
    } else {
      console.warn('⚠️ No preview data found in localStorage');
      console.log('This usually means:');
      console.log('1. You accessed this page directly (not from the modal button)');
      console.log('2. LocalStorage was cleared');
      console.log('3. The button did not store the data correctly');
    }
  }, []);

  const handleDownloadPDF = async () => {
    if (!previewData) return;
    
    setDownloadingPDF(true);
    try {
      await generateApprovalPDF({
        job: previewData.job,
        extraChargesData: previewData.extraChargesData,
        approverName: previewData.approverName,
        approverEmail: previewData.approverEmail,
        images: previewData.jobImages,
        supabaseUrl,
        status: 'pending'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (!previewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Preview Data</h1>
          <p className="text-gray-600 mb-4">
            This preview page needs to be opened from the notification modal.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-blue-900 mb-2">📋 How to use this feature:</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Open the notification modal for a job</li>
              <li>Go through Steps 1-3 (select template, recipient, images)</li>
              <li>On Step 3, click the purple "Preview Approval Page" button</li>
              <li>This page will open in a new tab with preview data</li>
            </ol>
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close Window
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Go to Dashboard
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>💡 Tip: Don't bookmark or directly access this URL</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Preview Banner */}
        <div className="bg-purple-600 text-white rounded-lg shadow-lg p-4 mb-6 text-center">
          <p className="font-bold text-lg mb-1">👁️ PREVIEW MODE</p>
          <p className="text-sm opacity-90">
            This is how the approval page will appear to the recipient
          </p>
        </div>

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
            Work Order #{previewData.job.work_order_num?.toString().padStart(6, '0')}
          </p>
          <p className="text-lg text-gray-500">
            {previewData.job.property?.name}
          </p>
          
          {/* Mock Expiration Warning */}
          <div className="mt-6 mx-auto max-w-2xl bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-4 shadow-md">
            <p className="text-red-800 font-semibold flex items-center justify-center">
              <span className="text-2xl mr-2">⏰</span>
              This approval link expires in 30 minutes - please review and respond promptly
            </p>
          </div>
        </div>

        {/* Details Cards */}
        <ApprovalDetailsCard
          job={previewData.job}
          extraChargesData={previewData.extraChargesData}
          approverName={previewData.approverName}
          approverEmail={previewData.approverEmail}
        />

        {/* Job Images Gallery */}
        {previewData.jobImages && previewData.jobImages.length > 0 && (
          <ApprovalImageGallery 
            images={previewData.jobImages.filter(img => img.selected)} 
            supabaseUrl={supabaseUrl} 
          />
        )}

        {/* Action Buttons Preview */}
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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

              {/* Approve Button (Disabled in Preview) */}
              <button
                disabled
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 opacity-75 cursor-not-allowed shadow-lg"
                title="This is a preview - the actual approval button will be functional"
              >
                <span className="text-2xl mr-2">✅</span>
                Approve Extra Charges - ${previewData.extraChargesData.total.toFixed(2)}
              </button>
            </div>

            {/* Footer Info */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Preview Mode • Actual link will expire 30 minutes after sending
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Questions? Contact JG Painting Pros Inc.
              </p>
            </div>
          </div>
        </div>

        {/* Close Preview Button */}
        <div className="text-center mt-8 pb-8">
          <button
            onClick={() => window.close()}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-lg"
          >
            Close Preview
          </button>
        </div>

        {/* Company Footer */}
        <div className="text-center mt-4 pb-8">
          <div className="inline-block bg-white rounded-lg shadow px-6 py-4">
            <p className="text-sm font-semibold text-gray-700">JG Painting Pros Inc.</p>
            <p className="text-xs text-gray-500">Professional Painting Services</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalPreviewPage;
