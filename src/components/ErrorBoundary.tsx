import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FallbackApp } from './FallbackApp';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Always log errors, even in production (for Netlify debugging)
    console.error('🚨 ErrorBoundary caught error:', error.name, error.message);
    console.error('Stack trace:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Store additional debugging info
    this.setState({
      error,
      errorInfo
    });
    
    // Report to console with environment info for debugging
    console.error('Environment info:', {
      NODE_ENV: import.meta.env.NODE_ENV,
      MODE: import.meta.env.MODE,
      PROD: import.meta.env.PROD,
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use the FallbackApp for better user experience
      return <FallbackApp />;
    }

    return this.props.children;
  }
}
