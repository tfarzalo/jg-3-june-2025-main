## ⚠️ IMPORTANT: Which File to Run

### ✅ RUN THIS FILE:
**`add_rename_and_fix_death_star.sql`** ← This one is FIXED and ready to run

### ❌ DO NOT RUN THESE:
- `fix_death_star_property.sql` ← OLD, has bugs
- `fix_death_star_simple.sql` ← Alternative, but not as complete
- `diagnose_death_star.sql` ← Just for diagnostics

---

## How to Run the Correct File:

1. **Close any old queries** in Supabase SQL Editor
2. Open a **new query** tab
3. Open the file: **`add_rename_and_fix_death_star.sql`**
4. Copy the **entire contents** of that file
5. Paste into Supabase SQL Editor
6. Click **"Run"**

---

## What Will Happen:

✅ Creates the `rename_folder` function (no `updated_at` column issues)
✅ Fixes the orphaned Death Star file
✅ Shows verification that orphaned files = 0
✅ Enables the File Manager rename feature

---

## After Success:

You can then use File Manager to rename folders properly:
1. Open File Manager
2. Find the `death_star` folder
3. Click the pencil icon ✏️
4. Rename to `Death Star`
5. Done!

---

## Files Summary:

| File | Status | Purpose |
|------|--------|---------|
| `add_rename_and_fix_death_star.sql` | ✅ **USE THIS** | Complete fix with rename function |
| `fix_death_star_property.sql` | ❌ OLD | Has bugs, don't use |
| `fix_death_star_simple.sql` | ⚠️ Alternative | Quick fix without rename function |
| `diagnose_death_star.sql` | 🔍 Optional | For checking current state |
| `check_files_table_structure.sql` | 🔍 Optional | See what columns exist |
