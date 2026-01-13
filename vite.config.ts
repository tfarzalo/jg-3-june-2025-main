import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
        react(),
        // Enable node polyfills for both dev and production
        // nodePolyfills({
        //     include: ['node_modules/**/*.js', new RegExp('node_modules/.vite/.*js')],
        //     exclude: ['node_modules/react/**/*', 'node_modules/react-dom/**/*']
        // })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // Force browser-compatible polyfills
        'events': resolve(__dirname, 'node_modules/events'),
        'util': resolve(__dirname, 'node_modules/util'),
        'stream': resolve(__dirname, 'node_modules/stream-browserify'),
        'http': resolve(__dirname, 'node_modules/http-browserify'),
        'url': resolve(__dirname, 'node_modules/url'),
        'process': resolve(__dirname, 'node_modules/process/browser'),
        'path': resolve(__dirname, 'node_modules/path-browserify'),
        'crypto': resolve(__dirname, 'node_modules/crypto-browserify'),
        'buffer': resolve(__dirname, 'node_modules/buffer'),
      },
    },
    define: {
      // Expose env variables to the client
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      // Polyfill process for browser compatibility if needed
      'process.env': env,
      'global': 'globalThis', // Fix for some libraries expecting global
    },
    build: {
      rollupOptions: {
        plugins: [
            // Enable node polyfills for rollup
            // nodePolyfills(),
            // Inject global variables to modules that expect them
            inject({
                Buffer: ['buffer', 'Buffer'],
                process: 'process',
            })
        ],
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
          drop_console: false, // Keep console logs for debugging in production
          drop_debugger: mode === 'production',
          // Only remove non-critical console methods, keep error and warn
          pure_funcs: mode === 'production' ? ['console.debug'] : []
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
