// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { resolve } from "path";
import { visualizer } from "file:///home/project/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";
  return {
    plugins: [
      react(),
      // Bundle analyzer - generates stats.html after build
      isProd && visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean),
    // Base path for deployment - can be overridden with VITE_BASE_PATH env var
    base: env.VITE_BASE_PATH || "/",
    resolve: {
      alias: {
        "@": resolve(__vite_injected_original_dirname, "src")
      }
    },
    define: {
      global: "globalThis"
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
      minify: isProd ? "esbuild" : false,
      // Target modern browsers for smaller bundles
      target: isProd ? "es2018" : "esnext",
      rollupOptions: {
        output: {
          // Deterministic file names for better caching
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          // Manual chunk splitting for optimal loading
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
                return "vendor-react";
              }
              if (id.includes("react-router")) {
                return "vendor-router";
              }
              if (id.includes("@supabase")) {
                return "vendor-supabase";
              }
              if (id.includes("lucide-react") || id.includes("sonner")) {
                return "vendor-ui";
              }
              if (id.includes("date-fns")) {
                return "vendor-date";
              }
              return "vendor-misc";
            }
          }
        }
      }
    },
    server: {
      port: 5173,
      host: "0.0.0.0",
      strictPort: false,
      // Allow fallback ports in development
      // HMR configuration for better development experience
      hmr: {
        overlay: true
      }
    },
    // Preview server configuration (for testing production builds locally)
    preview: {
      port: 4173,
      host: "0.0.0.0",
      strictPort: false
    },
    // Dependency optimization for faster development builds
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@supabase/supabase-js",
        "lucide-react",
        "date-fns",
        "date-fns-tz"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcbiAgY29uc3QgaXNQcm9kID0gbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nO1xuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoKSxcbiAgICAgIC8vIEJ1bmRsZSBhbmFseXplciAtIGdlbmVyYXRlcyBzdGF0cy5odG1sIGFmdGVyIGJ1aWxkXG4gICAgICBpc1Byb2QgJiYgdmlzdWFsaXplcih7XG4gICAgICAgIGZpbGVuYW1lOiAnZGlzdC9zdGF0cy5odG1sJyxcbiAgICAgICAgb3BlbjogZmFsc2UsXG4gICAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgICBicm90bGlTaXplOiB0cnVlLFxuICAgICAgfSksXG4gICAgXS5maWx0ZXIoQm9vbGVhbiksXG4gICAgXG4gICAgLy8gQmFzZSBwYXRoIGZvciBkZXBsb3ltZW50IC0gY2FuIGJlIG92ZXJyaWRkZW4gd2l0aCBWSVRFX0JBU0VfUEFUSCBlbnYgdmFyXG4gICAgYmFzZTogZW52LlZJVEVfQkFTRV9QQVRIIHx8ICcvJyxcbiAgICBcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXG4gICAgICB9LFxuICAgIH0sXG4gICAgXG4gICAgZGVmaW5lOiB7XG4gICAgICBnbG9iYWw6ICdnbG9iYWxUaGlzJyxcbiAgICB9LFxuICAgIFxuICAgIGJ1aWxkOiB7XG4gICAgICAvLyBEZXZlbG9wbWVudC1mcmllbmRseTogc291cmNlbWFwcyBmb3IgZGVidWdnaW5nXG4gICAgICAvLyBQcm9kdWN0aW9uLW9wdGltaXplZDogbm8gc291cmNlbWFwcyBmb3Igc21hbGxlciBidW5kbGVzXG4gICAgICBzb3VyY2VtYXA6ICFpc1Byb2QsXG4gICAgICBcbiAgICAgIC8vIEVuYWJsZSBDU1MgY29kZSBzcGxpdHRpbmcgZm9yIGJldHRlciBjYWNoaW5nXG4gICAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXG4gICAgICBcbiAgICAgIC8vIE5ldmVyIGlubGluZSBhc3NldHMgLSBlbmFibGVzIGJldHRlciBDRE4gY2FjaGluZyBhbmQgcmVkdWNlcyBIVE1MIHNpemVcbiAgICAgIGFzc2V0c0lubGluZUxpbWl0OiAwLFxuICAgICAgXG4gICAgICAvLyBJbmNyZWFzZSB3YXJuaW5nIGxpbWl0IHRvIGF2b2lkIG5vaXNlIGR1cmluZyBkZXZlbG9wbWVudFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA3NTAsXG4gICAgICBcbiAgICAgIC8vIE9wdGltaXplZCBtaW5pZmljYXRpb25cbiAgICAgIG1pbmlmeTogaXNQcm9kID8gJ2VzYnVpbGQnIDogZmFsc2UsXG4gICAgICBcbiAgICAgIC8vIFRhcmdldCBtb2Rlcm4gYnJvd3NlcnMgZm9yIHNtYWxsZXIgYnVuZGxlc1xuICAgICAgdGFyZ2V0OiBpc1Byb2QgPyAnZXMyMDE4JyA6ICdlc25leHQnLFxuICAgICAgXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIC8vIERldGVybWluaXN0aWMgZmlsZSBuYW1lcyBmb3IgYmV0dGVyIGNhY2hpbmdcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgICBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBNYW51YWwgY2h1bmsgc3BsaXR0aW5nIGZvciBvcHRpbWFsIGxvYWRpbmdcbiAgICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICAgIC8vIFZlbmRvciBjaHVua3MgLSBzcGxpdCBieSBjYXRlZ29yeSBmb3IgYmV0dGVyIGNhY2hpbmdcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICAgICAgLy8gUmVhY3QgY29yZSAtIGNoYW5nZXMgaW5mcmVxdWVudGx5XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3NjaGVkdWxlcicpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcmVhY3QnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBSb3V0ZXIgLSBtb2RlcmF0ZSBjaGFuZ2UgZnJlcXVlbmN5XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3Qtcm91dGVyJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1yb3V0ZXInO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBTdXBhYmFzZSAtIEFQSSBjbGllbnQsIGNoYW5nZXMgd2l0aCBBUEkgdXBkYXRlc1xuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZScpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3Itc3VwYWJhc2UnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBVSSBsaWJyYXJpZXMgLSBpY29ucyBhbmQgY29tcG9uZW50c1xuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpIHx8IGlkLmluY2x1ZGVzKCdzb25uZXInKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXVpJztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gRGF0ZSB1dGlsaXRpZXMgLSByYXJlbHkgY2hhbmdlXG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZGF0ZS1mbnMnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWRhdGUnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBFdmVyeXRoaW5nIGVsc2VcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItbWlzYyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDUxNzMsXG4gICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICBzdHJpY3RQb3J0OiBmYWxzZSwgLy8gQWxsb3cgZmFsbGJhY2sgcG9ydHMgaW4gZGV2ZWxvcG1lbnRcbiAgICAgIFxuICAgICAgLy8gSE1SIGNvbmZpZ3VyYXRpb24gZm9yIGJldHRlciBkZXZlbG9wbWVudCBleHBlcmllbmNlXG4gICAgICBobXI6IHtcbiAgICAgICAgb3ZlcmxheTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBcbiAgICAvLyBQcmV2aWV3IHNlcnZlciBjb25maWd1cmF0aW9uIChmb3IgdGVzdGluZyBwcm9kdWN0aW9uIGJ1aWxkcyBsb2NhbGx5KVxuICAgIHByZXZpZXc6IHtcbiAgICAgIHBvcnQ6IDQxNzMsXG4gICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICB9LFxuICAgIFxuICAgIC8vIERlcGVuZGVuY3kgb3B0aW1pemF0aW9uIGZvciBmYXN0ZXIgZGV2ZWxvcG1lbnQgYnVpbGRzXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICBpbmNsdWRlOiBbXG4gICAgICAgICdyZWFjdCcsXG4gICAgICAgICdyZWFjdC1kb20nLFxuICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxuICAgICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICAgJ2RhdGUtZm5zJyxcbiAgICAgICAgJ2RhdGUtZm5zLXR6JyxcbiAgICAgIF0sXG4gICAgfSxcbiAgfTtcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxjQUFjLGVBQWU7QUFDL1AsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUgzQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxTQUFTLFNBQVM7QUFFeEIsU0FBTztBQUFBLElBQ0wsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBO0FBQUEsTUFFTixVQUFVLFdBQVc7QUFBQSxRQUNuQixVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixZQUFZO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBO0FBQUEsSUFHaEIsTUFBTSxJQUFJLGtCQUFrQjtBQUFBLElBRTVCLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDL0I7QUFBQSxJQUNGO0FBQUEsSUFFQSxRQUFRO0FBQUEsTUFDTixRQUFRO0FBQUEsSUFDVjtBQUFBLElBRUEsT0FBTztBQUFBO0FBQUE7QUFBQSxNQUdMLFdBQVcsQ0FBQztBQUFBO0FBQUEsTUFHWixjQUFjO0FBQUE7QUFBQSxNQUdkLG1CQUFtQjtBQUFBO0FBQUEsTUFHbkIsdUJBQXVCO0FBQUE7QUFBQSxNQUd2QixRQUFRLFNBQVMsWUFBWTtBQUFBO0FBQUEsTUFHN0IsUUFBUSxTQUFTLFdBQVc7QUFBQSxNQUU1QixlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUE7QUFBQSxVQUVOLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQjtBQUFBO0FBQUEsVUFHaEIsYUFBYSxJQUFJO0FBRWYsZ0JBQUksR0FBRyxTQUFTLGNBQWMsR0FBRztBQUUvQixrQkFBSSxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxXQUFXLEtBQUssR0FBRyxTQUFTLFdBQVcsR0FBRztBQUNoRix1QkFBTztBQUFBLGNBQ1Q7QUFHQSxrQkFBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLHVCQUFPO0FBQUEsY0FDVDtBQUdBLGtCQUFJLEdBQUcsU0FBUyxXQUFXLEdBQUc7QUFDNUIsdUJBQU87QUFBQSxjQUNUO0FBR0Esa0JBQUksR0FBRyxTQUFTLGNBQWMsS0FBSyxHQUFHLFNBQVMsUUFBUSxHQUFHO0FBQ3hELHVCQUFPO0FBQUEsY0FDVDtBQUdBLGtCQUFJLEdBQUcsU0FBUyxVQUFVLEdBQUc7QUFDM0IsdUJBQU87QUFBQSxjQUNUO0FBR0EscUJBQU87QUFBQSxZQUNUO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBRUEsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sWUFBWTtBQUFBO0FBQUE7QUFBQSxNQUdaLEtBQUs7QUFBQSxRQUNILFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFHQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixZQUFZO0FBQUEsSUFDZDtBQUFBO0FBQUEsSUFHQSxjQUFjO0FBQUEsTUFDWixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
