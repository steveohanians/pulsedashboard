import { db } from "./server/db";
import { sovPromptTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixSOVTemplate() {
  console.log("🔧 Fixing SOV Template...\n");
  
  try {
    // Get current template
    const [current] = await db
      .select()
      .from(sovPromptTemplate)
      .where(eq(sovPromptTemplate.isActive, true))
      .limit(1);
    
    if (!current) {
      console.log("❌ No active template found");
      return;
    }
    
    console.log("📝 Current template has hardcoded examples:");
    console.log("  - Contains 'baunfire'");
    console.log("  - Contains 'Focus Lab'");
    
    // Fix the template by replacing the example with generic placeholders
    const fixedTemplate = current.promptTemplate
      .replace(
        `- {brandContext} = includes the primary {brand} and a list of {competitors}. Example:
  Brand: Clear Digital
  Competitors: baunfire, https://focuslab`,
        `- {brandContext} = includes the primary {brand} and a list of {competitors}.`
      );
    
    // Update the template
    await db
      .update(sovPromptTemplate)
      .set({
        promptTemplate: fixedTemplate,
        updatedAt: new Date()
      })
      .where(eq(sovPromptTemplate.id, current.id));
    
    console.log("\n✅ Template updated successfully!");
    console.log("   Removed hardcoded brand examples");
    
    // Verify the fix
    const [updated] = await db
      .select()
      .from(sovPromptTemplate)
      .where(eq(sovPromptTemplate.id, current.id));
    
    const stillHasBaunfire = updated?.promptTemplate.includes("baunfire") || 
                            updated?.promptTemplate.includes("Baunfire");
    const stillHasFocuslab = updated?.promptTemplate.includes("focuslab") || 
                            updated?.promptTemplate.includes("Focus Lab");
    
    if (!stillHasBaunfire && !stillHasFocuslab) {
      console.log("\n✅ Verification passed:");
      console.log("   - No 'baunfire' mentions");
      console.log("   - No 'focuslab' mentions");
    } else {
      console.log("\n⚠️ Warning: Template may still contain example brands");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

fixSOVTemplate();