#!/bin/bash

# Restart server script with proper cleanup

echo "🔄 Restarting server..."

# Kill any existing server processes more aggressively
echo "Stopping existing server..."

# Kill by port first (most reliable)
if command -v fuser &> /dev/null; then
    fuser -k 5000/tcp 2>/dev/null || true
fi

# Kill by process name patterns
pkill -9 -f "tsx server/index.ts" 2>/dev/null || true
pkill -9 -f "node.*server" 2>/dev/null || true
pkill -9 -f "tsx.*index.ts" 2>/dev/null || true

# Kill any Node process on port 5000
for pid in $(ss -tlnp 2>/dev/null | grep :5000 | grep -oP 'pid=\K[0-9]+'); do
    echo "Killing process $pid on port 5000"
    kill -9 $pid 2>/dev/null || true
done

# Wait longer for port to be released
echo "Waiting for port 5000 to be released..."
sleep 3

# Double-check port is free
max_attempts=5
attempt=1
while [ $attempt -le $max_attempts ]; do
    if ! ss -tlnp 2>/dev/null | grep -q :5000; then
        echo "✅ Port 5000 is free"
        break
    fi
    echo "⏳ Port still in use, waiting... (attempt $attempt/$max_attempts)"
    sleep 1
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Failed to free port 5000 after $max_attempts attempts"
    echo "Try running: sudo fuser -k 5000/tcp"
    exit 1
fi

# Start the server
echo "Starting server..."
NODE_ENV=development tsx server/index.ts &

# Save the PID
echo $! > server.pid

# Wait a moment to ensure server starts
sleep 1

# Check if server started successfully
if ps -p $(cat server.pid) > /dev/null; then
    echo "✅ Server restarted with PID: $(cat server.pid)"
    echo "To stop: kill $(cat server.pid) or npm run dev:stop"
    
    # Wait for server to be ready
    echo "Waiting for server to be ready..."
    max_health_checks=10
    health_check=1
    while [ $health_check -le $max_health_checks ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health | grep -q "200"; then
            echo "✅ Server is healthy and responding"
            break
        fi
        echo "⏳ Waiting for health check... (attempt $health_check/$max_health_checks)"
        sleep 1
        health_check=$((health_check + 1))
    done
    
    # Notify user to refresh preview
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 SERVER RESTARTED SUCCESSFULLY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "👉 Please refresh the preview window to see changes"
    echo "   (Click the refresh button in the preview pane)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ Server failed to start"
    exit 1
fi