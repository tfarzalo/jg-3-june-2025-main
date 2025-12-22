import React, { useState } from 'react';
import { ApprovalLightbox } from './ApprovalLightbox';

interface JobImage {
  id: string;
  file_path: string;
  file_name: string;
  image_type: string;
  mime_type: string;
  public_url?: string;
}

interface ApprovalImageGalleryProps {
  images: JobImage[];
  supabaseUrl: string;
}

export function ApprovalImageGallery({ images, supabaseUrl }: ApprovalImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const imageUrls = images.map(img => 
    img.public_url || `${supabaseUrl}/storage/v1/object/public/job-images/${img.file_path}`
  );

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">📷</span>
          Job Photos ({images.length})
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {images.map((image, index) => {
            const imageUrl = image.public_url || `${supabaseUrl}/storage/v1/object/public/job-images/${image.file_path}`;
            
            return (
              <div
                key={image.id}
                className="relative group cursor-pointer overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all duration-200"
                onClick={() => handleImageClick(index)}
              >
                <div className="aspect-square relative">
                  <img
                    src={imageUrl}
                    alt={image.image_type || 'Job photo'}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200 flex items-center justify-center">
                    <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      <p className="text-sm font-medium">Click to enlarge</p>
                    </div>
                  </div>
                </div>
                
                {/* Image label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-sm font-medium truncate">
                    {image.image_type || 'Photo'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Click any image to view full size • {images.length} photo{images.length !== 1 ? 's' : ''} attached
        </p>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <ApprovalLightbox
          images={imageUrls}
          imageNames={images.map(img => img.image_type || img.file_name)}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}
    </>
  );
}
