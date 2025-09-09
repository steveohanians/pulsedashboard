import { db } from "./server/db";
import { sovPromptTemplate, effectivenessPromptTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

async function showAllPrompts() {
  console.log("📋 RETRIEVING ALL PROMPTS FROM DATABASE\n");
  console.log("=" .repeat(80));
  
  try {
    // 1. Get SOV Prompt Template
    console.log("\n🎯 SOV (SHARE OF VOICE) PROMPT TEMPLATE");
    console.log("-".repeat(80));
    
    const [sovTemplate] = await db
      .select()
      .from(sovPromptTemplate)
      .where(eq(sovPromptTemplate.isActive, true))
      .limit(1);
    
    if (sovTemplate) {
      console.log("Name:", sovTemplate.name);
      console.log("Active:", sovTemplate.isActive);
      console.log("\nPROMPT TEMPLATE:");
      console.log("-".repeat(40));
      console.log(sovTemplate.promptTemplate);
      console.log("-".repeat(40));
    } else {
      console.log("❌ No active SOV template found");
    }
    
    // 2. Get Effectiveness Prompt Templates
    console.log("\n\n📊 EFFECTIVENESS PROMPT TEMPLATES");
    console.log("=" .repeat(80));
    
    const effectivenessTemplates = await db
      .select()
      .from(effectivenessPromptTemplates)
      .where(eq(effectivenessPromptTemplates.isActive, true))
      .orderBy(effectivenessPromptTemplates.criterion);
    
    if (effectivenessTemplates.length > 0) {
      // Look for specific criteria
      const criteriaToShow = ['ctas', 'brand_story', 'positioning'];
      
      for (const criterion of criteriaToShow) {
        const template = effectivenessTemplates.find(t => t.criterion === criterion);
        
        if (template) {
          console.log("\n" + "=".repeat(80));
          console.log(`\n📌 ${criterion.toUpperCase().replace('_', ' ')} TEMPLATE`);
          console.log("-".repeat(80));
          
          console.log("\nCriterion:", template.criterion);
          console.log("Classifier Name:", template.classifierName);
          console.log("Description:", template.description || "N/A");
          
          console.log("\n🤖 SYSTEM PROMPT:");
          console.log("-".repeat(40));
          console.log(template.systemPrompt);
          
          console.log("\n💬 PROMPT TEMPLATE:");
          console.log("-".repeat(40));
          console.log(template.promptTemplate);
          
          console.log("\n📊 EXPECTED SCHEMA:");
          console.log("-".repeat(40));
          try {
            const schema = JSON.parse(template.schema);
            console.log(JSON.stringify(schema, null, 2));
          } catch {
            console.log(template.schema);
          }
        }
      }
      
      // List any other criteria not explicitly shown
      const otherCriteria = effectivenessTemplates
        .filter(t => !criteriaToShow.includes(t.criterion))
        .map(t => t.criterion);
      
      if (otherCriteria.length > 0) {
        console.log("\n\n📝 OTHER EFFECTIVENESS CRITERIA IN DATABASE:");
        console.log(otherCriteria.join(", "));
      }
      
    } else {
      console.log("❌ No active effectiveness templates found");
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ PROMPT RETRIEVAL COMPLETE");
    
  } catch (error) {
    console.error("❌ Error retrieving prompts:", error);
  }
  
  process.exit(0);
}

showAllPrompts();