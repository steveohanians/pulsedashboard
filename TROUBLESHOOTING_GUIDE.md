# Effectiveness Analysis Troubleshooting Guide

## Current Issue: "Analysis Failed" with 0% Progress

### Symptom
- UI shows: "Loading website effectiveness analysis..."
- Status: "Analysis Failed" 
- Progress: "0%"
- Button: "Try Again"

### Likely Causes & Solutions

## 🔍 **Diagnostic Steps**

### Step 1: Check Browser Console
**Open browser Developer Tools (F12) → Console tab**

Look for:
- ❌ **JavaScript errors** (red messages)
- 📡 **SSE connection messages** (should see `[SSE] Connection opened`)
- 🔗 **Network errors** (failed HTTP requests)

**Expected SSE messages:**
```
[SSE] Connection opened for client: your-client-id
[SSE] Connected event: {clientId: "...", message: "Progress stream connected"}
[SSE] Progress update: 5% - Starting analysis...
```

### Step 2: Check Server Logs
**Look in your server console/logs for:**

❌ **Common error patterns:**
```bash
# Data collection failures
❌ Error fetching URL: <website-url>
❌ Screenshot capture failed
❌ PageSpeed API timeout

# Authentication issues  
❌ Access denied
❌ Client not found: <client-id>

# Service failures
❌ Analysis failed: [error details]
❌ OpenAI API error
❌ Database connection error
```

### Step 3: Verify Configuration

**Check these common issues:**

1. **Environment Variables**
   ```bash
   ✅ OPENAI_API_KEY=sk-...
   ✅ DATABASE_URL=postgresql://...
   ✅ NODE_ENV=development
   ```

2. **Website URL Accessibility**
   - Can the server reach your website URL?
   - Is the website behind authentication?
   - Are there CORS/firewall issues?

3. **Database Connection**
   - Is the database running and accessible?
   - Are database tables created properly?

## 🛠️ **Quick Fixes**

### Fix 1: Clear Stuck Analysis
If analysis gets stuck, force a restart:

```bash
# In browser console:
localStorage.clear();
# Then refresh page
```

### Fix 2: Test with Demo Client
Try with the demo client ID to isolate the issue:

```bash
# Use this client ID for testing:
CLIENT_ID="demo-client-id" 
```

### Fix 3: Manual Database Check
Check if the run exists and its status:

```sql
-- Check latest run status
SELECT id, status, progress, progressDetail, createdAt 
FROM effectiveness_runs 
WHERE clientId = 'your-client-id' 
ORDER BY createdAt DESC 
LIMIT 5;
```

## 🔧 **Debug Tools**

### Tool 1: Run SSE Debug Script
```bash
# Test SSE connectivity
CLIENT_ID="your-client-id" npx tsx debug_sse_connection.ts
```

### Tool 2: Manual API Test
```bash
# Test analysis endpoint directly
curl -X POST http://localhost:3001/api/effectiveness/refresh/your-client-id \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Tool 3: Check SSE Health
```bash
# Check SSE server status
curl http://localhost:3001/api/sse/health
```

## 📋 **Common Solutions**

### If SSE Connection Fails:
1. Check firewall/proxy settings
2. Verify authentication cookies
3. Try refreshing the page
4. Check if server is running on expected port

### If Analysis Starts But Fails Immediately:
1. **Website URL Issue**: URL not accessible from server
2. **API Keys Missing**: OpenAI or PageSpeed API keys not set
3. **Database Issue**: Tables not created or connection failed
4. **Timeout Issue**: Server resources insufficient

### If Progress Gets Stuck:
1. **Data Collection Timeout**: Website taking too long to respond
2. **AI Service Timeout**: OpenAI API calls timing out  
3. **Resource Exhaustion**: Server running out of memory/CPU

## 🚑 **Emergency Fixes**

### Reset Everything:
```bash
# 1. Stop server
# 2. Clear browser cache/localStorage
# 3. Restart server
# 4. Try with force=true
```

### Skip Problem Components:
Temporarily disable competitors or specific criteria to isolate the issue.

---

## 💡 **Next Steps**

1. **Run diagnostic steps above**
2. **Share the specific error messages** you find
3. **Try the debug tools** to get more detailed information

The most common cause is either:
- **Website URL not accessible** from server
- **Missing environment variables** (especially OPENAI_API_KEY)
- **Database connection issues**

Let me know what you find in the browser console and server logs! 🔍