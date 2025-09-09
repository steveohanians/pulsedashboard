import { db } from './server/db';

async function checkPrompt() {
  // Direct SQL query since the schema import isn't working
  const result = await db.execute(`
    SELECT prompt_template, system_prompt 
    FROM effectiveness_prompts 
    WHERE criterion = 'ctas'
  `);
  
  if (result.rows && result.rows.length > 0) {
    const prompt = result.rows[0];
    console.log('=== CTA System Prompt ===');
    console.log(prompt.system_prompt);
    console.log('\n=== CTA Prompt Template (first 1000 chars) ===');
    const template = String(prompt.prompt_template);
    console.log(template.substring(0, 1000));
    if (template.includes('above')) {
      console.log('\n=== Above-the-fold instructions ===');
      const lines = template.split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes('above') || line.toLowerCase().includes('fold')) {
          console.log(`Line ${i}: ${line}`);
        }
      });
    }
  }
  process.exit(0);
}

checkPrompt();
