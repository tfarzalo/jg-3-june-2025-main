import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    sourcemap: false,
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
  server: {
    hmr: {
      overlay: false
    }
  }
});