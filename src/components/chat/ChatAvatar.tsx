import React, { useState } from 'react';

interface ChatAvatarProps {
  avatarUrl: string | null | undefined;
  initials: string;
  /** Tailwind size classes — default: "w-10 h-10" */
  size?: string;
  /** Tailwind text size class — default: "text-sm" */
  textSize?: string;
  className?: string;
  alt?: string;
}

/**
 * Renders a circular avatar.
 * - Shows the image when `avatarUrl` is provided and loads successfully.
 * - Falls back to an initials badge if `avatarUrl` is absent or fails to load.
 *   Uses React state (not DOM mutation) so it works reliably across re-renders.
 */
export function ChatAvatar({
  avatarUrl,
  initials,
  size = 'w-10 h-10',
  textSize = 'text-sm',
  className = '',
  alt = 'User',
}: ChatAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = !!avatarUrl && !imgError;

  const base = `${size} rounded-full flex-shrink-0 ${className}`;

  if (showImage) {
    return (
      <img
        src={avatarUrl!}
        alt={alt}
        className={`${base} object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${base} bg-blue-600 flex items-center justify-center text-white font-medium ${textSize}`}
    >
      {initials || '?'}
    </div>
  );
}
