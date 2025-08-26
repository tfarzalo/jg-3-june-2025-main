import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  return {
    plugins: [
      react(),
      // Bundle analyzer - generates stats.html after build
      isProd && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    
    // Base path for deployment - can be overridden with VITE_BASE_PATH env var
    base: env.VITE_BASE_PATH || '/',
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    
    define: {
      global: 'globalThis',
    },
    
    build: {
      // Development-friendly: sourcemaps for debugging
      // Production-optimized: no sourcemaps for smaller bundles
      sourcemap: !isProd,
      
      // Enable CSS code splitting for better caching
      cssCodeSplit: true,
      
      // Never inline assets - enables better CDN caching and reduces HTML size
      assetsInlineLimit: 0,
      
      // Increase warning limit to avoid noise during development
      chunkSizeWarningLimit: 750,
      
      // Optimized minification
      minify: isProd ? 'esbuild' : false,
      
      // Target modern browsers for smaller bundles
      target: isProd ? 'es2018' : 'esnext',
      
      rollupOptions: {
        output: {
          // Deterministic file names for better caching
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          
          // Manual chunk splitting for optimal loading
          manualChunks(id) {
            // Vendor chunks - split by category for better caching
            if (id.includes('node_modules')) {
              // React core - changes infrequently
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              
              // Router - moderate change frequency
              if (id.includes('react-router')) {
                return 'vendor-router';
              }
              
              // Supabase - API client, changes with API updates
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              
              // UI libraries - icons and components
              if (id.includes('lucide-react') || id.includes('sonner')) {
                return 'vendor-ui';
              }
              
              // Date utilities - rarely change
              if (id.includes('date-fns')) {
                return 'vendor-date';
              }
              
              // Everything else
              return 'vendor-misc';
            }
          },
        },
      },
    },
    
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false, // Allow fallback ports in development
      
      // HMR configuration for better development experience
      hmr: {
        overlay: true,
      },
    },
    
    // Preview server configuration (for testing production builds locally)
    preview: {
      port: 4173,
      host: '0.0.0.0',
      strictPort: false,
    },
    
    // Dependency optimization for faster development builds
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'lucide-react',
        'date-fns',
        'date-fns-tz',
      ],
    },
  };
});