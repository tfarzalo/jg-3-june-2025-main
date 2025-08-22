import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../components/ui/ThemeProvider';

interface UseLeafletMapProps {
  address?: string;
}

export function useLeafletMap({ address }: UseLeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const initTimeoutRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme } = useTheme();

  // Initialize map when container is ready
  useEffect(() => {
    const container = mapRef.current;
    if (!container || !address) return;

    // Clear any existing initialization timeout
    if (initTimeoutRef.current) {
      window.clearTimeout(initTimeoutRef.current);
    }

    // Set a timeout to ensure the container is fully rendered
    initTimeoutRef.current = window.setTimeout(() => {
      if (!isInitialized) {
        initializeMap(container, address);
      } else {
        updateMapLocation(address);
      }
    }, 100);

    return () => {
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
      }
    };
  }, [address, isInitialized]);

  const initializeMap = async (container: HTMLDivElement, address: string) => {
    try {
      console.log('useLeafletMap: Creating new map instance');
      
      // Remove existing map if it exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Create map instance
      const map = L.map(container, {
        center: [35.2271, -80.8431], // Default to Charlotte
        zoom: 13,
        zoomControl: false
      });

      // Add zoom control to top right
      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      // Add tile layer based on theme
      const tileLayer = L.tileLayer(
        theme === 'dark' 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      ).addTo(map);

      // Store map instance
      mapInstanceRef.current = map;

      // Geocode address
      console.log('useLeafletMap: Geocoding address:', address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        
        // Ensure map is ready before setting view
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 15);

          // Add marker
          if (markerRef.current) {
            markerRef.current.remove();
          }
          markerRef.current = L.marker([lat, lon]).addTo(mapInstanceRef.current);
        }
      } else {
        throw new Error('Address not found');
      }

      setIsInitialized(true);
      setError(null);
    } catch (err) {
      console.error('useLeafletMap: Error initializing map:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize map');
    }
  };

  const updateMapLocation = async (address: string) => {
    if (!mapInstanceRef.current) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        
        // Ensure map is ready before setting view
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 15);

          // Update marker
          if (markerRef.current) {
            markerRef.current.remove();
          }
          markerRef.current = L.marker([lat, lon]).addTo(mapInstanceRef.current);
        }
      } else {
        throw new Error('Address not found');
      }

      setError(null);
    } catch (err) {
      console.error('useLeafletMap: Error updating map location:', err);
      setError(err instanceof Error ? err.message : 'Failed to update map location');
    }
  };

  // Update tile layer when theme changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        layer.setUrl(
          theme === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        );
      }
    });
  }, [theme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  return { mapRef, error };
}