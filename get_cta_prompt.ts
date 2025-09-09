import { storage } from './server/storage';

async function getCTAPrompt() {
  console.log('\n=== CTA Evaluation Prompt from Database ===\n');
  
  try {
    // Try to get the prompt from storage
    const prompt = await storage.getEffectivenessPromptTemplate('ctas');
    
    if (prompt) {
      console.log('=== System Prompt ===');
      console.log(prompt.systemPrompt);
      console.log('\n=== Prompt Template ===');
      console.log(prompt.promptTemplate);
      console.log('\n=== Schema ===');
      console.log(JSON.stringify(prompt.schema, null, 2));
    } else {
      console.log('No CTA prompt found in database');
    }
  } catch (error) {
    console.log('Error retrieving prompt:', error);
  }
  
  process.exit(0);
}

getCTAPrompt();
