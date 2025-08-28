import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

console.log('🚀 Main.tsx: Starting application...');
console.log('Environment check:', {
  NODE_ENV: import.meta.env.NODE_ENV,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
});

const root = document.getElementById('root');

if (!root) {
  console.error('❌ Root element not found');
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
  throw error;
}