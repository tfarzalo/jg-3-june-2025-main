/**
 * Test Utilities for Property Contacts & Email Recipients
 * 
 * Use these functions to verify the email recipient logic is working correctly.
 */

import { getEmailRecipients } from './emailRecipientsAdapter';

/**
 * Test email recipients for a property
 * Logs detailed information about recipient configuration
 */
export async function testEmailRecipients(
  propertyId: string,
  mode: 'approval' | 'notification' = 'approval'
) {
  console.group(`🔍 Testing Email Recipients - ${mode.toUpperCase()}`);
  console.log('Property ID:', propertyId);
  
  try {
    const recipients = await getEmailRecipients(propertyId, mode, {
      fallbackToManager: true,
      additionalBcc: ['test-bcc@example.com']
    });

    console.log('\n📧 Recipient Results:');
    console.log('─'.repeat(50));
    
    if (recipients.to.length > 0) {
      console.log('✅ TO (Primary):', recipients.to);
      console.log('   Primary Name:', recipients.primaryRecipientName || 'N/A');
    } else {
      console.warn('⚠️ No TO recipients found');
    }
    
    if (recipients.cc.length > 0) {
      console.log('✅ CC (Others):', recipients.cc);
    } else {
      console.log('ℹ️ No CC recipients');
    }
    
    if (recipients.bcc.length > 0) {
      console.log('✅ BCC:', recipients.bcc);
    } else {
      console.log('ℹ️ No BCC recipients');
    }
    
    console.log('\n📊 Summary:');
    console.log('─'.repeat(50));
    console.log(`Total TO addresses: ${recipients.to.length}`);
    console.log(`Total CC addresses: ${recipients.cc.length}`);
    console.log(`Total BCC addresses: ${recipients.bcc.length}`);
    console.log(`Total recipients: ${recipients.to.length + recipients.cc.length + recipients.bcc.length}`);
    
    // Check for potential issues
    const allEmails = [...recipients.to, ...recipients.cc, ...recipients.bcc];
    const uniqueEmails = new Set(allEmails);
    
    if (allEmails.length !== uniqueEmails.size) {
      console.warn('⚠️ WARNING: Duplicate emails detected (should have been deduplicated)');
    } else {
      console.log('✅ No duplicate emails');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = allEmails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      console.error('❌ Invalid email formats detected:', invalidEmails);
    } else {
      console.log('✅ All emails are valid format');
    }
    
    console.groupEnd();
    return recipients;
    
  } catch (error) {
    console.error('❌ Error testing recipients:', error);
    console.groupEnd();
    throw error;
  }
}

/**
 * Compare recipients between approval and notification modes
 */
export async function compareRecipientModes(propertyId: string) {
  console.group('🔄 Comparing Approval vs Notification Recipients');
  
  const approval = await getEmailRecipients(propertyId, 'approval', { fallbackToManager: true });
  const notification = await getEmailRecipients(propertyId, 'notification', { fallbackToManager: true });
  
  console.log('\n📊 Comparison:');
  console.log('─'.repeat(50));
  console.table({
    'Approval TO': approval.to.join(', ') || 'None',
    'Approval CC': approval.cc.join(', ') || 'None',
    'Notification TO': notification.to.join(', ') || 'None',
    'Notification CC': notification.cc.join(', ') || 'None',
  });
  
  // Check for overlap
  const approvalSet = new Set([...approval.to, ...approval.cc]);
  const notificationSet = new Set([...notification.to, ...notification.cc]);
  const overlap = [...approvalSet].filter(email => notificationSet.has(email));
  
  if (overlap.length > 0) {
    console.log(`\n✅ ${overlap.length} recipient(s) configured for both modes:`, overlap);
  } else {
    console.log('\nℹ️ No overlap between approval and notification recipients');
  }
  
  console.groupEnd();
  
  return { approval, notification, overlap };
}

/**
 * Validate recipient configuration for a property
 * Returns issues found
 */
