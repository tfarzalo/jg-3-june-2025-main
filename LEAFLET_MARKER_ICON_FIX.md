# Leaflet Map Marker Icon Fix

## Problem
Map markers were displaying as broken image placeholders instead of showing the actual pin icons. This affected all maps throughout the application including:
- Job Details page
- Property Details page
- Property Group Details page
- Property Edit Form
- Property Creation Form

## Root Cause
Leaflet's default marker icons use relative file paths that don't work correctly in bundled applications (Vite, Webpack, etc.). When the application is built, these paths break because the marker icon images aren't included in the bundle properly.

## Solution
Configured Leaflet to use CDN-hosted marker icons from unpkg.com. This ensures the icons are always available regardless of the build process.

### Implementation
Added the following code at the top of map-related files:

```typescript
// Fix Leaflet marker icon issue with bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
```

This code:
1. Removes the default `_getIconUrl` method that tries to use relative paths
2. Explicitly sets the icon URLs to CDN-hosted versions
3. Uses the same version (1.9.4) as the Leaflet library

## Files Modified

### 1. `/src/hooks/useLeafletMap.ts`
- Added marker icon configuration at the top of the file
- This hook is used by PropertyForm and PropertyEditForm

### 2. `/src/components/PropertyMap.tsx`
- Added marker icon configuration at the top of the file
- This component is used in:
  - JobDetails.tsx
  - PropertyDetails.tsx
  - PropertyGroupDetails.tsx

## Testing
After applying this fix, verify that:
1. ✅ Markers display correctly on Job Details page
2. ✅ Markers display correctly on Property Details page
3. ✅ Markers display correctly on Property Group Details page
4. ✅ Markers display correctly in Property Edit Form
5. ✅ Markers display correctly in Property Creation Form
6. ✅ Markers work in both light and dark themes
7. ✅ Marker shadows render properly
8. ✅ Retina displays show high-resolution icons

## Alternative Solutions Considered

### Local Asset Import
```typescript
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
```
**Rejected**: Requires additional Vite configuration and asset handling

### Custom Icons
```typescript
const customIcon = L.icon({
  iconUrl: '/path/to/custom/icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
```
**Rejected**: Would require creating and maintaining custom icons, unnecessary complexity

### Base64 Inline Icons
**Rejected**: Increases bundle size and reduces caching benefits

## Benefits of CDN Approach

1. **Simple**: No build configuration changes needed
2. **Reliable**: unpkg.com is a stable, well-maintained CDN
3. **Cached**: Icons cached by browser across page loads
4. **Version-Locked**: Using specific version (1.9.4) ensures consistency
5. **No Bundle Bloat**: Icons loaded externally, not in JS bundle
6. **Retina Support**: Automatic high-DPI display support

## Known Limitations

1. **Requires Internet**: Icons won't load offline (acceptable for web app)
2. **CDN Dependency**: Relies on unpkg.com availability (99.9%+ uptime)
3. **HTTPS Required**: CDN URLs use HTTPS (already required for app)

## Future Enhancements

If needed, we can:
1. Add custom colored markers for different states (e.g., red for urgent jobs)
2. Add marker clustering for pages with many properties
3. Add custom icons for different property/job types
4. Add animated markers for active jobs

## Related Components

- `useLeafletMap` hook
- `PropertyMap` component
- `JobDetails` component
- `PropertyDetails` component
- `PropertyGroupDetails` component
- `PropertyForm` component
- `PropertyEditForm` component

## References

- [Leaflet Icon Documentation](https://leafletjs.com/reference.html#icon)
- [Leaflet Default Icon Issue](https://github.com/Leaflet/Leaflet/issues/4968)
- [unpkg.com CDN](https://unpkg.com/)

## Version History

### v1.0.0 (November 13, 2025)
- Initial fix implementation
- Applied to all map components
- Tested across all pages with maps

---

**Issue**: Map markers showing as broken images
**Status**: ✅ Fixed
**Date**: November 13, 2025
**Impact**: All map displays application-wide
