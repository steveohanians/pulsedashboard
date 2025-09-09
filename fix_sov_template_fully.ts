import { db } from "./server/db";
import { sovPromptTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixSOVTemplateFully() {
  console.log("🔧 Fully Fixing SOV Template...\n");
  
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
    
    console.log("📝 Fixing all hardcoded brand examples...");
    
    // Fix the template by replacing ALL hardcoded examples
    let fixedTemplate = current.promptTemplate
      // Remove the main example
      .replace(
        `- {brandContext} = includes the primary {brand} and a list of {competitors}.`,
        `- {brandContext} = includes the primary {brand} and a list of {competitors}.`
      )
      // Fix the URL example - make it generic
      .replace(
        `• Strip protocols/domains from URLs (e.g., "https://focuslab" → "Focus Lab").`,
        `• Strip protocols/domains from URLs (e.g., "https://example.com" → "Example").`
      )
      // Fix the brand name example - make it generic
      .replace(
        `• Use Title Case for brand names (e.g., "baunfire" → "Baunfire").`,
        `• Use Title Case for brand names (e.g., "example" → "Example").`
      )
      // Fix spacing example - make it generic
      .replace(
        `• Preserve multi-word spacing (e.g., "Focus Lab" not "FocusLab").`,
        `• Preserve multi-word spacing (e.g., "Example Company" not "ExampleCompany").`
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
    
    // Verify the fix
    const [updated] = await db
      .select()
      .from(sovPromptTemplate)
      .where(eq(sovPromptTemplate.id, current.id));
    
    const checkBrands = [
      "baunfire",
      "Baunfire", 
      "focuslab",
      "Focus Lab",
      "Clear Digital"
    ];
    
    console.log("\n🔍 Verification:");
    let foundAny = false;
    checkBrands.forEach(brand => {
      if (updated?.promptTemplate.includes(brand)) {
        console.log(`  ⚠️ Still contains "${brand}"`);
        foundAny = true;
      }
    });
    
    if (!foundAny) {
      console.log("  ✅ All hardcoded brand examples removed!");
      console.log("  ✅ Template now uses generic examples only");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

fixSOVTemplateFully();