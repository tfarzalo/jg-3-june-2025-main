import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false, // Allow fallback ports
    hmr: {
      overlay: true // Show errors in overlay for better debugging
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    // Development-friendly build settings
    sourcemap: true, // Enable sourcemaps for debugging
    minify: false, // Disable minification for faster builds
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui': ['lucide-react'],
          'utils': ['date-fns', 'date-fns-tz', 'papaparse'],
          'pdf': ['jspdf']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    target: 'esnext'
  },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      'lucide-react',
      'date-fns',
      'date-fns-tz',
      'papaparse',
      'jspdf'
    ]
  },
  // Ensure proper SPA fallback
  preview: {
    port: 4173,
    strictPort: false
  }
});