# Deployment Guide

## Netlify Deployment

### 1. Environment Variables
Set these in your Netlify dashboard under **Site settings** → **Environment variables**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Build Settings
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Base directory:** `/`

### 3. Required Environment Variables
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### 4. Troubleshooting

#### Build Errors
- Ensure all environment variables are set
- Check Node.js version (18+ recommended)
- Verify npm dependencies are installed

#### Runtime Errors
- Check browser console for missing environment variables
- Verify Supabase credentials are correct
- Clear browser cache after deployment

### 5. Local Development
Create a `.env.local` file in your project root:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 6. Production Checklist
- [ ] Environment variables set in Netlify
- [ ] Build completes successfully
- [ ] No console errors in browser
- [ ] Authentication works
- [ ] Database connections successful
