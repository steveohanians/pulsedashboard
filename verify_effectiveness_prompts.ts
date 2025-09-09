import { db } from "./server/db";
import { effectivenessPromptTemplates } from "@shared/schema";

async function verifyPrompts() {
  console.log("🔍 Checking effectiveness prompts in database...\n");
  
  try {
    const prompts = await db
      .select({
        id: effectivenessPromptTemplates.id,
        criterion: effectivenessPromptTemplates.criterion,
        isActive: effectivenessPromptTemplates.isActive,
        createdAt: effectivenessPromptTemplates.createdAt
      })
      .from(effectivenessPromptTemplates);
    
    console.log(`📊 Found ${prompts.length} effectiveness prompts in database:\n`);
    
    prompts.forEach(p => {
      console.log(`  - ${p.criterion}: ${p.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`    ID: ${p.id}`);
      console.log(`    Created: ${p.createdAt}`);
      console.log("");
    });
    
    // Check for specific criteria
    const expectedCriteria = ['positioning', 'brand_story', 'ctas'];
    console.log("🎯 Checking for expected criteria:");
    
    expectedCriteria.forEach(criterion => {
      const found = prompts.find(p => p.criterion === criterion);
      if (found) {
        console.log(`  ✅ ${criterion} - Found (Active: ${found.isActive})`);
      } else {
        console.log(`  ❌ ${criterion} - NOT FOUND`);
      }
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

verifyPrompts();