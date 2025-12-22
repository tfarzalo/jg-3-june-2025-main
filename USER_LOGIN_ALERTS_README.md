# User Login Alerts

## Overview
This feature provides real-time popover notifications to admin and JG management users when other users log into the system. The alerts automatically fade after 5 seconds and can be manually dismissed.

## Features

### 🔔 **Real-time Notifications**
- Instant alerts when users come online
- Only visible to admin and JG management users
- Automatic fade-out after 5 seconds
- Manual dismiss option with close button

### 🎨 **Visual Design**
- Clean, modern popover design positioned in top-right
- **Compact 2-3 row layout** for subtle but visible appearance
- **Enhanced rounded corners** (`rounded-2xl`) for modern look
- **Enhanced drop shadow** (`shadow-2xl`) for better readability
- **User avatar display** with fallback to icon if no avatar
- **Bold user name** in larger font (`text-base font-bold`)
- **User email** displayed below name in smaller text
- Role badges (Admin, JG Management, User, etc.)
- Progress bar showing auto-fade countdown
- Responsive layout with proper z-indexing
- Solid backgrounds with subtle borders for clarity

### 🚀 **Performance**
- Lightweight presence tracking
- Minimal database writes
- Efficient state management
- Automatic cleanup of dismissed alerts

## Components

### `UserLoginAlert`
Individual alert component that displays:
- User avatar icon
- User name and email
- User role badge
- Auto-fade progress bar
- Manual close button

### `UserLoginAlertManager`
Manager component that:
- Tracks online users via presence system
- Detects new user logins
- Manages multiple alerts
- Limits visible alerts to prevent clutter
- Handles alert lifecycle

## Technical Implementation

### **Presence Integration**
- Uses Supabase Realtime Presence channels
- Tracks user login events in real-time
- Integrates with existing `usePresence` hook
- Enhanced to include user role information

### **Role-based Access Control**
- Only admin and JG management users see alerts
- Uses existing `useUserRole` hook
- Respects application's permission system

### **State Management**
- React hooks for local state
- Efficient alert lifecycle management
- Automatic cleanup and memory management

## Usage

### **Automatic Operation**
The system works automatically once integrated:
1. Users log into the application
2. Presence system detects new online users
3. Alerts are automatically generated for admin/JG management users
4. Alerts fade out after 5 seconds or can be manually dismissed

### **Manual Integration**
If you need to manually trigger alerts:

```tsx
import { UserLoginAlert } from './components/UserLoginAlert';

<UserLoginAlert
  user={{
    id: 'user123',
    email: 'user@example.com',
    full_name: 'John Doe',
    role: 'user'
  }}
  onClose={() => console.log('Alert closed')}
/>
```

## Configuration

### **Alert Duration**
Default auto-fade time is 5 seconds. To modify:

```tsx
// In UserLoginAlert.tsx
useEffect(() => {
  const timer = setTimeout(() => {
    setIsVisible(false);
    setTimeout(onClose, 700); // Wait for fade animation to complete
  }, 5000); // Change this value
}, [onClose]);
```

### **Alert Position**
Alerts appear in the top-right corner by default. To modify:

```tsx
// In UserLoginAlert.tsx
<div className="fixed top-4 right-4 z-50">
  {/* Alert content */}
</div>
```

### **Maximum Alerts**
Default maximum visible alerts is 3. To modify:

```tsx
// In UserLoginAlertManager.tsx
const visibleAlerts = alerts.slice(-3); // Change this value
```

### **Animation System**
The alerts use a sophisticated animation system:

```tsx
// Entrance animation: 100ms delay + 700ms slide-in
const [isVisible, setIsVisible] = useState(false);

useEffect(() => {
  const entranceTimer = setTimeout(() => {
    setIsVisible(true);
  }, 100);
  return () => clearTimeout(entranceTimer);
}, []);

// Exit animation: 700ms slide-out + fade
className={`transform transition-all duration-700 ease-out ${
  isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
}`}
```

### **Smart Alert System**
The alerts use intelligent logic to prevent spam:

```tsx
// Only show alert once per login session
const alertedUsers = useRef<Set<string>>(new Set());

// 3-hour cooldown after user goes offline
const COOLDOWN_DURATION = 3 * 60 * 60 * 1000; // 3 hours

// Check if we should show alert for user
const shouldShowAlert = shouldShowAlertForUser(userId);
```

**Key Features:**
- **One alert per session**: Each user only triggers one alert per login
- **3-hour cooldown**: After a user goes offline, wait 3 hours before showing another alert
- **Session persistence**: Alerts are tracked across page refreshes
- **Smart detection**: Automatically detects when users come online/offline

### **Compact Design System**
The alerts use a streamlined 2-3 row layout for subtle visibility:

```tsx
// Compact container with enhanced rounded corners
<div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#2D3B4E] rounded-2xl shadow-2xl p-3 max-w-xs w-72">

// User avatar with fallback to icon
{user.avatar_url ? (
  <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-green-200" />
) : (
  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
    <User className="h-5 w-5 text-green-600" />
  </div>
)}

// Bold user name and email layout
<h4 className="text-base font-bold text-gray-900">{user.full_name}</h4>
<p className="text-sm text-gray-600">{user.email}</p>
```

