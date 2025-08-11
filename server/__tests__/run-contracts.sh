#!/bin/bash

# Script to run contract tests
# Usage: ./server/__tests__/run-contracts.sh

echo "🧪 Running Contract Tests..."
echo "Setting up test environment..."

# Set test environment
export NODE_ENV=test

# Run the contract tests using tsx
if command -v tsx &> /dev/null; then
    echo "Running contract tests with tsx..."
    tsx server/__tests__/contracts.spec.ts
else
    echo "tsx not found. Please install tsx: npm install -g tsx"
    exit 1
fi

echo "✅ Contract tests completed!"