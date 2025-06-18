import { supabase } from '../utils/supabase';

interface GlobalState {
  lastUpdate: number;
  listeners: Set<() => void>;
}

class GlobalRefreshManager {
  private state: GlobalState = {
    lastUpdate: Date.now(),
    listeners: new Set()
  };
  
  addListener(callback: () => void): () => void {
    this.state.listeners.add(callback);
    return () => this.state.listeners.delete(callback);
  }
  
  private notifyListeners() {
    this.state.listeners.forEach(listener => listener());
  }
  
  forceRefresh() {
    const now = Date.now();
    this.state.lastUpdate = now;
    
    // Dispatch custom events for components to listen to
    window.dispatchEvent(new CustomEvent('globalRefresh', { 
      detail: { timestamp: now } 
    }));
    
    this.notifyListeners();
  }
  
  refreshJobs() {
    window.dispatchEvent(new CustomEvent('refreshJobs'));
    this.forceRefresh();
  }
  
  refreshNotifications() {
    window.dispatchEvent(new CustomEvent('refreshNotifications'));
    this.forceRefresh();
  }
  
  refreshAll() {
    window.dispatchEvent(new CustomEvent('refreshJobs'));
    window.dispatchEvent(new CustomEvent('refreshNotifications'));
    window.dispatchEvent(new CustomEvent('refreshJobData'));
    this.forceRefresh();
  }
}

const globalRefreshManager = new GlobalRefreshManager();

export const useGlobalRefresh = () => ({
  lastUpdate: globalRefreshManager['state'].lastUpdate,
  forceRefresh: () => globalRefreshManager.forceRefresh(),
  refreshJobs: () => globalRefreshManager.refreshJobs(),
  refreshNotifications: () => globalRefreshManager.refreshNotifications(),
  refreshAll: () => globalRefreshManager.refreshAll(),
  addListener: (callback: () => void) => globalRefreshManager.addListener(callback)
});

// Global function to trigger refresh from anywhere
export const triggerGlobalRefresh = () => {
  globalRefreshManager.refreshAll();
};

// Set up global real-time listeners
let globalSubscriptionsInitialized = false;

export const initializeGlobalSubscriptions = () => {
  if (globalSubscriptionsInitialized) return;
  
  console.log('Initializing global real-time subscriptions...');
  
  // Global subscription for critical changes
  const globalChannel = supabase
    .channel('global-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'job_phase_changes'
    }, (payload) => {
      console.log('Global: Job phase change detected:', payload);
      setTimeout(() => {
        triggerGlobalRefresh();
      }, 500);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'jobs'
    }, (payload) => {
      console.log('Global: Job updated:', payload);
      setTimeout(() => {
        globalRefreshManager.refreshJobs();
      }, 300);
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'user_notifications'
    }, (payload) => {
      console.log('Global: New notification:', payload);
      globalRefreshManager.refreshNotifications();
    })
    .subscribe();
    
  globalSubscriptionsInitialized = true;
  
  // Store reference for cleanup
  (window as any).__globalSubscription = globalChannel;
  
  console.log('Global subscriptions initialized');
};
