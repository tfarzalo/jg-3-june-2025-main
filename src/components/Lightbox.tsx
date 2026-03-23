import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, Download, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, RotateCcw,
} from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional title shown in the header (defaults to the alt text or a generic label) */
  title?: string;
  /** Single-image mode */
  imageUrl?: string;
  imageAlt?: string;
  /** Multi-image mode */
  images?: Array<{ url: string; alt?: string; label?: string }>;
  /** Index to start at (multi-image mode) */
  initialIndex?: number;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 4;

export function Lightbox({
  isOpen,
  onClose,
  title,
  imageUrl,
  imageAlt,
  images,
  initialIndex = 0,
}: LightboxProps) {
  const isMulti = images && images.length > 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Zoom / pan state
  const [zoom, setZoom]     = useState(1);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const isPanning           = useRef(false);
  const panStart            = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const imgContainerRef     = useRef<HTMLDivElement>(null);

  /** Reset zoom & pan whenever the visible image changes */
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Sync index when prop changes or lightbox re-opens
  useEffect(() => {
    setCurrentIndex(initialIndex);
    resetView();
  }, [initialIndex, isOpen, resetView]);

  // Reset view when currentIndex changes (navigating between images)
  useEffect(() => {
    resetView();
  }, [currentIndex, resetView]);

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    if (isMulti) setCurrentIndex((i) => (i + 1) % images.length);
  }, [isMulti, images]);

  const goPrev = useCallback(() => {
    if (isMulti) setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [isMulti, images]);

  /* ── Zoom helpers ── */
  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat((z + delta).toFixed(2)))));
  }, []);

  const zoomIn  = () => zoomBy(+ZOOM_STEP);
  const zoomOut = () => zoomBy(-ZOOM_STEP);
  const zoomFit = () => resetView();

  /* ── Keyboard ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      { onClose(); return; }
      if (e.key === 'ArrowRight')  { goNext(); return; }
      if (e.key === 'ArrowLeft')   { goPrev(); return; }
      if (e.key === '+'  || e.key === '=') { zoomIn();  return; }
      if (e.key === '-'  || e.key === '_') { zoomOut(); return; }
      if (e.key === '0')           { zoomFit(); return; }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, goNext, goPrev]);

  /* ── Mouse-wheel zoom ── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? +ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat((z + delta).toFixed(2)))));
  }, []);

  /* ── Drag-to-pan (only when zoomed in) ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    e.preventDefault();
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    });
  }, []);

  const stopPan = useCallback(() => { isPanning.current = false; }, []);

  if (!isOpen) return null;

  const activeUrl   = isMulti ? images[currentIndex]?.url   : (imageUrl  || '');
  const activeAlt   = isMulti ? (images[currentIndex]?.alt  || 'Image') : (imageAlt || 'Image');
  const activeLabel = isMulti ? (images[currentIndex]?.label || `Image ${currentIndex + 1} of ${images.length}`) : null;
  const headerTitle = title || (activeAlt && activeAlt !== 'Image' ? activeAlt : 'Photo Viewer');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = activeUrl;
    link.download = activeAlt || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const zoomPct = Math.round(zoom * 100);
  const isZoomed = zoom > 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop — clicking closes only when not zoomed/panning */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={!isZoomed ? onClose : undefined}
      />

      {/* ── Prev / Next arrows ── */}
      {isMulti && images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 z-[10001] p-3 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors shadow-lg"
            title="Previous (←)"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 z-[10001] p-3 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors shadow-lg"
            title="Next (→)"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      {/* ── Lightbox panel ── */}
      <div
        className="relative z-[10000] w-[92vw] max-w-6xl max-h-[94vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ZoomIn className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {headerTitle}
            {activeLabel && (
              <span className="font-normal text-gray-500 dark:text-gray-400">— {activeLabel}</span>
            )}
          </h3>

          {/* Zoom controls + actions */}
          <div className="flex items-center gap-1">
            {/* Zoom out */}
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
              title="Zoom out (−)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Zoom % badge — click to reset */}
            <button
              onClick={zoomFit}
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors min-w-[3.2rem] text-center ${
                zoom !== 1
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              title="Reset zoom (0)"
            >
              {zoomPct}%
            </button>

            {/* Zoom in */}
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Fit / reset */}
            {zoom !== 1 && (
              <button
                onClick={zoomFit}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Fit to window (0)"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Download image"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image viewport */}
        <div
          ref={imgContainerRef}
          className="flex-1 overflow-hidden flex items-center justify-center relative select-none"
          style={{
            minHeight: 0,
            cursor: isZoomed ? (isPanning.current ? 'grabbing' : 'grab') : 'default',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          <div
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
              transition: isPanning.current ? 'none' : 'transform 0.15s ease',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <img
              key={activeUrl}
              src={activeUrl}
              alt={activeAlt}
              draggable={false}
              className="max-w-[80vw] max-h-[65vh] object-contain rounded-lg shadow-lg block"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                (e.currentTarget.nextSibling as HTMLElement)?.classList.remove('hidden');
              }}
            />
            <div className="hidden absolute inset-0 items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
              <div className="text-center">
                <X className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="font-medium text-gray-500 dark:text-gray-400">Unable to load image</p>
              </div>
            </div>
          </div>

          {/* Zoom-level overlay pill (visible when zoomed) */}
          {zoom !== 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full pointer-events-none">
              <RotateCcw className="h-3 w-3 opacity-70" />
              <span className="font-mono">{zoomPct}% — press 0 or click % badge to reset</span>
            </div>
          )}
        </div>

        {/* Thumbnail strip (multi-image) */}
        {isMulti && images.length > 1 && (
          <div className="flex gap-2 px-4 py-2.5 overflow-x-auto flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? 'border-blue-500 shadow-md opacity-100'
                    : 'border-transparent hover:border-gray-400 opacity-55 hover:opacity-100'
                }`}
                title={img.label || `Image ${idx + 1}`}
              >
                <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            {[
              isMulti && images.length > 1 ? '← → navigate images' : null,
              'scroll or +/− to zoom',
              isZoomed ? 'drag to pan' : null,
              '0 to reset zoom',
              'Esc to close',
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </div>
  );
}
