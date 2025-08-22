# Painting Business Management System

A comprehensive business management system built with React, TypeScript, and Supabase.

## Security Setup

**⚠️ IMPORTANT: Follow security setup before running the application**

1. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   Then update `.env` with your actual Supabase credentials (never commit real credentials).

2. **Database Setup**: 
   Before running database migrations, update admin credentials in SQL files.
   See [SECURITY.md](./SECURITY.md) for detailed instructions.

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

## Security

Please read [SECURITY.md](./SECURITY.md) for important security guidelines and best practices.
