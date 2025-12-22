# Property Details Component - Comprehensive Style Guide

## Overview
The PropertyDetails component is a comprehensive, multi-section property management interface that follows a consistent design system with responsive grid layouts, consistent spacing, and a cohesive visual hierarchy. This style guide documents all design patterns, layout rules, and styling conventions for maintaining consistency across similar components.

## Layout System

### Grid Layout Rules
- **Primary Container**: `p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen`
- **Section Spacing**: `space-y-8` between major sections
- **Responsive Grids**: 
  - Top row: `grid-cols-1 xl:grid-cols-4` (4-column layout on extra-large screens)
  - Second row: `grid-cols-1 lg:grid-cols-3` (3-column layout on large screens)
  - Fourth row: `grid-cols-1 lg:grid-cols-2` (2-column layout on large screens)
  - Full-width sections: Single column spanning entire width

### Section Dimensions
- **Map Section**: `xl:col-span-2` (2/4 width on extra-large screens)
- **Info Sections**: `xl:col-span-1` (1/4 width on extra-large screens)
- **Standard Card Height**: Minimum height varies by content type
- **Map Height**: `h-72 xl:h-80` (responsive height: 288px on mobile, 320px on xl)

## Color System

### Background Colors
- **Page Background**: `bg-gray-100 dark:bg-[#0F172A]`
- **Card Backgrounds**: `bg-white dark:bg-[#1E293B]`
- **Secondary Backgrounds**: `bg-gray-50 dark:bg-[#0F172A]`
- **Accent Backgrounds**: 
  - Blue: `bg-blue-50 dark:bg-blue-900/20`
  - Green: `bg-green-50 dark:bg-green-900/20`
  - Yellow: `bg-yellow-50 dark:bg-yellow-900/20`
  - Orange: `bg-orange-50 dark:bg-orange-900/20`
  - Purple: `bg-purple-50 dark:bg-purple-900/20`

### Text Colors
- **Primary Text**: `text-gray-900 dark:text-white`
- **Secondary Text**: `text-gray-600 dark:text-gray-400`
- **Muted Text**: `text-gray-500 dark:text-gray-400`
- **Accent Text**: `text-blue-600 dark:text-blue-400`
- **Success Text**: `text-green-600 dark:text-green-400`
- **Warning Text**: `text-yellow-600 dark:text-yellow-400`
- **Error Text**: `text-red-600 dark:text-red-400`

### Border Colors
- **Card Borders**: `border-gray-100 dark:border-gray-800`
- **Input Borders**: `border-gray-300 dark:border-gray-600`
- **Divider Borders**: `border-gray-200 dark:border-gray-700`

## Typography System

### Heading Hierarchy
- **Page Title**: `text-2xl font-bold` (24px, extra bold)
- **Section Headers**: `text-lg font-bold` (18px, bold)
- **Subsection Headers**: `text-sm font-bold uppercase tracking-wide` (14px, bold, uppercase, wide spacing)
- **Card Titles**: `text-lg font-bold` (18px, bold)

### Text Sizes
- **Body Text**: `text-sm` (14px)
- **Small Text**: `text-xs` (12px)
- **Large Numbers**: `text-2xl font-bold` (24px, bold)
- **Navigation Text**: `text-sm` (14px)

### Font Weights
- **Bold**: `font-bold` (700)
- **Semibold**: `font-semibold` (600)
- **Medium**: `font-medium` (500)
- **Regular**: Default (400)

## Component Patterns

### Card Components
```tsx
// Standard Card Structure
<div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
    <Icon className="h-5 w-5 text-[color]-600 dark:text-[color]-400 mr-2" />
    Section Title
  </h3>
  {/* Content */}
</div>
```

### Icon Usage
- **Section Icons**: `h-5 w-5` with `mr-2` margin
- **Header Icons**: `h-8 w-8` for page headers
- **Inline Icons**: `h-4 w-4` for content elements
- **Icon Colors**: Semantic colors matching section themes

### Button Patterns
```tsx
// Primary Action Button
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
  <Icon className="h-4 w-4 mr-2" />
  Button Text
</button>

// Secondary Button
<button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
  Button Text
</button>

// Danger Button
<button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
  Button Text
</button>
```

## Navigation System

### Section Navigation
- **Grid Layout**: `grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-8`
- **Button Dimensions**: `min-h-[80px] w-full`
- **Hover Effects**: `hover:scale-105 active:scale-95`
- **Transitions**: `transition-all duration-300 ease-in-out`

### Navigation Button Structure
```tsx
<button className="nav-button flex flex-col items-center justify-center px-2 py-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 text-center min-h-[80px] w-full">
  <Icon className="h-4 w-4 mb-1" />
  <span className="text-xs leading-tight">Section Name</span>
</button>
```

## Form Elements

### Input Fields
```tsx
<input className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
```

### Textareas
```tsx
<textarea className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" rows={3} />
```

### Select Dropdowns
```tsx
<select className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
  {/* Options */}
</select>
```

## Table System

