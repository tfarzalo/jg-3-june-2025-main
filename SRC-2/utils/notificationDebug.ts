/**
 * Debug utility for testing notifications
 * Add this to your browser console to test notification functionality
 */

// Test function to manually create a notification
window.testCreateNotification = async function() {
  const { createClient } = supabase;
  const supabaseClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
  );

  try {
    const { data: user } = await supabaseClient.auth.getUser();
    if (!user.user) {
      console.error('No user logged in');
      return;
    }

    const { data, error } = await supabaseClient
      .from('user_notifications')
      .insert({
        user_id: user.user.id,
        title: 'Test Notification',
        message: 'This is a test notification created manually',
        type: 'approval',
        is_read: false,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error creating test notification:', error);
    } else {
      console.log('Test notification created:', data);
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('refreshNotifications'));
    }
  } catch (err) {
    console.error('Error:', err);
  }
};

// Test function to manually refresh notifications
window.testRefreshNotifications = function() {
  console.log('Manually triggering notification refresh...');
  window.dispatchEvent(new CustomEvent('refreshNotifications'));
  window.dispatchEvent(new CustomEvent('approvalCompleted'));
};

// Test function to check notification count
window.checkNotifications = async function() {
  const { createClient } = supabase;
  const supabaseClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
  );

  try {
    const { data: user } = await supabaseClient.auth.getUser();
    if (!user.user) {
      console.error('No user logged in');
      return;
    }

    const { data, error } = await supabaseClient
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      console.log('Recent notifications:', data);
      console.log('Unread notifications:', data.filter(n => !n.is_read).length);
    }
  } catch (err) {
    console.error('Error:', err);
  }
};

console.log('🔔 Notification Debug Tools Loaded!');
console.log('Available functions:');
console.log('- testCreateNotification() - Create a test notification');
console.log('- testRefreshNotifications() - Manually refresh notifications');
console.log('- checkNotifications() - Check current notifications in database');

export {};
