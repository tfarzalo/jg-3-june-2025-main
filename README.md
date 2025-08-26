# JG Portal 2.0

Professional painting business management system built with React, TypeScript, Vite, and Supabase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## 📊 Bundle Analysis

```bash
# Build with bundle analysis
npm run build:analyze

# Check bundle sizes
npm run size

# Serve production build locally for testing
npm run serve
```

## 🌐 Deployment

### Bolt Hosting (Default)
- Automatic deployment via git push
- SPA fallback configured in `public/_redirects`

### Netlify
- Uses `public/_redirects` for SPA fallback
- Automatic asset optimization and CDN

### Vercel
- Uses `vercel.json` for SPA routing
- Edge function support available

### Nginx
- Use the sample config in `nginx.conf.sample`
- Configure SPA fallback: `try_files $uri $uri/ /index.html;`

### Subpath Deployment
Set the `VITE_BASE_PATH` environment variable:

```bash
# For deployment under /app/
VITE_BASE_PATH="/app/"

# For root deployment (default)
VITE_BASE_PATH="/"
```

## 🛠️ Development

### Environment Variables
Copy `.env.example` to `.env` and configure:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BASE_PATH="/"
```

### Code Splitting
- Major pages are lazy-loaded for optimal performance
- Vendor dependencies are split into logical chunks
- Assets are optimized with compression

### Asset Optimization
- Store optimized images in `public/assets/optimized/`
- Prefer `.webp` or `.avif` formats for better compression
- Use `<OptimizedImg>` component for performance benefits

## 🐛 Troubleshooting 404 Errors

### Development 404s
1. Ensure dev server is running: `npm run dev`
2. Check console for JavaScript errors
3. Verify environment variables are loaded

### Production 404s
1. **Deep link routes**: Ensure SPA fallback is configured
   - Netlify: `public/_redirects` exists
   - Vercel: `vercel.json` exists  
   - Nginx: `try_files` directive configured

2. **Asset 404s**: Check base path configuration
   - Set `VITE_BASE_PATH` if deployed to subpath
   - Ensure assets are built to correct location

3. **Chunk 404s**: Clear browser cache and old service workers
   - Visit `/healthz` to check app status
   - Clear browser data and reload

### Network Tab Analysis
Open DevTools → Network tab and look for:
- Red 404 requests (missing assets/chunks)
- Failed route requests 
- CORS errors for API calls

## 🔧 Performance

### Bundle Size Targets
- Main bundle: < 500KB gzipped
- Vendor chunks: < 200KB each
- Initial page load: < 1MB total

### Optimization Features
- Tree shaking enabled
- Dead code elimination
- Gzip + Brotli compression
- Asset fingerprinting for cache busting
- Lazy route loading

## 📁 Project Structure

```
src/
├── components/        # Reusable UI components
├── contexts/         # React contexts (Auth, Theme)
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
├── pages/           # Page components (lazy loaded)
├── utils/           # Pure utility functions
└── main.tsx         # Application entry point
```

## 🔐 Authentication

- Supabase Auth integration
- Row Level Security (RLS) policies
- Role-based access control
- Session management with auto-refresh

## 📱 Features

- Dashboard with real-time updates
- Job management and tracking
- Property and contact management
- File upload and organization
- Calendar integration
- Multi-language support (EN/ES)
- Dark/Light theme support

## 🧪 Testing Deployment

Test all these routes directly in browser after deployment:

```
/                    # Home/Dashboard
/auth               # Login page
/dashboard          # Main dashboard
/dashboard/jobs     # Jobs list
/dashboard/properties # Properties
/healthz            # Health check
/non-existent-route # Should show NotFound page
```

All should load the app without 404 errors.