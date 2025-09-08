#!/usr/bin/env npx tsx

console.log('\n=== OPENAI ENVIRONMENT CHECK ===\n');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('process.env.OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 7) || 'NOT SET');

process.exit(0);
