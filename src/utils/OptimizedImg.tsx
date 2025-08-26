import React from 'react';

interface OptimizedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  w?: number;
  h?: number;
  fallback?: string;
}

/**
 * Optimized image component with lazy loading and performance best practices
 * 
 * Features:
 * - Lazy loading for better performance
 * - Async decoding to prevent render blocking
 * - Explicit width/height to prevent CLS (Cumulative Layout Shift)
 * - Error handling with fallback
 * 
 * Usage:
 * <OptimizedImg 
 *   src="/assets/hero.webp" 
 *   alt="Hero image"
 *   w={800} 
 *   h={600}
 *   fallback="/assets/hero.jpg"
 * />
 */
export function OptimizedImg({ 
  w, 
  h, 
  fallback, 
  onError,
  className = '',
  ...rest 
}: OptimizedImgProps) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    }
    onError?.(e);
  };

  return (
    <img
      loading="lazy"
      decoding="async"
      width={w}
      height={h}
      onError={handleError}
      className={`${className} max-w-full h-auto`}
      {...rest}
    />
  );
}

export default OptimizedImg;