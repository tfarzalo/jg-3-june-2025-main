#!/bin/bash

echo "🔍 Environment Variable Check for Netlify Deployment"
echo "=================================================="

# Check if we're in a build environment
if [ -n "$NETLIFY" ]; then
    echo "✅ Running in Netlify build environment"
    echo "Build ID: $BUILD_ID"
    echo "Deploy context: $CONTEXT"
else
    echo "ℹ️ Running in local environment"
fi

echo ""
echo "Environment Variables:"
echo "----------------------"

# Check VITE_SUPABASE_URL
if [ -n "$VITE_SUPABASE_URL" ]; then
    echo "✅ VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:0:30}..."
else
    echo "❌ VITE_SUPABASE_URL: MISSING"
fi

# Check VITE_SUPABASE_ANON_KEY
if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "✅ VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:0:30}..."
else
    echo "❌ VITE_SUPABASE_ANON_KEY: MISSING"
fi

echo ""
echo "Node Environment:"
echo "-----------------"
echo "NODE_ENV: ${NODE_ENV:-'not set'}"
echo "NODE_VERSION: $(node --version 2>/dev/null || echo 'not available')"
echo "NPM_VERSION: $(npm --version 2>/dev/null || echo 'not available')"

echo ""
echo "Build Information:"
echo "------------------"
echo "PWD: $(pwd)"
echo "Date: $(date)"

# If in Netlify, show additional info
if [ -n "$NETLIFY" ]; then
    echo "Deploy URL: $DEPLOY_PRIME_URL"
    echo "Branch: $BRANCH"
    echo "Head: $COMMIT_REF"
fi

echo ""
echo "🎯 Running build with current environment..."

# Run the actual build
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    
    # Check if dist folder exists
    if [ -d "dist" ]; then
        echo "✅ dist folder created"
        echo "📁 dist contents:"
        ls -la dist/
        
        # Check if index.html exists
        if [ -f "dist/index.html" ]; then
            echo "✅ index.html exists"
        else
            echo "❌ index.html missing from dist folder"
        fi
    else
        echo "❌ dist folder not created"
    fi
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi