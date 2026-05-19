# Today's Agenda Sidebar - Visual Guide

## Implementation Screenshot Reference

Based on the attached screenshot, here's how the sidebar was implemented:

### Sidebar Header
```
┌─────────────────────────────────────┐
│ 📅 Today's Agenda            [✕]   │
└─────────────────────────────────────┘
```

### Daily Summary Totals
```
┌─────────────────────────────────────┐
│  5      0        0        5         │
│ Paint Callback  Repair   Total      │
│ (blue) (orange)  (red)  (purple)    │
└─────────────────────────────────────┘
```

### Job Card Layout
```
┌─────────────────────────────────────┐
│ WO-4748              [Job Request]  │
│ Camden Southline                    │
│ Unit #228                           │
│ PO#: None                           │
│                                     │
│ Paint                               │
│                                     │
│ 👤 Jesus Navarrete                  │
│ [Click to view details]             │
└─────────────────────────────────────┘
```

## Implementation Code Structure

### 1. Sidebar Container
```tsx
{showAgendaSidebar && (
  <div className="w-80 flex-shrink-0">
    <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow 
                    border border-gray-200 dark:border-[#2D3B4E] 
                    h-fit sticky top-6">
      {/* Header */}
      {/* Summary */}
      {/* Jobs List */}
    </div>
  </div>
)}
```

### 2. Header with Toggle
```tsx
<div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E] 
                flex items-center justify-between">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white 
                 flex items-center">
    <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
    {isToday(selectedDate) 
      ? "Today's Agenda" 
      : format(selectedDate, 'MMM d, yyyy')
    }
  </h3>
  <button onClick={() => setShowAgendaSidebar(false)}>
    <PanelRightClose className="h-5 w-5" />
  </button>
</div>
```

### 3. Daily Totals
```tsx
<div className="bg-gradient-to-r from-blue-50 to-purple-50 
                dark:from-blue-900/20 dark:to-purple-900/20 
                border border-blue-200 dark:border-blue-700 
                rounded-lg p-4 mb-4">
  <div className="grid grid-cols-4 gap-4 text-center">
    <div>
      <div className="text-2xl font-bold text-blue-600">{totals.paint}</div>
      <div className="text-xs text-blue-600">Paint</div>
    </div>
    {/* Callback, Repair, Total */}
  </div>
</div>
```

### 4. Job Card
```tsx
<div onClick={() => setSelectedJob(job)}
     className="border border-gray-200 dark:border-[#2D3B4E] 
                rounded-lg p-3 hover:shadow-md transition-shadow 
                cursor-pointer"
     style={{ backgroundColor: `${job.phaseColor}0A` }}>
  
  <div className="flex items-start justify-between mb-2">
    <div className="flex-1">
      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
        WO-{String(job.workOrderNum).padStart(6, '0')}
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {job.propertyName}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500">
        Unit #{job.unitNumber}
      </p>
      {job.assignedToName && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          👤 {job.assignedToName}
        </p>
      )}
      {!job.assignedToName && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
          Unassigned
        </p>
      )}
    </div>
    <span className="text-xs px-2 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: job.phaseColor, color: 'white' }}>
      {job.phaseName}
    </span>
  </div>
</div>
```

### 5. Event Card
```tsx
<div onClick={() => { setSelectedEvent(event); setShowEventDetails(true); }}
     className="border border-gray-200 dark:border-[#2D3B4E] 
                rounded-lg p-3 hover:shadow-md transition-shadow 
                cursor-pointer"
     style={{ backgroundColor: `${event.color}0A` }}>
  
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
        {event.title}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {event.is_all_day 
          ? 'All Day' 
          : `${format(parseISO(event.start_at), 'h:mm a')} - 
             ${format(parseISO(event.end_at), 'h:mm a')}`
        }
      </p>
    </div>
    <span className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: event.color }} />
  </div>
</div>
```

### 6. Empty State
```tsx
{dayJobs.length === 0 && dayEvents.length === 0 && (
  <div className="text-center py-8">
    <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
    <p className="text-gray-500 dark:text-gray-400">
      No jobs or events scheduled
    </p>
  </div>
)}
```

### 7. Toggle Button (when collapsed)
```tsx
{!showAgendaSidebar && view === 'month' && (
  <button onClick={() => setShowAgendaSidebar(true)}
          className="fixed right-6 top-24 
                     bg-blue-600 hover:bg-blue-700 
                     text-white p-3 rounded-lg shadow-lg 
                     transition-colors z-10"
          title="Show Today's Agenda">
    <PanelRightOpen className="h-5 w-5" />
  </button>
)}
```

## Layout Flow

```
┌────────────────────────────────────────────────────────────────┐
│                        Calendar Dev Header                      │
│  [< >] Month Nav   [Month|Week|Day|Agenda]  [Filters]          │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│                         Phase Filters                           │
└────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────┬──────────────────────────┐
│                                     │  📅 Today's Agenda  [✕] │
│        Month Grid (flex-1)          │ ┌────────────────────────┤
│  ┌───┬───┬───┬───┬───┬───┬───┐     │ │  5    0    0    5     │
│  │Sun│Mon│Tue│Wed│Thu│Fri│Sat│     │ │ Paint Call Rep Total  │
│  ├───┼───┼───┼───┼───┼───┼───┤     │ └────────────────────────┤
│  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │     │ ┌────────────────────────┤
│  ├───┼───┼───┼───┼───┼───┼───┤     │ │ WO-4748  [Job Request]│
│  │ 8 │ 9 │10 │11 │12 │13 │14 │     │ │ Camden Southline      │
│  ├───┼───┼───┼───┼───┼───┼───┤     │ │ Unit #228             │
│  │15 │16 │17 │18*│19 │20 │21 │     │ │ 👤 Jesus Navarrete    │
│  │   │   │   │[S]│   │   │   │     │ └────────────────────────┤
│  ├───┼───┼───┼───┼───┼───┼───┤     │ ┌────────────────────────┤
│  │22 │23 │24 │25 │26 │27 │28 │     │ │ WO-4749  [Job Request]│
│  └───┴───┴───┴───┴───┴───┴───┘     │ │ Camden Southline      │
│                                     │ │ Unit #257             │
│  * = Today (blue ring)              │ │ 👤 Jesus Navarrete    │
│  [S] = Selected (purple ring)       │ └────────────────────────┤
│                                     │         (scrollable)      │
│                (w-80, sticky) ──────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Color Reference

### Job Type Colors
- **Paint**: `text-blue-600 dark:text-blue-400` (#2563eb)
- **Callback**: `text-orange-500 dark:text-orange-400` (#f97316)
- **Repair**: `text-red-500 dark:text-red-400` (#ef4444)
- **Total**: `text-purple-700 dark:text-purple-400` (#7c3aed)

### Ring Colors
- **Today**: `ring-blue-400 dark:ring-blue-500`
- **Selected**: `ring-purple-400 dark:ring-purple-500`

### Background Colors
- **Sidebar**: `bg-white dark:bg-[#1E293B]`
- **Totals Box**: `from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20`
- **Job Card**: `${phaseColor}0A` (10% opacity of phase color)

## Interaction States

### Hover States
```css
/* Job/Event Cards */
hover:shadow-md transition-shadow

/* Toggle Buttons */
hover:bg-blue-700 (for blue buttons)
hover:text-gray-600 (for close button)
```

### Active States
```css
/* Selected Date */
ring-inset ring-2 ring-purple-400

/* Today's Date */
ring-inset ring-2 ring-blue-400

/* Dragging Job */
opacity-30 scale-95
```

## Responsive Behavior

### Desktop (default)
- Sidebar: `w-80` (320px)
- Calendar: `flex-1` (remaining space)

### Sidebar Collapsed
- Sidebar: hidden
- Calendar: `w-full`
- Toggle button: `fixed right-6 top-24`

### Scrolling
- Sidebar: `sticky top-6` (stays visible when scrolling)
- Job/Event list: `max-h-[600px] overflow-y-auto`

---

This visual guide matches the implementation exactly as shown in the provided screenshot.
