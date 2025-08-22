import React, { useState } from 'react';
import { Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { sendEmail } from '../lib/email';

export function EmailTest() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Test Email from JG Painting Pros',
    text: 'This is a test email from the JG Painting Pros portal.',
    html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #2563eb;">Test Email</h2><p>This is a test email from the JG Painting Pros portal.</p><p>If you received this email, the email functionality is working correctly.</p><p>Thank you,<br>JG Painting Pros Team</p></div>'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await sendEmail(formData);
      
      if (result.success) {
        setSuccess(true);
        setFormData(prev => ({ ...prev, to: '' }));
      } else {
        setError(result.error || 'Failed to send email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Send className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Email Test</h1>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Send Test Email</h2>
          
          {success && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-500" />
              <div>
                <p className="font-medium">Email sent successfully!</p>
                <p className="mt-1 text-sm">The test email was sent successfully. Please check the recipient's inbox.</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium">Failed to send email</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Recipient Email
              </label>
              <input
                type="email"
                id="to"
                name="to"
                required
                value={formData.to}
                onChange={handleChange}
                className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter recipient email"
              />
            </div>
            
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email subject"
              />
            </div>
            
            <div>
              <label htmlFor="text" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Plain Text Content
              </label>
              <textarea
                id="text"
                name="text"
                rows={3}
                value={formData.text}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter plain text content"
              />
            </div>
            
            <div>
              <label htmlFor="html" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                HTML Content
              </label>
              <textarea
                id="html"
                name="html"
                rows={6}
                value={formData.html}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Enter HTML content"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        <div className="mt-6 bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Email Provider</h3>
              <p className="text-gray-600 dark:text-gray-400">Resend</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">From Address</h3>
              <p className="text-gray-600 dark:text-gray-400">no-reply@jgpaintingprosinc.com</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Reply-To Address</h3>
              <p className="text-gray-600 dark:text-gray-400">info@jgpaintingprosinc.com</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Delivery Method</h3>
              <p className="text-gray-600 dark:text-gray-400">Supabase Edge Function with Resend API</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailTest;