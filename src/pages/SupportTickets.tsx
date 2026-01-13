import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Loader2, Send, CheckCircle, AlertCircle, Clock, Sparkles, Bug, Star, HelpCircle, MessageSquare, Upload, X, ArrowRight } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useUserRole } from '../hooks/useUserRole';
import { changelog, ChangelogEntry } from '../data/changelog';
import { useNavigate } from 'react-router-dom';

interface SupportTicketForm {
  fullName: string;
  email: string;
  ticketType: string;
  description: string;
  screenshot: File | null;
}

const ticketTypes = [
  { value: 'bug', label: 'Bug Found' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'help', label: 'Help Request' },
  { value: 'general', label: 'General Comment' }
];

export function SupportTickets() {
  const { user, role } = useUserRole();
  const navigate = useNavigate();
  // Use static changelog data (limit to 8 for sidebar)
  const recentChangelog = changelog.slice(0, 8);
  const [formData, setFormData] = useState<SupportTicketForm>({
    fullName: '',
    email: '',
    ticketType: '',
    description: '',
    screenshot: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string } | null>(null);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setUserProfile(data);
        }
      }
    };

    fetchUserProfile();
  }, [user?.id]);

  // Pre-fill form with user data
  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        fullName: userProfile.full_name || '',
        email: userProfile.email || user?.email || ''
      }));
    } else if (user?.email) {
      // At minimum, set the email from auth
      setFormData(prev => ({
        ...prev,
        email: user.email
      }));
    }
  }, [userProfile, user?.email]);

  const getChangelogIcon = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="h-5 w-5 text-blue-500" />;
      case 'fix':
        return <Bug className="h-5 w-5 text-red-500" />;
      case 'enhancement':
        return <Star className="h-5 w-5 text-purple-500" />;
      case 'update':
        return <Clock className="h-5 w-5 text-orange-500" />;
    }
  };

  const getChangelogTypeLabel = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'New Feature';
      case 'fix':
        return 'Bug Fix';
      case 'enhancement':
        return 'Enhancement';
      case 'update':
        return 'Update';
    }
  };

  const getBorderColor = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'border-blue-500';
      case 'fix':
        return 'border-red-500';
      case 'enhancement':
        return 'border-purple-500';
      case 'update':
        return 'border-orange-500';
    }
  };

  const getBadgeColor = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'fix':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'enhancement':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'update':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    }
  };

  const handleInputChange = (field: keyof SupportTicketForm, value: string | File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      // Check file type (images only)
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      setFormData(prev => ({ ...prev, screenshot: file }));
    }
  };

  const removeScreenshot = () => {
    setFormData(prev => ({ ...prev, screenshot: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.ticketType || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const userRole = role || 'No role provided';
      let screenshotUrl = '';

      // Upload screenshot if provided
      if (formData.screenshot) {
        const fileExt = formData.screenshot.name.split('.').pop();
        const fileName = `support-${Date.now()}.${fileExt}`;
        const filePath = `support-tickets/${fileName}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('files')
          .upload(filePath, formData.screenshot);

        if (uploadError) {
          console.error('Error uploading screenshot:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('files')
            .getPublicUrl(filePath);
          screenshotUrl = publicUrl;
        }
      }

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
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${formData.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: bold; color: #374151; border-right: 1px solid #e5e7eb;">Email:</td>
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${formData.email}</td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 12px 16px; font-weight: bold; color: #374151; border-right: 1px solid #e5e7eb;">Role:</td>
                  <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${userRole}</td>
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
            
            ${screenshotUrl ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin-bottom: 15px; font-size: 18px; font-weight: 600;">Screenshot</h3>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <a href="${screenshotUrl}" target="_blank" style="color: #2563eb; text-decoration: none;">View Screenshot</a>
                <div style="margin-top: 12px;">
                  <img src="${screenshotUrl}" alt="Screenshot" style="max-width: 100%; height: auto; border-radius: 4px;" />
                </div>
              </div>
            </div>
            ` : ''}
            
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
          subject: `Support Ticket: ${ticketTypes.find(t => t.value === formData.ticketType)?.label} - ${formData.fullName}`,
          html: emailContent,
          replyTo: formData.email
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
          subject: `Support Ticket: ${ticketTypes.find(t => t.value === formData.ticketType)?.label} - ${formData.fullName}`,
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
        if (user) {
          setFormData({
            fullName: user.full_name || '',
            email: user.email || '',
            ticketType: '',
            description: '',
            screenshot: null
          });
        }
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Support & Updates
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Submit a support ticket or view recent changes and improvements to the system.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Support Form */}
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
              {/* Full Name Field */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  required
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
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

              {/* Screenshot Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Screenshot (Optional)
                </label>
                {!formData.screenshot ? (
                  <div className="relative">
                    <input
                      type="file"
                      id="screenshot"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="screenshot"
                      className="flex items-center justify-center w-full h-32 px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border-2 border-dashed border-gray-300 dark:border-[#2D3B4E] rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors"
                    >
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Click to upload a screenshot
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="relative bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <img
                          src={URL.createObjectURL(formData.screenshot)}
                          alt="Screenshot preview"
                          className="h-20 w-20 object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {formData.screenshot.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(formData.screenshot.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="flex-shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Your ticket will be sent to our development and support team. If a response or update makes sense, we will reply as soon as possible.
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

          {/* Right Column - Changelog */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6 flex flex-col h-fit lg:sticky lg:top-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5" />
                Recent Updates
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Latest changes and improvements made to the system.
              </p>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-20rem)] pr-2 custom-scrollbar">
              {recentChangelog.map((entry, index) => (
                <div
                  key={index}
                  className={`border-l-4 ${getBorderColor(entry.type)} bg-gray-50 dark:bg-[#0F172A] rounded-r-lg p-4 hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getChangelogIcon(entry.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeColor(entry.type)}`}>
                          {getChangelogTypeLabel(entry.type)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.date}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        {entry.title}
                      </h3>
                      {entry.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* View Full Changelog Link */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#2D3B4E]">
              <button
                onClick={() => navigate('/dashboard/changelog')}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-2 px-4 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <span>View Full Changelog</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
