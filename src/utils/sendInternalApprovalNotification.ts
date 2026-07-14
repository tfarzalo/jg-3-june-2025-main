import { supabase } from './supabase';

interface NotificationData {
  decision: 'approved' | 'declined';
  jobId: string;
  workOrderNum: number;
  propertyName: string;
  unitNumber: string;
  propertyAddress: string;
  extraChargesAmount: number;
  approverName?: string;
  approverEmail: string;
  declineReason?: string;
}

export async function sendInternalApprovalNotification(data: NotificationData): Promise<boolean> {
  try {
    console.log('Sending internal approval notification:', data);

    const { data: result, error: emailError } = await supabase.functions.invoke('send-internal-approval-notification', {
      body: data,
    });

    if (emailError) {
      console.error('Error sending internal notification email:', emailError);
      return false;
    }

    console.log('Internal notification email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Exception in sendInternalApprovalNotification:', error);
    return false;
  }
}
