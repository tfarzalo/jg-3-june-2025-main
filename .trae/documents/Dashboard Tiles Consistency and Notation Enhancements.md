## Scope
- Keep existing pre-title text exactly as-is
- Implement styling-only changes for equal heights and stronger pre-title visibility

## Metric Tiles (Top Row)
1. Equal heights
- DashboardHome.tsx: add `auto-rows-fr` on metrics grid
- Grid div → `className="hidden lg:grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 auto-rows-fr gap-6 mb-8"`
- Add `h-full` to Link wrapper: `className="block h-full"`
- MetricTile.tsx: set container to full-height flex column
- Container div → `className="h-full flex flex-col justify-between bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-lg transition-all duration-200 hover:shadow-xl relative overflow-hidden group"`

2. Pre-title visibility in tiles (text unchanged)
- MetricTile.tsx: notation element style upgrade
- Notation `<p>` → `className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300"`

## Dashboard Cards (Blocks)
1. Equal heights
- DashboardHome.tsx: add `auto-rows-fr` to both card grids
- Desktop grid → `className="hidden lg:grid grid-cols-1 lg:grid-cols-3 auto-rows-fr gap-6 mb-6"`
- Second row grid → `className="grid grid-cols-1 lg:grid-cols-3 auto-rows-fr gap-6"`
- DashboardCard.tsx: make root fill height
- Root div → `className={"h-full flex flex-col bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-lg " + className}`

2. Pre-title visibility in cards (text unchanged)
- DashboardCard.tsx: notation element style upgrade only
- Notation div → `className="text-sm font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200 -mb-0.5"`

## Verification
- Check lg+ breakpoints for equal heights across tiles/cards
- Confirm mobile unaffected
- Validate dark/light contrast for upgraded notation

Confirm to proceed and I’ll apply these styling changes without altering any text content.