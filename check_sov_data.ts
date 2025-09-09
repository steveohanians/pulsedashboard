import { db } from "./server/db";
import { sovAnalyses } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkSOVData() {
  console.log("🔍 Checking all SOV analyses in database...\n");
  
  try {
    // Get all analyses for demo client
    const analyses = await db
      .select()
      .from(sovAnalyses)
      .where(eq(sovAnalyses.clientId, "demo-client-id"));
    
    console.log(`📊 Found ${analyses.length} analyses for demo-client-id:\n`);
    
    analyses.forEach((analysis, index) => {
      console.log(`${index + 1}. Analysis ID: ${analysis.id}`);
      console.log(`   Brand Name: ${analysis.brandName}`);
      console.log(`   Type: ${analysis.analysisType}`);
      console.log(`   Status: ${analysis.status}`);
      console.log(`   Created: ${analysis.createdAt}`);
      
      if (analysis.competitors) {
        console.log(`   Competitors:`);
        const comps = analysis.competitors as any[];
        comps.forEach(c => {
          console.log(`     - ${c.name}`);
        });
      }
      
      if (analysis.summary) {
        const summary = analysis.summary as any;
        console.log(`   Summary Brand: ${summary.brand}`);
        console.log(`   Summary Competitors: ${summary.competitors?.join(", ")}`);
      }
      
      console.log("");
    });
    
    // Check if there's test data
    const hasTestBrand = analyses.some(a => a.brandName === "Test Brand");
    if (hasTestBrand) {
      console.log("⚠️  Found 'Test Brand' in database - this is test data!");
      console.log("   This might be loading instead of real analysis.\n");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

checkSOVData();