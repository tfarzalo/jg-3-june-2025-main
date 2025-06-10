import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTheme } from '../components/ui/ThemeProvider';

interface UseGoogleMapsProps {
  apiKey: string;
  address: string;
}

export function useGoogleMaps({ apiKey, address }: UseGoogleMapsProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  
  // Track initialization state
  const isInitializedRef = useRef(false);
  const loaderRef = useRef<Loader | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  // Initialize the loader once
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key is missing');
      return;
    }

    if (!loaderRef.current) {
      loaderRef.current = new Loader({
        apiKey,
        version: "weekly"
      });
    }

    return () => {
      // Clean up marker on unmount
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, [apiKey]);

  // Handle map creation and updates
  useEffect(() => {
    // Skip if no map container, API key, or address
    if (!mapRef.current || !apiKey || !address) {
      return;
    }

    let isMounted = true;

    const initializeMap = async () => {
      try {
        // Load Google Maps API
        if (!window.google || !window.google.maps) {
          await loaderRef.current?.load();
        }

        // Create geocoder if needed
        if (!geocoderRef.current && window.google?.maps) {
          geocoderRef.current = new google.maps.Geocoder();
        }

        // Skip if component unmounted during async operations
        if (!isMounted || !geocoderRef.current) return;

        // Geocode the address
        geocoderRef.current.geocode({ address }, (results, status) => {
          if (!isMounted) return;

          if (status !== 'OK' || !results || !results[0]) {
            setError(`Geocoding failed: ${status}`);
            return;
          }

          const location = results[0].geometry.location;

          // Clear previous marker
          if (markerRef.current) {
            markerRef.current.setMap(null);
            markerRef.current = null;
          }

          // Create new map
          const mapOptions: google.maps.MapOptions = {
            center: location,
            zoom: 15,
            styles: theme === 'dark' ? darkModeMapStyles : lightModeMapStyles,
            disableDefaultUI: true,
            zoomControl: false,
            scrollwheel: false,
            gestureHandling: 'none',
            draggable: false,
            clickableIcons: false,
            keyboardShortcuts: false
          };

          // Create map instance
          const newMap = new google.maps.Map(mapRef.current!, mapOptions);

          // Create marker
          markerRef.current = new google.maps.Marker({
            position: location,
            map: newMap,
            animation: google.maps.Animation.DROP
          });

          // Update state
          setMap(newMap);
          setError(null);
          isInitializedRef.current = true;
        });
      } catch (err) {
        if (isMounted) {
          console.error('Google Maps error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load map');
        }
      }
    };

    // Initialize or reinitialize map
    initializeMap();

    return () => {
      isMounted = false;
    };
  }, [apiKey, address, theme]);

  return { mapRef, map, error };
}

// Light mode map styles
const lightModeMapStyles = [
  {
    "featureType": "administrative",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#444444" }]
  },
  {
    "featureType": "landscape",
    "elementType": "all",
    "stylers": [{ "color": "#f2f2f2" }]
  },
  {
    "featureType": "poi",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "road",
    "elementType": "all",
    "stylers": [{ "saturation": -100 }, { "lightness": 45 }]
  },
  {
    "featureType": "road.highway",
    "elementType": "all",
    "stylers": [{ "visibility": "simplified" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "all",
    "stylers": [{ "color": "#c4e5f9" }, { "visibility": "on" }]
  }
];

// Dark mode map styles
const darkModeMapStyles = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#1E293B" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1E293B" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#263c3f" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6b9a76" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#38414e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#212a37" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9ca5b3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1f2835" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#f3d19c" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#17263c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#17263c" }]
  }
];