import { db } from "./server/db";
import { sovAnalyses } from "@shared/schema";
import { eq } from "drizzle-orm";

async function cleanTestData() {
  console.log("🧹 Cleaning test data from SOV analyses...\n");
  
  try {
    // Delete the test data
    const result = await db
      .delete(sovAnalyses)
      .where(eq(sovAnalyses.brandName, "Test Brand"));
    
    console.log("✅ Deleted test data entries");
    
    // Verify it's gone
    const remaining = await db
      .select()
      .from(sovAnalyses)
      .where(eq(sovAnalyses.clientId, "demo-client-id"));
    
    console.log(`\n📊 Remaining analyses for demo-client-id: ${remaining.length}`);
    
    if (remaining.length > 0) {
      remaining.forEach(a => {
        console.log(`  - ${a.brandName} (${a.analysisType}) - ${a.createdAt}`);
      });
    } else {
      console.log("  (No analyses found - database is clean)");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

cleanTestData();