**Design Features:**
- **Responsive width**: `min-w-80 max-w-md` adapts to content without text cutoff
- **Enhanced corners**: `rounded-2xl` for modern, polished look
- **User avatar**: Displays actual user avatar from profiles table with fallback to initials
- **Typography hierarchy**: Bold name, smaller email below with proper text wrapping
- **Efficient spacing**: Optimized padding and margins for 2-3 row layout
- **Smart fallbacks**: Graceful degradation when avatar fails to load

### **Avatar & Profile Integration**
The alerts now properly integrate with the user profile system:

```tsx
// Enhanced profile fetching in UserLoginAlertManager
const { data: profileData } = await supabase
  .from('profiles')
  .select('full_name, avatar_url')
  .eq('id', userId)
  .single();

// Avatar URL construction in UserLoginAlert
const getAvatarUrl = (avatarUrl: string | null): string | undefined => {
  if (!avatarUrl) return undefined;
  
  // Handle full URLs vs. filenames
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // Construct Supabase storage URL from filename
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
};
```

**Key Features:**
- **Real-time profile data**: Fetches fresh user information from profiles table
- **Avatar support**: Displays actual user profile pictures from Supabase storage
- **Smart URL handling**: Automatically constructs full URLs from filenames
- **Fallback system**: Shows user initials if avatar is unavailable or fails to load
- **Error handling**: Graceful degradation with console logging for debugging

## Styling

### **Tailwind Classes Used**
- `fixed top-4 right-4` - Top-right positioning
- `z-50` - High z-index for overlays
- `bg-white dark:bg-[#1E293B]` - Solid backgrounds for clarity
- `border border-gray-200 dark:border-[#2D3B4E]` - Subtle borders
- `rounded-2xl shadow-2xl` - Enhanced rounded corners and drop shadow
- `min-w-80 max-w-md` - Responsive width that adapts to content
- `text-base font-bold` - Bold, larger user name
- `text-sm` - Smaller email text below name
- `break-words` - Prevents text cutoff and wraps properly
- `transform transition-all duration-700 ease-out` - Smooth slide-in/fade-out animations

### **Customization**
The component uses standard Tailwind classes and can be easily customized by:
- Modifying the className props
- Updating the color schemes
- Adjusting spacing and sizing
- Changing animation durations

## Browser Support

### **Required Features**
- ES6+ JavaScript support
- CSS Grid and Flexbox
- CSS Transitions and Transforms
- Local Storage (for user preferences)

### **Fallbacks**
- Graceful degradation for older browsers
- CSS fallbacks for unsupported properties
- JavaScript error handling for edge cases

## Troubleshooting

### **Common Issues**

1. **Alerts not showing**
   - Check user role permissions
   - Verify presence system is working
   - Check browser console for errors

2. **Alerts not fading**
   - Verify useEffect cleanup
   - Check for JavaScript errors
   - Ensure component is unmounting properly

3. **Performance issues**
   - Limit maximum visible alerts
   - Implement alert throttling if needed
   - Monitor memory usage

### **Debug Mode**
Enable debug logging by adding console.log statements:

```tsx
useEffect(() => {
  console.log('Online users:', onlineUserIds);
  console.log('Current alerts:', alerts);
}, [onlineUserIds, alerts]);
```

## Future Enhancements

### **Potential Features**
- Sound notifications
- Email/SMS alerts for critical users
- Alert history and analytics
- Customizable alert templates
- User preference settings
- Alert scheduling and snoozing

### **Integration Opportunities**
- Slack/Discord webhooks
- Email notification system
- Audit logging system
- User activity dashboard

## Security Considerations

### **Data Privacy**
- Only user role and basic info shown
- No sensitive data exposed
- Respects existing RLS policies

### **Access Control**
- Role-based visibility
- No unauthorized access to user data
- Integrates with existing auth system

## Performance Metrics

### **Expected Performance**
- Alert generation: < 100ms
- Animation smoothness: 60fps
- Memory usage: < 1MB per alert
- CPU impact: < 1% during normal operation

### **Monitoring**
- Track alert generation frequency
- Monitor memory usage
- Measure user interaction rates
- Alert dismissal patterns

## Testing

### **Manual Testing**
1. Login as different user types
2. Verify admin/JG management see alerts
3. Test alert dismissal
4. Verify auto-fade functionality
5. Test multiple simultaneous alerts

### **Automated Testing**
```tsx
// Example test structure
describe('UserLoginAlert', () => {
  it('should show for admin users', () => {
    // Test implementation
  });
  
  it('should auto-fade after 5 seconds', () => {
    // Test implementation
  });
  
  it('should be dismissible', () => {
    // Test implementation
  });
});
```

## Dependencies

### **Required Packages**
- `react` - Core React functionality
- `lucide-react` - Icons (User, X)
- `@supabase/supabase-js` - Presence system

### **Internal Dependencies**
- `usePresence` hook
- `useUserRole` hook
- Presence management system

## Changelog

### **v1.0.0** - Initial Release
- Basic alert functionality
- Role-based visibility
- Auto-fade and manual dismiss
- Integration with presence system
- Responsive design with dark mode support
