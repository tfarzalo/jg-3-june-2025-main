import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from './ui/ThemeProvider';

interface PropertyMapProps {
  address: string;
  className?: string;
}

export function PropertyMap({ address, className = '' }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = mapRef.current;
    if (!container || !address) return;

    // Initialize map
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

    // Geocode address
    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.setView([lat, lon], 15);

          // Add marker
          if (markerRef.current) {
            markerRef.current.remove();
          }
          markerRef.current = L.marker([lat, lon]).addTo(map);
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      }
    };

    geocodeAddress();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [address, theme]);

  return (
    <div 
      ref={mapRef} 
      className={`w-full h-[300px] rounded-lg overflow-hidden ${className}`}
      style={{ visibility: 'visible', display: 'block' }}
    />
  );
} 