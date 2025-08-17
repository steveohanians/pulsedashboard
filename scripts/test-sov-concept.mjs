// scripts/test-sov-concept.mjs
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables manually (since dotenv may not be available as ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env parser
try {
  const envFile = readFileSync(join(__dirname, '../.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (error) {
  console.log('Note: .env file not found, using existing environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testBrandUnderstanding() {
  console.log('🧪 Testing SoV Concept - Brand Understanding\n');
  
  // Test data - you can change this to your actual use case
  const testInput = {
    brand: { name: "Notion", url: "notion.so" },
    competitors: [
      { name: "Obsidian", url: "obsidian.md" },
      { name: "Roam Research", url: "roamresearch.com" }
    ],
    vertical: "Knowledge Management" // Still too vague!
  };

  try {
    console.log('📊 Input brands:', testInput.brand.name, 'vs', testInput.competitors.map(c => c.name).join(', '));
    console.log('\n🔍 Step 1: Understanding what these brands actually do...\n');

    // First, understand the brands
    const brandContext = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Research these brands and provide a brief summary of what each does:
        - ${testInput.brand.name} (${testInput.brand.url})
        - ${testInput.competitors.map(c => `${c.name} (${c.url})`).join('\n- ')}
        
        Format: Brief 1-2 sentence description for each.`
      }],
      temperature: 0.3
    });

    console.log('Brand Understanding:', brandContext.choices[0].message.content);
    console.log('\n✅ OpenAI connection working!');
    console.log('✅ Can research brands!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('API key')) {
      console.error('Check your OPENAI_API_KEY in .env file');
    }
  }
}

// Run the test
testBrandUnderstanding();