import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from './ui/ThemeProvider';

// Fix Leaflet marker icon issue with bundlers
const fixLeafletIcon = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

fixLeafletIcon();

interface PropertyMapProps {
  address: string;
  className?: string;
}

export function PropertyMap({ address, className = '' }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { theme } = useTheme();
  // Track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const container = mapRef.current;
    if (!container || !address) return;

    // Initialize map
    // If map instance already exists, remove it to re-initialize (e.g. theme change)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(container, {
      center: [35.2271, -80.8431], // Default to Charlotte
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false, // Disable scroll wheel zoom by default
      dragging: false // Disable dragging by default
    });

    // Add zoom control
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    // Add tile layer
    const tileLayer = L.tileLayer(
      theme === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    ).addTo(map);

    mapInstanceRef.current = map;

    // Enable map interactions on click
    map.on('click', () => {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
    });

    // Disable map interactions when mouse leaves the map
    map.on('mouseout', () => {
      map.scrollWheelZoom.disable();
      map.dragging.disable();
    });

    // Geocode address with proper map initialization checks
    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
        );
        const data = await response.json();

        if (isMounted.current && data && data.length > 0) {
          const { lat, lon } = data[0];
          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);
          
          // Guard: only set view if map is fully initialized
          const map = mapInstanceRef.current;
          if (!isNaN(latNum) && !isNaN(lonNum) && map) {
            map.whenReady(() => {
              if (!mapInstanceRef.current) return;
              mapInstanceRef.current.setView([latNum, lonNum], 15);
              
              // Add marker
              if (markerRef.current) {
                markerRef.current.remove();
              }
              
              // Create marker with explicit icon options to ensure visibility in both modes
              const icon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              });

              markerRef.current = L.marker([latNum, lonNum], {
                icon: icon,
                title: address
              }).addTo(mapInstanceRef.current);
            });
          }
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      }
    };

    // Wait for map to be fully loaded before geocoding
    map.whenReady(() => {
      setTimeout(() => {
        if (isMounted.current) {
          geocodeAddress();
        }
      }, 100); // Small delay to ensure map is fully initialized
    });

    // Cleanup
    return () => {
      isMounted.current = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [address, theme]);

  return (
    <div 
      ref={mapRef} 
      className={`w-full h-[300px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ visibility: 'visible', display: 'block', zIndex: 0 }}
    />
  );
}
