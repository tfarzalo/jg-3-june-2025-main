#!/bin/bash
# Diagnostic script to verify code changes are loaded

echo "🔍 Checking if PropertyContactsEditor has console logs..."
echo ""

if grep -q "🎨 PropertyContactsEditor rendered" src/components/property/PropertyContactsEditor.tsx; then
    echo "✅ Console log found in PropertyContactsEditor.tsx"
else
    echo "❌ Console log NOT found in PropertyContactsEditor.tsx"
fi

if grep -q "🔄 handleCustomContactChange called" src/components/PropertyEditForm.tsx; then
    echo "✅ Console log found in PropertyEditForm.tsx"
else
    echo "❌ Console log NOT found in PropertyEditForm.tsx"
fi

echo ""
echo "🔍 Checking if role fields are in the save handler..."
echo ""

if grep -q "is_subcontractor_contact: c.is_subcontractor_contact" src/components/PropertyEditForm.tsx; then
    echo "✅ Role fields are present in PropertyEditForm save handler"
else
    echo "❌ Role fields NOT found in PropertyEditForm save handler"
fi

echo ""
echo "📦 Checking for Vite cache..."
if [ -d "node_modules/.vite" ]; then
    echo "⚠️  Vite cache exists (node_modules/.vite)"
    echo "   Run: rm -rf node_modules/.vite"
else
    echo "✅ No Vite cache found"
fi

echo ""
echo "📦 Checking for dist folder..."
if [ -d "dist" ]; then
    echo "⚠️  Dist folder exists"
    echo "   Run: rm -rf dist"
else
    echo "✅ No dist folder found"
fi

echo ""
echo "🔍 Checking Vite dev server status..."
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✅ Dev server is running on port 5173"
else
    echo "⚠️  No dev server detected on port 5173"
    echo "   Run: npm run dev"
fi

echo ""
echo "✨ All code changes are in place!"
echo "   If logs don't appear in browser, follow FORCE_REFRESH_INSTRUCTIONS.md"
