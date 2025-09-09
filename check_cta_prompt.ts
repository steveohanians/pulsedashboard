import { db } from './server/db';
import { effectivenessPrompts } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkPrompt() {
  const prompts = await db
    .select()
    .from(effectivenessPrompts)
    .where(eq(effectivenessPrompts.criterion, 'ctas'));
  
  if (prompts[0]) {
    console.log('=== CTA Prompt Template ===');
    console.log(prompts[0].promptTemplate);
    console.log('\n=== System Prompt ===');
    console.log(prompts[0].systemPrompt);
  }
  process.exit(0);
}

checkPrompt();
