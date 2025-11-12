import "./bootstrap/axios";

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { FallbackApp } from './components/FallbackApp';

// Enhanced logging for production debugging
console.log('🚀 Main.tsx: Starting application...');
console.log('Timestamp:', new Date().toISOString());
console.log('URL:', window.location.href);
console.log('Environment check:', {
  NODE_ENV: import.meta.env.NODE_ENV,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
  BASE_URL: import.meta.env.BASE_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? `SET (${import.meta.env.VITE_SUPABASE_URL.slice(0, 20)}...)` : 'MISSING',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? `SET (${import.meta.env.VITE_SUPABASE_ANON_KEY.slice(0, 20)}...)` : 'MISSING'
});

// Global error handler for unhandled promises and errors
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason);
  console.error('Promise rejection details:', event);
});

const root = document.getElementById('root');

if (!root) {
  console.error('❌ Root element not found - this is a critical error!');
  console.error('Document body:', document.body);
  console.error('Document HTML:', document.documentElement.outerHTML);
  throw new Error('Root element not found');
}

console.log('✅ Root element found, creating React root...');

try {
  const reactRoot = createRoot(root);
  console.log('✅ React root created, rendering app...');
  
  reactRoot.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Failed to render app:', error);
  console.error('Error details:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  
  // Fallback rendering if the main app fails
  try {
    console.log('🔄 Attempting fallback app render...');
    const reactRoot = createRoot(root);
    reactRoot.render(<FallbackApp />);
    console.log('✅ Fallback app rendered successfully');
  } catch (fallbackError) {
    console.error('❌ Even fallback app failed to render:', fallbackError);
    // Last resort: direct HTML injection
    root.innerHTML = `
      <div style="min-height: 100vh; background: #f3f4f6; display: flex; align-items: center; justify-content: center; padding: 1rem; font-family: system-ui;">
        <div style="max-width: 400px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎨</div>
          <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #1f2937;">Paint Manager Pro</h1>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">Critical loading error</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.75rem; margin-bottom: 1rem;">
            <p style="color: #dc2626; font-size: 0.875rem;">App failed to initialize. Check browser console for details.</p>
          </div>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}