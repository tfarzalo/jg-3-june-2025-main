import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      // Expose env variables to the client
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
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
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
        }
      },
      sourcemap: mode === 'development',
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
  };
});