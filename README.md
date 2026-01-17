# Paint Manager Pro

Professional painting business management system built with React, TypeScript, and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jg-3-june-2025-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   The `.env` file should contain:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   VITE_SUPABASE_JWT_SECRET=your-jwt-secret
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173/`

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Troubleshooting

### Application Not Loading?

If the application shows a white screen or doesn't load:

1. **Ensure `.env` file exists** in the root directory
2. **Verify environment variables** are set correctly
3. **Restart the dev server** after creating/modifying `.env`
4. **Check browser console** for error messages

See [APPLICATION_LOADING_ISSUE_RESOLVED.md](./APPLICATION_LOADING_ISSUE_RESOLVED.md) for detailed troubleshooting steps.

## 📚 Documentation

- [Application Loading Issue](./APPLICATION_LOADING_ISSUE_RESOLVED.md) - Setup and troubleshooting guide
- [White Screen Fixes](./WHITE_SCREEN_FIXED.md) - Production error handling
- [Documentation Index](./DOCUMENTATION_INDEX.md) - Complete documentation index

## 🏗️ Built With

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Supabase** - Backend and database
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **Lucide React** - Icons

## 📄 License

Private repository - All rights reserved.
