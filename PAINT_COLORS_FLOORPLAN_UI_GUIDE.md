# Paint Colors with Floorplan - Visual Guide

## UI Changes Overview

### Before (Original)
```
Paint Type: Regular Paint                [Remove]
├─ Room: Living Room    | Color: Beige      [X]
├─ Room: Bedroom        | Color: Light Gray [X]
└─ Room: Kitchen        | Color: White      [X]
[+ Add Room]
```

### After (With Floorplan Groups)
```
Paint Type: Regular Paint                [Remove]

┃ Floorplan 1
│ ├─ Room: Living Room    | Color: Beige      [X]
│ ├─ Room: Bedroom        | Color: Light Gray [X]
│ [+ Add Room to Floorplan 1]
│
┃ Floorplan 2
│ ├─ Room: Kitchen        | Color: White      [X]
│ ├─ Room: Dining Room    | Color: White      [X]
│ [+ Add Room to Floorplan 2]

[+ Add Floorplan 1] [+ Add Floorplan 2]
```

## Editor Form Layout

### Paint Type Section:
```
┌──────────────────────────────────────────────────────────┐
│ Paint Type: [Regular Paint ▼]                  [Trash]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┃ Floorplan 1                                           │
│ │                                                        │
│ │ ┌─────────────────────┬─────────────────────┬─────┐  │
│ │ │ Living Room         │ Beige               │ [X] │  │
│ │ └─────────────────────┴─────────────────────┴─────┘  │
│ │ ┌─────────────────────┬─────────────────────┬─────┐  │
│ │ │ Bedroom             │ Light Gray          │ [X] │  │
│ │ └─────────────────────┴─────────────────────┴─────┘  │
│ │                                                        │
│ │ [+ Add Room to Floorplan 1]                           │
│                                                          │
│ ┃ Floorplan 2                                           │
│ │                                                        │
│ │ ┌─────────────────────┬─────────────────────┬─────┐  │
│ │ │ Kitchen             │ White               │ [X] │  │
│ │ └─────────────────────┴─────────────────────┴─────┘  │
│ │                                                        │
│ │ [+ Add Room to Floorplan 2]                           │
│                                                          │
│ [+ Add Floorplan 1] [+ Add Floorplan 2]                 │
└──────────────────────────────────────────────────────────┘
```

### Room Row Layout:
```
┌──────────────────────┬──────────────────────┬─────┐
│ [Room Name...      ] │ [Paint Color...    ] │ [X] │
└──────────────────────┴──────────────────────┴─────┘
     flex-1 (grows)        flex-1 (grows)     icon
```

## Viewer Display Layout

### Single Floorplan (No Grouping Shown)
```
┌─────────────────────────────────────────────────┐
│ ● Regular Paint                                 │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Living Room              Beige          │   │
│ └─────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────┐   │
│ │ Bedroom                  Light Gray     │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Multiple Floorplans (With Grouping)
```
┌─────────────────────────────────────────────────┐
│ ● Regular Paint                                 │
│                                                 │
│ ┃ Floorplan 1                                  │
│ │                                               │
│ │ ┌─────────────────────────────────────────┐ │
│ │ │ Living Room              Beige          │ │
│ │ └─────────────────────────────────────────┘ │
│ │ ┌─────────────────────────────────────────┐ │
│ │ │ Bedroom                  Light Gray     │ │
│ │ └─────────────────────────────────────────┘ │
│                                                 │
│ ┃ Floorplan 2                                  │
│ │                                               │
│ │ ┌─────────────────────────────────────────┐ │
│ │ │ Kitchen                  White          │ │
│ │ └─────────────────────────────────────────┘ │
│ │ ┌─────────────────────────────────────────┐ │
│ │ │ Dining Room              White          │ │
│ │ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Color Coding

