# Pulse Dashboard Performance Optimization Guide

## 🐌 Current Issue: Slow Vite Development Server

**Problem**: Static TypeScript/React files taking 3-10 seconds each to load with 304 responses, causing 30+ second total page loads.

**Root Cause**: Vite file watching overhead in Replit's container environment with sequential file checking.

---

## ⚡ Quick Fixes (Immediate Impact)

### 1. Use Optimized Development Script
```bash
# Run this for immediate performance improvement:
chmod +x scripts/dev-fast.sh
./scripts/dev-fast.sh
```

### 2. Manual Environment Variables
Start the dev server with optimized memory allocation:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

### 3. Clear Development Caches
```bash
# Clear all Vite caches (run when experiencing slowdowns):
rm -rf node_modules/.vite
rm -rf client/.vite
rm -rf .cache
npm run dev
```

---

## 🔧 Advanced Optimizations

### 1. Full Performance Optimization Script
```bash
chmod +x scripts/optimize-dev-performance.sh
./scripts/optimize-dev-performance.sh
```
This script will:
- Clear all caches
- Pre-optimize heavy dependencies
- Set performance environment variables
- Create development-specific optimizations

### 2. Browser Optimizations
- **Close unused tabs** (saves memory)
- **Use Chrome/Edge** (better V8 performance)
- **Disable browser extensions** during development
- **Clear browser cache** for the Replit domain

### 3. Workspace Optimizations
- **Restart Replit workspace** if performance degrades
- **Close unused files/terminals** in Replit
- **Use single browser window** for development

---

## 📊 Expected Performance Improvements

| Optimization Level | File Load Time | Total Page Load | Improvement |
|-------------------|----------------|----------------|-------------|
| **Current**       | 3-10 seconds   | 30+ seconds    | Baseline    |
| **Quick Fixes**   | 1-3 seconds    | 8-12 seconds   | 60-75%      |
| **Full Optimization** | <1 second  | 3-5 seconds    | 85-90%      |

---

## 🎯 Performance Monitoring

The dashboard includes performance tracking that shows:
- **Component Mount Time**: Should be <100ms
- **API Fetch Time**: Currently 1.4-2.4s (backend bottleneck)
- **Data Orchestration**: ~1-2ms (already optimized)

Check browser console for `[PERF]` logs to monitor improvements.

---

## 🚨 Troubleshooting

### If Still Slow After Optimizations:

1. **Check Memory Usage**:
   ```bash
   node -e "console.log('Memory:', process.memoryUsage())"
   ```

2. **Restart Everything**:
   ```bash
   # Kill all Node processes and restart
   pkill node
   ./scripts/dev-fast.sh
   ```

3. **Verify Cache Clearing**:
   ```bash
   find . -name ".vite" -type d -exec rm -rf {} +
   find . -name ".cache" -type d -exec rm -rf {} +
   ```

4. **Fallback**: Restart entire Replit workspace

---

## 🔍 Technical Details

### Root Causes:
- **File Watching Overhead**: Vite checks 50+ files sequentially
- **Container Environment**: Polling-based file watching in Docker
- **Memory Constraints**: Default Node.js memory limits
- **Cache Misses**: Repeated dependency resolution

### Solutions Applied:
- **Memory Allocation**: 4GB Node.js heap (from default 1.7GB)
- **Dependency Pre-bundling**: Heavy React/UI components
- **Cache Optimization**: Persistent Vite cache directory
- **File System Optimization**: Reduced polling frequency

---

## 💡 Future Improvements

Consider these architectural changes for long-term performance:

1. **Lazy Loading**: Code-split heavy components
2. **Service Worker**: Cache static assets aggressively  
3. **Bundle Analysis**: Identify and optimize heavy imports
4. **Development/Production Parity**: Reduce dev-only overhead

---

Run `./scripts/optimize-dev-performance.sh` to get started! 🚀