### Table Structure
```tsx
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead className="bg-gray-50 dark:bg-[#0F172A]">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Column Header
        </th>
      </tr>
    </thead>
    <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          Content
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Table Cell Styling
- **Padding**: `px-6 py-4` for body cells, `px-6 py-3` for headers
- **Text**: `text-sm` for body, `text-xs font-bold uppercase tracking-wider` for headers
- **Hover Effects**: `hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`

## Modal System

### Modal Overlay
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
  <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
    {/* Modal Content */}
  </div>
</div>
```

### Modal Structure
- **Background**: `bg-white dark:bg-[#1E293B]`
- **Border Radius**: `rounded-lg`
- **Padding**: `p-6`
- **Max Width**: `max-w-md w-full`
- **Z-Index**: `z-50`

## Status Indicators

### Badge System
```tsx
<span className={`px-3 py-1 rounded-full text-xs font-bold ${
  status === 'Yes' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
  status === 'No' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
  status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}`}>
  {status || 'N/A'}
</span>
```

### Color-Coded Status
- **Success/Approved**: Green (`bg-green-100 text-green-800`)
- **Error/Required**: Red (`bg-red-100 text-red-800`)
- **Warning/Pending**: Yellow (`bg-yellow-100 text-yellow-800`)
- **Neutral/Unknown**: Gray (`bg-gray-100 text-gray-800`)

## Spacing System

### Margins and Padding
- **Page Padding**: `p-6`
- **Section Margins**: `mb-8` for page sections, `mb-6` for card sections, `mb-4` for subsections
- **Card Padding**: `p-6` for main cards, `p-4` for nested elements
- **Element Spacing**: `space-y-4` for lists, `space-y-6` for sections, `space-y-2` for tight lists

### Gap Spacing
- **Grid Gaps**: `gap-6` for main sections, `gap-8` for major sections, `gap-2` for navigation buttons
- **Flex Gaps**: `space-x-3` for button groups, `space-x-2` for icon-text pairs

## Responsive Design

### Breakpoint System
- **Mobile First**: Default single-column layout
- **Small**: `sm:` prefix for 640px+
- **Medium**: `md:` prefix for 768px+
- **Large**: `lg:` prefix for 1024px+
- **Extra Large**: `xl:` prefix for 1280px+

### Responsive Classes
- **Grid Columns**: `grid-cols-1 lg:grid-cols-3 xl:grid-cols-4`
- **Text Sizes**: Responsive text sizing where needed
- **Spacing**: Responsive margins and padding
- **Layout**: Adaptive grid systems

## Animation and Transitions

### Hover Effects
- **Scale Transforms**: `hover:scale-105 active:scale-95`
- **Color Transitions**: `hover:text-blue-600 dark:hover:text-blue-400`
- **Background Transitions**: `hover:bg-blue-50 dark:hover:bg-blue-900/20`

### Transition Classes
- **Standard**: `transition-colors`
- **Complex**: `transition-all duration-300 ease-in-out`
- **Hover States**: Smooth color and background transitions

## Accessibility Features

### ARIA Labels
- **Navigation**: `aria-label` for section navigation
- **Buttons**: Descriptive labels for action buttons
- **Status**: Clear labeling for status indicators

### Focus States
- **Interactive Elements**: Proper focus indicators
- **Keyboard Navigation**: Logical tab order
- **Screen Reader**: Semantic HTML structure

## Dark Mode Support

### Color Mapping
- **Light Mode**: Standard gray scale with accent colors
- **Dark Mode**: `dark:` prefixed classes for all color variations
- **Backgrounds**: `bg-[#0F172A]` for page, `bg-[#1E293B]` for cards
- **Borders**: `dark:border-[#2D3B4E]` for dark mode borders

### Consistent Theming
- **All Components**: Dark mode variants for every color
- **Icons**: Dark mode color adjustments
- **Text**: Proper contrast in both modes
- **Interactive States**: Hover and focus states for both themes

## Usage Guidelines

### When to Use This Style Guide
- **Property Management Pages**: Similar detailed property views
- **Multi-Section Interfaces**: Complex forms with navigation
- **Data Display Components**: Tables, cards, and status indicators
- **Responsive Layouts**: Grid-based responsive designs

### Implementation Checklist
1. **Layout**: Follow grid system and spacing rules
2. **Colors**: Use defined color palette and dark mode support
3. **Typography**: Apply consistent heading and text hierarchy
4. **Components**: Use established patterns for cards, buttons, tables
5. **Responsiveness**: Implement responsive breakpoints
6. **Accessibility**: Include ARIA labels and proper semantics
7. **Dark Mode**: Provide dark mode variants for all elements

## Quick Reference

### Common Class Combinations
- **Card Container**: `bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800`
- **Section Header**: `text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center`
- **Primary Button**: `px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors`
- **Table Row**: `hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`
- **Status Badge**: `px-3 py-1 rounded-full text-xs font-bold`

### File Location
This style guide is maintained at: `PROPERTY_DETAILS_STYLE_GUIDE.md`

### Last Updated
Last updated: December 2024

---

This style guide ensures consistency across the PropertyDetails component and can be used to update or create similar components while maintaining the established design system.
