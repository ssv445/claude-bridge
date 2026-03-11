# Unified Session List

## Problem
"Attached" and "Available" headings confuse users. The split adds cognitive
overhead when sessions are already visually distinguished by dot color.

## Solution
Remove the two-list split. Render one flat list of directory groups sorted
by most recent activity.

## Sort Order
- Directory groups: most recently active session in group first
- Sessions within group: most recently active first

## Visual Indicators (unchanged)
- Green dot = attached (open in tab)
- Blue dot = paused
- Grey dot = available

## Files Changed
- `src/components/SessionList.tsx` — remove split, single groupByDirectory + render
