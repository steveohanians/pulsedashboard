import { db } from "./server/db";
import { sovPromptTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkSOVTemplate() {
  console.log("🔍 Checking SOV Prompt Template...\n");
  
  try {
    // Get active template
    const [template] = await db
      .select()
      .from(sovPromptTemplate)
      .where(eq(sovPromptTemplate.isActive, true))
      .limit(1);
    
    if (template) {
      console.log("📝 Active SOV Template Found:");
      console.log("  Name:", template.name);
      console.log("  Active:", template.isActive);
      console.log("\n📋 Template Content:");
      console.log("-".repeat(50));
      console.log(template.promptTemplate);
      console.log("-".repeat(50));
      
      // Check if template mentions specific brands
      const brandMentions = [
        "Baunfire",
        "baunfire",
        "digital agency",
        "web development"
      ];
      
      console.log("\n🔍 Checking for unexpected brand mentions:");
      brandMentions.forEach(brand => {
        if (template.promptTemplate.includes(brand)) {
          console.log(`  ⚠️ Found "${brand}" in template!`);
        }
      });
      
    } else {
      console.log("❌ No active SOV template found in database");
      console.log("   The service may be using a hardcoded default template");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

checkSOVTemplate();