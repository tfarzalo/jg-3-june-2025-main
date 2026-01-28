# Mobile Navigation Structure

## 📱 Visual Structure Diagram

```
┌─────────────────────────────────────────┐
│  📱 MOBILE HEADER (Topbar)              │
│  ┌──┬───────────────────────┬──┬──┬──┐ │
│  │☰ │ Logo  JG Painting    │🌙│💬│👤│ │
│  └──┴───────────────────────┴──┴──┴──┘ │
└─────────────────────────────────────────┘
                │
                ├─ (Hamburger Menu)
                ├─ (Theme Toggle)
                ├─ (Chat Menu)
                ├─ (Notification Bell - Admin/Management only)
                └─ (User Dropdown)


┌─────────────────────────────────────────┐
│  📱 MOBILE MENU DRAWER (MobileNav)      │
│  ┌──────────────────────────────────┐  │
│  │  Logo  JG Painting          [X]  │  │
│  ├──────────────────────────────────┤  │
│  │                                  │  │
│  │  🔍 Search                       │  │
│  │                                  │  │
│  │  QUICK ACTIONS                   │  │
│  │  📅 Schedule                     │  │
│  │  ➕ New Job                      │  │
│  │  ➕ New Property                 │  │
│  │                                  │  │
│  │  ─────────────────────────────  │  │
│  │                                  │  │
│  │  DASHBOARD                       │  │
│  │  📊 Dashboard                    │  │
│  │                                  │  │
│  │  JOB MANAGEMENT                  │  │
│  │  📋 All Jobs                     │  │
│  │  📄 Job Requests                 │  │
│  │  📝 Work Orders                  │  │
│  │  ⏰ Pending Work Orders          │  │
│  │  💰 Invoicing                    │  │
│  │  ✓ Completed                     │  │
│  │  ✗ Cancelled                     │  │
│  │  📦 Archives                     │  │
│  │                                  │  │
│  │  PROPERTIES                      │  │
│  │  🏢 Properties                   │  │
│  │  🏢 Property Mgmt Groups         │  │
│  │                                  │  │
│  │  FILES                           │  │
│  │  📁 File Manager                 │  │
│  │                                  │  │
│  │  COMMUNICATION                   │  │
│  │  👥 Users                        │  │
│  │  💬 Messaging              [3]   │  │
│  │  👤 Contacts                     │  │
│  │                                  │  │
│  │  OTHER                           │  │
│  │  📅 Calendar                     │  │
│  │  📊 Activity Log                 │  │
│  │  ❓ Support                      │  │
│  │  ⚙️  Admin Settings              │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🎯 Navigation Hierarchy

### Admin / JG Management View

```
Mobile Menu (Drawer)
│
├── Quick Actions
│   ├── Search
│   ├── Schedule
│   ├── New Job
│   └── New Property
│
├── Dashboard
│   └── Dashboard (Home)
│
├── Job Management
│   ├── All Jobs
│   ├── Job Requests
│   ├── Work Orders
│   ├── Pending Work Orders
│   ├── Invoicing
│   ├── Completed
│   ├── Cancelled
│   └── Archives
│
├── Properties
│   ├── Properties
│   └── Property Mgmt Groups
│
├── Files
│   └── File Manager
│
├── Communication
│   ├── Users
│   ├── Messaging (with unread badge)
│   └── Contacts
│
└── Other
    ├── Calendar
    ├── Activity Log
    ├── Support
    └── Admin Settings
```

### Subcontractor View

```
Mobile Menu (Drawer)
│
└── Dashboard
    └── Dashboard (Home)
```

---

## 🎨 Visual States

### Closed State (Default)
```
┌──────────────────────────┐
│ ☰  Logo   🌙  💬  👤   │  ← Header Only
└──────────────────────────┘
```

### Open State (Menu Visible)
```
┌──────────────────────────┐
│ ☰  Logo   🌙  💬  👤   │  ← Header
└──────────────────────────┘

┌──────────────────────────┐
│ [ Backdrop Overlay ]     │
│                          │
│  ┌────────────────┐      │
│  │ Mobile Menu    │      │  ← Drawer (80% width)
│  │                │      │
│  │ [Navigation]   │      │
│  │                │      │
│  └────────────────┘      │
└──────────────────────────┘
```

---

## 📱 Component Breakdown

### 1. Topbar (Header)
```tsx
<header className="h-16 bg-white dark:bg-[#0F172A] border-b">
  <div className="flex items-center justify-between px-3 sm:px-4">
    
    {/* Left: Menu + Logo */}
    <div className="flex items-center space-x-2">
      <button className="lg:hidden">☰</button>  {/* Hamburger */}
      <img src="logo.png" />                    {/* Logo */}
    </div>
    
    {/* Right: Controls */}
    <div className="flex items-center space-x-2">
      <button>🌙</button>  {/* Theme Toggle */}
      <button>💬</button>  {/* Chat */}
      <button>🔔</button>  {/* Notifications (Admin only) */}
      <button>👤</button>  {/* User Dropdown */}
    </div>
    
  </div>
</header>
```

### 2. Mobile Menu Drawer
```tsx
<div className="fixed inset-0 z-50 lg:hidden">
  
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/50" onClick={close} />
  
  {/* Drawer */}
  <div className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white">
    
    {/* Header */}
    <div className="flex justify-between p-4 border-b">
      <img src="logo.png" />
      <button onClick={close}>X</button>
    </div>
    
    {/* Content (Scrollable) */}
    <div className="p-4 overflow-y-auto">
      <MobileNav onClose={close} />
    </div>
    
  </div>
  
