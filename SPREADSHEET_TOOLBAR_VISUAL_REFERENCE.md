# Spreadsheet Editor Toolbar - Visual Reference

## 🎨 Button Color Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPREADSHEET EDITOR TOOLBAR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [💾 Save]      [📥 Export ▼]    │  [➕ Row]  [➕ Col]  [🗑️ Row]  [🗑️ Col]  [✕] │
│   BLUE          GREEN            │   BLUE     PURPLE     RED      ORANGE     │
│  (disabled      (shadow)         │  (shadow)  (shadow)  (shadow)  (shadow)   │
│   when no                        │                                           │
│   changes)                       │                                           │
│                                  │                                           │
│                                  └─ Separator                               │
│                                                                             │
│  Export Dropdown (when open):                                               │
│  ┌──────────────────────────────────┐                                       │
│  │ 📄 Export as CSV                │                                        │
│  │    Compatible with Excel         │  ← Green icon, green hover            │
│  ├──────────────────────────────────┤                                       │
│  │ 📊 Export as Excel              │                                        │
│  │    .xlsx format                  │  ← Blue icon, blue hover              │
│  ├──────────────────────────────────┤                                       │
│  │ 📋 Export as PDF                │                                        │
│  │    Printable format              │  ← Red icon, red hover                │
│  └──────────────────────────────────┘                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🎯 Button Functions

### Primary Actions (Left Side)

| Button | Color | Function | State |
|--------|-------|----------|-------|
| **Save** | 🔵 Blue | Save changes to file | Disabled when no changes |
| **Export** | 🟢 Green | Open export menu | Always enabled |

### Row/Column Tools (Right of Separator)

| Button | Color | Function | Note |
|--------|-------|----------|------|
| **+ Row** | 🔵 Blue | Add new row at bottom | Immediate effect |
| **+ Col** | 🟣 Purple | Add new column at end | Immediate effect |
| **🗑️ Row** | 🔴 Red | Delete selected row | Requires row selection |
| **🗑️ Col** | 🟠 Orange | Delete selected column | Requires column selection |

### Close Button (Far Right)

| Button | Color | Function |
|--------|-------|----------|
| **✕** | Gray (hover) | Close editor | Warns if unsaved changes |

## 📱 Export Menu Details

### CSV Export
- **Icon**: 📄 Green FileDown
- **Title**: Export as CSV
- **Subtitle**: Compatible with Excel
- **Format**: .csv (comma-separated)
- **Use Case**: Universal compatibility

### Excel Export
- **Icon**: 📊 Blue FileDown
- **Title**: Export as Excel
- **Subtitle**: .xlsx format
- **Format**: .xlsx (binary Excel)
- **Use Case**: Full Excel compatibility

### PDF Export
- **Icon**: 📋 Red FileDown
- **Title**: Export as PDF
- **Subtitle**: Printable format
- **Format**: .pdf (portable document)
- **Use Case**: Printing, read-only sharing

## 🎨 Color Meanings

| Color | Purpose | Psychology |
|-------|---------|------------|
| 🔵 **Blue** | Primary actions, additive | Trust, stability |
| 🟢 **Green** | Success, export, download | Safety, go-ahead |
| 🟣 **Purple** | Secondary additive action | Creativity, distinction |
| 🔴 **Red** | Destructive action (delete) | Caution, attention |
| 🟠 **Orange** | Warning destructive action | Alert, moderate caution |

## ⚡ Interaction States

### Button States
- **Normal**: Solid color with white text
- **Hover**: Darker shade of same color
- **Disabled**: Gray with reduced opacity
- **Active**: Same as normal (no press state)

### Export Dropdown
- **Closed**: Not visible
- **Open**: White background, shadow, border
- **Hover Item**: Light colored background (matches icon color)
- **Click Outside**: Closes dropdown

## 📐 Layout Specifications

### Toolbar
- **Height**: 52px (py-3)
- **Padding**: 16px (px-4)
- **Background**: Gradient gray (light to darker)
- **Border**: Bottom border, gray

### Buttons
- **Padding**: 12px horizontal, 8px vertical (px-4 py-2)
- **Border Radius**: 8px (rounded-lg)
- **Shadow**: sm on colored buttons
- **Transition**: All properties, 150ms

### Export Dropdown
- **Width**: 224px (w-56)
- **Border**: 2px solid
- **Border Radius**: 8px (rounded-lg)
- **Shadow**: 2xl (very prominent)
- **Z-Index**: 9999 (above everything)
- **Position**: Absolute, left-aligned, 8px below button

## 🔍 Visual Hierarchy

### Primary Level (Most Prominent)
1. Save button (when enabled)
2. Export button (green)

### Secondary Level
3. Row/Column tools (colored)

### Tertiary Level
4. Close button (subtle)
5. Unsaved indicator (when visible)

## 🌗 Dark Mode Adaptations

All buttons maintain their colors in dark mode:
- Colors remain vibrant
- White text stays white
- Background gradients adjust to dark grays
- Borders become lighter for visibility
- Export dropdown gets dark background

## ✨ Animations

- **Hover**: 150ms ease transition
- **Click**: Immediate response
- **Dropdown open**: Instant (no animation)
- **Dropdown close**: Instant (no animation)
- **Unsaved indicator**: Pulse animation on dot

---

**Reference Document**  
**Version**: 1.0  
**Date**: December 10, 2024
