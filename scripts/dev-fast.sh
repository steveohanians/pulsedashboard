#!/bin/bash

# Fast Development Server Starter
# Optimized startup script for Pulse Dashboard

echo "⚡ Starting Pulse Dashboard with performance optimizations..."

# Set Node.js memory and performance flags
export NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"
export UV_THREADPOOL_SIZE=8

# Set Vite optimization flags
export VITE_OPTIMIZE_DEPS_FORCE=true
export VITE_DEV_SERVER_CACHE=true

# Clear development caches on startup
echo "🧹 Clearing stale caches..."
rm -rf node_modules/.vite > /dev/null 2>&1
rm -rf client/.vite > /dev/null 2>&1

echo "🚀 Starting development server..."
npm run dev