### Floorplan Headers (When Multiple)
- Left border: 2px solid blue (#3B82F6)
- Font: 14px, semibold
- Color: Gray 700 (dark mode: Gray 300)
- Margin bottom: 8px

### Room Cards
- Background: Faded color of paint (12% opacity)
- Left border: 4px solid paint color hex
- Padding: 16px
- Border radius: 8px
- Transition: smooth on hover

## Styling Details

### Editor Dropdown
```css
width: 144px (36 * 0.25rem)
padding: 8px 12px
background: gray-50 / dark:#0F172A
border: 1px solid gray-300 / dark:#2D3B4E
border-radius: 8px
font-size: 14px
```

### Room Input Fields
```css
flex: 1 (equal width)
padding: 8px 12px
background: gray-50 / dark:#0F172A
border: 1px solid gray-300 / dark:#2D3B4E
border-radius: 8px
focus: ring-2 ring-blue-500
```

## User Flow

### Creating Paint Colors with Floorplans

1. **Add Paint Type**
   ```
   Click [+ Add Paint Type / Color]
   → Select paint type from dropdown (e.g., "Regular Paint")
   ```

2. **Add Floorplan**
   ```
   Click [+ Add Floorplan 1]
   → Floorplan 1 section appears with header
   → Shows "+ Add Room to Floorplan 1" button
   ```

3. **Add First Room to Floorplan 1**
   ```
   Click [+ Add Room to Floorplan 1]
   → New row appears with:
      - Room input (empty)
      - Color input (empty)
      - Remove button [X]
   ```

4. **Fill Room Details**
   ```
   Room: "Living Room"
   Color: "Beige"
   ```

5. **Add More Rooms to Floorplan 1**
   ```
   Click [+ Add Room to Floorplan 1] again
   Room: "Bedroom"
   Color: "Light Gray"
   ```

6. **Add Second Floorplan**
   ```
   Click [+ Add Floorplan 2]
   → Floorplan 2 section appears below Floorplan 1
   → Shows "+ Add Room to Floorplan 2" button
   ```

7. **Add Rooms to Floorplan 2**
   ```
   Click [+ Add Room to Floorplan 2]
   Room: "Kitchen"
   Color: "White"
   ```

8. **Save**
   ```
   Click [Save Property] or [Update Property]
   → Data persists to database with floorplan grouping
   ```

### Viewing Grouped Paint Colors

1. **Navigate to Property Details**
   ```
   Go to property page
   Scroll to "Paint Colors" section
   ```

2. **See Automatic Grouping**
   ```
   If rooms have different floorplans:
   → Shows floorplan headers with blue accent
   → Rooms grouped under respective headers
   
   If all rooms have same floorplan:
   → No headers shown (cleaner view)
   → Just shows room list
   ```

## Data Structure Examples

### Example 1: Single Floorplan
```json
{
  "paint_type": "Regular Paint",
  "rooms": [
    {
      "floorplan": "Floorplan 1",
      "room": "Living Room",
      "color": "Beige"
    },
    {
      "floorplan": "Floorplan 1",
      "room": "Bedroom",
      "color": "Light Gray"
    }
  ]
}
```

### Example 2: Multiple Floorplans
```json
{
  "paint_type": "Regular Paint",
  "rooms": [
    {
      "floorplan": "Floorplan 1",
      "room": "Living Room",
      "color": "Beige"
    },
    {
      "floorplan": "Floorplan 1",
      "room": "Master Bedroom",
      "color": "Light Gray"
    },
    {
      "floorplan": "Floorplan 2",
      "room": "Kitchen",
      "color": "White"
    },
    {
      "floorplan": "Floorplan 2",
      "room": "Bathroom",
      "color": "White"
    }
  ]
}
```

### Example 3: Legacy Data (No Floorplan)
```json
{
  "paint_type": "Regular Paint",
  "rooms": [
    {
      "room": "Living Room",
      "color": "Beige"
    }
  ]
}
```
*Note: Viewer will treat as "Floorplan 1" automatically*

## Responsive Behavior

### Desktop (≥1024px)
- Dropdown: 144px fixed width
- Room/Color inputs: Equal flex-grow
- All fields in single row

### Tablet (768px - 1023px)
- Same layout as desktop
- Slightly tighter spacing

### Mobile (<768px)
- Fields may stack if needed
- Dropdown maintains 144px width
- Inputs become full-width below dropdowns

## Accessibility

### Keyboard Navigation
- Tab order: Floorplan → Room → Color → Remove → Next Row
- Enter/Space: Open dropdown, select option
- Escape: Close dropdown
- Delete/Backspace: Focus on remove button works

### Screen Readers
- Labels: "Select floorplan", "Enter room name", "Enter paint color"
- Announcements: "Room removed", "Paint type added"
- Group labels: "Floorplan 1 rooms", "Floorplan 2 rooms"

## Best Practices

### For Users
1. Group rooms logically by physical floorplan
2. Keep similar room types together in each floorplan
3. Use consistent naming (e.g., "Bedroom 1", "Bedroom 2")

### For Developers
1. Always default new rooms to "Floorplan 1"
2. Preserve floorplan field when saving (already implemented)
3. Handle missing floorplan field gracefully (defaults to "Floorplan 1")
4. Sort floorplans alphabetically for consistent display

## Summary

The floorplan feature adds minimal UI complexity while providing significant organizational value:

✅ **Simple**: Just one dropdown per room
✅ **Intuitive**: Defaults to Floorplan 1
✅ **Automatic**: Grouping happens in viewer
✅ **Backward Compatible**: Works with old data
✅ **Scalable**: Easy to add more floorplans later
