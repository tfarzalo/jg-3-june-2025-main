import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../components/ui/ThemeProvider';

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

  // Handle theme changes
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
      await geocodeAndSetMarker(address);

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
      await geocodeAndSetMarker(address);
      setError(null);
    } catch (err) {
      console.error('useLeafletMap: Error updating map location:', err);
      setError(err instanceof Error ? err.message : 'Failed to update map location');
    }
  };

  const geocodeAndSetMarker = async (address: string) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);

      if (isNaN(latNum) || isNaN(lonNum)) {
        throw new Error('Invalid coordinates');
      }
      
      // Ensure map is ready before setting view
      if (mapInstanceRef.current) {
        mapInstanceRef.current.whenReady(() => {
          if (!mapInstanceRef.current) return;
          mapInstanceRef.current.setView([latNum, lonNum], 15);

          // Update marker
          if (markerRef.current) {
            markerRef.current.remove();
          }

          // Create marker with explicit icon
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
    } else {
      throw new Error('Address not found');
    }
  };

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