</div>
```

### 3. MobileNav Component
```tsx
<nav className="space-y-6">
  
  {/* Section 1 */}
  <div className="space-y-1">
    <div className="text-xs uppercase text-gray-500">Dashboard</div>
    <NavLink to="/dashboard">
      <Icon /> Dashboard
    </NavLink>
  </div>
  
  {/* Section 2 */}
  <div className="space-y-1">
    <div className="text-xs uppercase text-gray-500">Job Management</div>
    <NavLink to="/dashboard/jobs">
      <Icon /> All Jobs
    </NavLink>
    {/* More links... */}
  </div>
  
  {/* More sections... */}
  
</nav>
```

---

## 🎯 Touch Target Sizing

### Minimum Sizes
```
Button:         44px × 44px
Link (in menu): 44px height (full width)
Icon button:    44px × 44px
User avatar:    32px (within 44px container)
Close button:   44px × 44px
```

### Spacing
```
Between buttons:     8px (space-x-2)
Between sections:    16px (space-y-4)
Padding (buttons):   12px horizontal, 12px vertical
Padding (container): 16px (p-4)
```

---

## 🎨 Color Coding

### Navigation Icons
```
Dashboard:           #276EF1 (Blue)
All Jobs:            #8A9BA8 (Gray-Blue)
Job Requests:        #276EF1 (Blue)
Work Orders:         #E95420 (Orange-Red)
Pending Work Orders: #FBBF24 (Amber)
Invoicing:           #00A878 (Green)
Completed:           #F47C7C (Pink)
Cancelled:           #6C6C6C (Gray)
Archives:            #5A5A5A (Dark Gray)
Properties:          #009688 (Teal)
File Manager:        #D64527 (Red-Orange)
Users:               #A0522D (Brown)
Messaging:           #1E40AF (Blue)
Calendar:            #E91E63 (Magenta)
Activity Log:        #3F51B5 (Indigo)
Contacts:            #7C3AED (Purple)
Support:             #F59E0B (Amber)
Admin Settings:      #9E9E9E (Gray)
```

---

## 🔄 Animation & Transitions

### Menu Open/Close
```css
/* Drawer */
transition: transform 300ms ease-in-out

/* Backdrop */
transition: opacity 200ms ease-in-out
```

### Active States
```css
/* Touch feedback */
transition: background-color 150ms ease

/* Scale feedback (optional) */
active:scale-95
```

---

## 📐 Responsive Breakpoints

```
Mobile:   < 640px   (Base styles, no prefix)
Tablet:   ≥ 640px   (sm:)
Desktop:  ≥ 1024px  (lg:)

Mobile menu visible:  < 1024px
Desktop sidebar:      ≥ 1024px
```

---

## 🎯 User Flow

### Opening Menu
```
1. User taps hamburger (☰)
   ↓
2. Backdrop fades in (200ms)
   ↓
3. Drawer slides in from left (300ms)
   ↓
4. Menu items visible and interactive
```

### Navigating
```
1. User taps menu item
   ↓
2. Menu closes (animation 300ms)
   ↓
3. Page navigation occurs
   ↓
4. New page loads
```

### Closing Menu
```
Method 1: Tap X button
Method 2: Tap backdrop
Method 3: Tap menu item (auto-close)
Method 4: Press Escape key

All methods trigger:
1. Drawer slides out (300ms)
2. Backdrop fades out (200ms)
3. Menu state reset
```

---

## 📊 Component States

### Drawer States
```typescript
type MenuState = 
  | 'closed'      // Default state
  | 'opening'     // Animation in progress
  | 'open'        // Fully open
  | 'closing'     // Animation in progress
```

### Navigation Item States
```typescript
type NavItemState = 
  | 'default'     // Not active, not hovered
  | 'active'      // Current page
  | 'pressed'     // Touch active state
```

---

## 🎨 Dark Mode

### Color Adjustments
```css
/* Light Mode */
Background: #FFFFFF
Text: #1F2937
Border: #E5E7EB

/* Dark Mode */
Background: #0F172A
Text: #F8FAFC
Border: #1E293B
```

### Icon Colors
Icons maintain their brand colors in both modes for consistency.

---

## ✅ Accessibility

### ARIA Labels
```tsx
<button aria-label="Open menu">☰</button>
<button aria-label="Close menu">X</button>
<nav aria-label="Main navigation">...</nav>
```

### Keyboard Navigation
```
Tab:      Move between interactive elements
Enter:    Activate button/link
Escape:   Close menu
```

### Screen Reader
```
Menu announces: "Navigation menu"
Items announce: "Dashboard, link"
State announces: "Current page: Dashboard"
```

---

## 🚀 Performance

### Optimization Techniques
1. **CSS Animations** - Hardware accelerated
2. **Lazy Loading** - Menu content loads on demand
3. **Event Delegation** - Single click handler
4. **Memoization** - Prevent unnecessary re-renders

### Load Time
```
Initial: 0ms (hidden by default)
Open:    ~50ms (component mount + animation)
Close:   ~300ms (animation)
```

---

**Diagram Version**: 1.0.0  
**Last Updated**: January 27, 2026  
**Status**: Production Ready