export async function validateRecipientConfiguration(propertyId: string) {
  const issues: string[] = [];
  
  console.group('🔍 Validating Recipient Configuration');
  
  try {
    // Test approval recipients
    const approval = await getEmailRecipients(propertyId, 'approval', { 
      fallbackToManager: false // Don't use fallback for validation
    });
    
    if (approval.to.length === 0) {
      issues.push('No approval recipients configured - approval emails will fail');
    }
    
    // Test notification recipients
    const notification = await getEmailRecipients(propertyId, 'notification', { 
      fallbackToManager: false 
    });
    
    if (notification.to.length === 0) {
      issues.push('No notification recipients configured - notification emails will fail');
    }
    
    // Check for common email issues
    const allEmails = [...approval.to, ...approval.cc, ...notification.to, ...notification.cc];
    
    // Check for @example.com or test emails
    const testEmails = allEmails.filter(email => 
      email.includes('@example.com') || 
      email.includes('@test.com') || 
      email.includes('test@')
    );
    
    if (testEmails.length > 0) {
      issues.push(`Test/example emails detected: ${testEmails.join(', ')}`);
    }
    
    // Check for personal emails (might want work emails)
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const personalEmails = allEmails.filter(email => 
      personalDomains.some(domain => email.toLowerCase().endsWith(`@${domain}`))
    );
    
    if (personalEmails.length > 0) {
      issues.push(`Personal email addresses detected: ${personalEmails.join(', ')}`);
    }
    
    console.log('\n📋 Validation Results:');
    console.log('─'.repeat(50));
    
    if (issues.length === 0) {
      console.log('✅ No issues found - configuration looks good!');
    } else {
      console.warn(`⚠️ Found ${issues.length} issue(s):`);
      issues.forEach((issue, idx) => {
        console.warn(`  ${idx + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    issues.push(`Error validating: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('❌ Validation error:', error);
  }
  
  console.groupEnd();
  return issues;
}

/**
 * Simulate sending an email (dry run - doesn't actually send)
 */
export async function simulateEmailSend(
  propertyId: string,
  mode: 'approval' | 'notification',
  subject: string = 'Test Email'
) {
  console.group('📨 Simulating Email Send');
  console.log('Property ID:', propertyId);
  console.log('Mode:', mode);
  console.log('Subject:', subject);
  
  try {
    const recipients = await getEmailRecipients(propertyId, mode, {
      fallbackToManager: true,
      additionalBcc: ['admin@company.com']
    });
    
    if (recipients.to.length === 0) {
      console.error('❌ Cannot send: No TO recipients');
      console.groupEnd();
      return false;
    }
    
    const emailPayload = {
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: subject,
      html: '<p>This is a test email body</p>',
      from: 'sender@company.com'
    };
    
    console.log('\n📧 Email Payload:');
    console.log('─'.repeat(50));
    console.log(JSON.stringify(emailPayload, null, 2));
    
    console.log('\n✅ Dry run successful - email would be sent with above configuration');
    console.log('💡 To actually send, use: supabase.functions.invoke("send-email", { body: emailPayload })');
    
    console.groupEnd();
    return true;
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    console.groupEnd();
    return false;
  }
}

/**
 * Batch test multiple properties
 */
export async function batchTestProperties(propertyIds: string[]) {
  console.group(`🔄 Batch Testing ${propertyIds.length} Properties`);
  
  const results = {
    passed: 0,
    failed: 0,
    issues: [] as Array<{ propertyId: string; issues: string[] }>
  };
  
  for (const propertyId of propertyIds) {
    console.log(`\nTesting property: ${propertyId}`);
    const issues = await validateRecipientConfiguration(propertyId);
    
    if (issues.length === 0) {
      results.passed++;
      console.log('✅ Passed');
    } else {
      results.failed++;
      results.issues.push({ propertyId, issues });
      console.warn('⚠️ Issues found');
    }
  }
  
  console.log('\n📊 Batch Test Summary:');
  console.log('─'.repeat(50));
  console.log(`✅ Passed: ${results.passed}/${propertyIds.length}`);
  console.log(`⚠️ Failed: ${results.failed}/${propertyIds.length}`);
  
  if (results.issues.length > 0) {
    console.log('\n⚠️ Properties with issues:');
    results.issues.forEach(({ propertyId, issues }) => {
      console.log(`\n  ${propertyId}:`);
      issues.forEach(issue => console.log(`    - ${issue}`));
    });
  }
  
  console.groupEnd();
  return results;
}

/**
 * Example usage in browser console:
 * 
 * // Test a single property
 * import { testEmailRecipients } from './lib/contacts/testUtils';
 * await testEmailRecipients('property-uuid-here', 'approval');
 * 
 * // Compare modes
 * import { compareRecipientModes } from './lib/contacts/testUtils';
 * await compareRecipientModes('property-uuid-here');
 * 
 * // Validate configuration
 * import { validateRecipientConfiguration } from './lib/contacts/testUtils';
 * await validateRecipientConfiguration('property-uuid-here');
 * 
 * // Simulate email send
 * import { simulateEmailSend } from './lib/contacts/testUtils';
 * await simulateEmailSend('property-uuid-here', 'approval', 'Test Approval Email');
 * 
 * // Batch test multiple properties
 * import { batchTestProperties } from './lib/contacts/testUtils';
 * await batchTestProperties(['uuid1', 'uuid2', 'uuid3']);
 */
