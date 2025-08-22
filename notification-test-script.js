// 🔔 Notification Testing Script
// Copy and paste this into your browser console when testing

// Function to test manual notification refresh
function testNotificationRefresh() {
  console.log('🔄 Triggering manual notification refresh...');
  window.dispatchEvent(new CustomEvent('refreshNotifications'));
  window.dispatchEvent(new CustomEvent('approvalCompleted'));
  window.dispatchEvent(new CustomEvent('globalRefresh'));
  console.log('✅ Refresh events dispatched');
}

// Function to simulate approval completion
function simulateApprovalCompletion() {
  console.log('✅ Simulating approval completion...');
  window.dispatchEvent(new CustomEvent('approvalCompleted', {
    detail: { jobId: 'test-job-id' }
  }));
  
  // Also send a message like the approval page would
  window.postMessage({
    type: 'APPROVAL_COMPLETED',
    jobId: 'test-job-id',
    timestamp: Date.now()
  }, window.location.origin);
  
  console.log('✅ Approval completion events sent');
}

// Function to check if notification system is working
function checkNotificationSystem() {
  console.log('🔍 Checking notification system...');
  
  // Check if notification dropdown exists
  const bellIcon = document.querySelector('[data-testid="notification-bell"]') || 
                   document.querySelector('.relative .rounded-full') ||
                   document.querySelector('svg[data-lucide="bell"]')?.closest('button');
  
  if (bellIcon) {
    console.log('✅ Notification bell found');
    const badge = bellIcon.querySelector('.bg-red-500, .bg-red-600');
    if (badge) {
      console.log('🔔 Unread notification badge found:', badge.textContent);
    } else {
      console.log('⚪ No unread notification badge visible');
    }
  } else {
    console.log('❌ Notification bell not found');
  }
  
  // Check for notification events
  let eventCount = 0;
  const originalDispatch = window.dispatchEvent;
  window.dispatchEvent = function(event) {
    if (event.type.includes('refresh') || event.type.includes('notification')) {
      eventCount++;
      console.log(`📢 Event dispatched: ${event.type}`, event);
    }
    return originalDispatch.call(this, event);
  };
  
  setTimeout(() => {
    window.dispatchEvent = originalDispatch;
    console.log(`📊 Captured ${eventCount} notification-related events`);
  }, 5000);
}

// Available functions
console.log('🔔 NOTIFICATION TESTING TOOLS LOADED');
console.log('====================================');
console.log('Run these functions in the console:');
console.log('');
console.log('testNotificationRefresh() - Force refresh notifications');
console.log('simulateApprovalCompletion() - Simulate approval being completed');
console.log('checkNotificationSystem() - Check if notification UI is working');
console.log('');
console.log('📋 TESTING STEPS:');
console.log('1. Run checkNotificationSystem() to verify UI');
console.log('2. Open approval link in new tab');
console.log('3. Approve extra charges'); 
console.log('4. Return to main tab and run testNotificationRefresh()');
console.log('5. Check if notification bell shows unread count');
