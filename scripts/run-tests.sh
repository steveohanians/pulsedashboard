#!/bin/bash

echo "🧪 Running Pulse Dashboard Tests"
echo "================================"

# Unit tests
echo "📦 Running unit tests..."
npm run test:unit

# Integration tests
echo "🔗 Running integration tests..."
npm run test:integration

# E2E tests (only if server is running)
if curl -s http://localhost:5173 > /dev/null; then
  echo "🌐 Running E2E tests..."
  npm run test:e2e
else
  echo "⚠️  Server not running, skipping E2E tests"
fi

echo "✅ All tests complete!"