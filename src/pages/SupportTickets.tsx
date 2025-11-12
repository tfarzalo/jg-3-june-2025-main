import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface SupportTicketForm {
  name: string;
  ticketType: string;
  description: string;
}

const ticketTypes = [
  { value: 'bug', label: 'Bug Found' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'help', label: 'Help Request' },
  { value: 'general', label: 'General Comment' }
];

export function SupportTickets() {
  const [formData, setFormData] = useState<SupportTicketForm>({
    name: '',
    ticketType: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: keyof SupportTicketForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.ticketType || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare email content with all form field values
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              New Support Ticket
            </h2>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin-bottom: 15px; font-size: 18px; font-weight: 600;">Ticket Information</h3>
              <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 12px 16px; font-weight: bold; color: #374151; width: 140px; border-right: 1px solid #e5e7eb;">Name:</td>
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${formData.name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: bold; color: #374151; border-right: 1px solid #e5e7eb;">Ticket Type:</td>
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${ticketTypes.find(t => t.value === formData.ticketType)?.label}</td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 12px 16px; font-weight: bold; color: #374151; border-right: 1px solid #e5e7eb;">Submitted:</td>
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin-bottom: 15px; font-size: 18px; font-weight: 600;">Description</h3>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <p style="color: #111827; line-height: 1.6; margin: 0; white-space: pre-wrap;">${formData.description}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p style="margin: 0 0 8px 0;"><strong>Source:</strong> JG Painting Pros Portal Support System</p>
              <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> Please respond within 24-48 hours</p>
              <p style="margin: 0;"><strong>Next Steps:</strong> Review the ticket details and respond to the user</p>
            </div>
          </div>
        </div>
      `;

      // Send email using the existing send-email function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'design@thunderlightmedia.com',
          // Omit from so Edge Function uses ZOHO_EMAIL auth user
          subject: `Support Ticket: ${ticketTypes.find(t => t.value === formData.ticketType)?.label} - ${formData.name}`,
          html: emailContent,
          replyTo: 'admin@jgpaintingpros.com'
        }
      });

      if (error) {
        throw error;
      }

      // Log the support ticket
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          recipient_email: 'design@thunderlightmedia.com',
          subject: `Support Ticket: ${ticketTypes.find(t => t.value === formData.ticketType)?.label} - ${formData.name}`,
          template_type: 'support_ticket',
          sent_at: new Date().toISOString(),
          job_id: null
        });

      if (logError) {
        console.warn('Failed to log support ticket:', logError);
      }

      setIsSubmitted(true);
      toast.success('Support ticket submitted successfully!');
      
      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          name: '',
          ticketType: '',
          description: ''
        });
        setIsSubmitted(false);
      }, 3000);

    } catch (error) {
      console.error('Error submitting support ticket:', error);
      toast.error('Failed to submit support ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Ticket Submitted!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your support ticket has been sent successfully. We'll get back to you soon.
            </p>
            <Button 
              onClick={() => setIsSubmitted(false)}
              fullWidth
            >
              Submit Another Ticket
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Support Tickets
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Submit a support ticket or report a bug. We'll get back to you as soon as possible.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Send className="h-5 w-5" />
              Submit a Support Ticket
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Fill out the form below to submit your support request or bug report.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Name *
              </label>
              <input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="ticketType" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Ticket Type *
              </label>
              <select
                id="ticketType"
                value={formData.ticketType}
                onChange={(e) => handleInputChange('ticketType', e.target.value)}
                required
                className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="">Select ticket type</option>
                {ticketTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                placeholder="Please describe your issue, request, or comment in detail..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
                rows={6}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Be as specific as possible to help us understand and resolve your request quickly.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your ticket will be sent to our development team at design@thunderlightmedia.com. 
                    We typically respond within 24-48 hours.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              fullWidth
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Bug Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found a bug? Please include steps to reproduce the issue and any error messages you encountered.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Feature Requests</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Have an idea for a new feature? We'd love to hear about it and consider it for future updates.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Help Requests</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need help using a feature? Our team is here to assist you with any questions you may have.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">General Comments</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Have feedback or suggestions? We appreciate your input to help improve the platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
