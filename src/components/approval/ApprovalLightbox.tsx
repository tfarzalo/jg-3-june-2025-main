import React from 'react';
import { Lightbox } from '../Lightbox';

interface ApprovalLightboxProps {
  images: string[];
  imageNames: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ApprovalLightbox({
  images,
  imageNames,
  currentIndex,
  onClose,
  onNavigate,
}: ApprovalLightboxProps) {
  const mappedImages = images.map((url, i) => ({
    url,
    alt: imageNames[i] || `Photo ${i + 1}`,
    label: imageNames[i] || `Photo ${i + 1}`,
  }));

  return (
    <Lightbox
      isOpen={true}
      onClose={onClose}
      title="Job Photos"
      images={mappedImages}
      initialIndex={currentIndex}
    />
  );
}
