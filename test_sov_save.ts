import { storage } from "./server/storage";
import { db } from "./server/db";
import { sovAnalyses } from "@shared/schema";

async function testSOVSave() {
  console.log("🧪 Testing SOV Save Functionality\n");
  
  try {
    // Test data
    const testAnalysis = {
      clientId: "demo-client-id",  // Using the demo client ID
      brandName: "Test Brand",
      brandUrl: "https://testbrand.com",
      competitors: [
        { name: "Competitor 1", url: "https://competitor1.com" },
        { name: "Competitor 2", url: "https://competitor2.com" }
      ],
      vertical: "Technology",
      analysisType: "main" as const,
      summary: {
        brand: "Test Brand",
        competitors: ["Competitor 1", "Competitor 2"],
        totalQuestions: 15,
        timestamp: new Date().toISOString(),
        strategicInsights: "Test insights"
      },
      metrics: {
        overallSoV: { "Test Brand": 45, "Competitor 1": 30, "Competitor 2": 25 },
        totalMentions: 100,
        questionCoverage: { "Test Brand": 80 }
      },
      questionResults: [
        { question: "Test question 1", stage: "awareness", sov: { "Test Brand": 50 } }
      ],
      status: "completed" as const,
      createdBy: undefined
    };
    
    console.log("📝 Attempting to save analysis...");
    console.log("  Client ID:", testAnalysis.clientId);
    console.log("  Brand:", testAnalysis.brandName);
    console.log("  Type:", testAnalysis.analysisType);
    
    // Save the analysis
    const saved = await storage.saveSOVAnalysis(testAnalysis);
    
    console.log("\n✅ Analysis saved successfully!");
    console.log("  ID:", saved.id);
    console.log("  Created at:", saved.createdAt);
    
    // Verify it was saved
    console.log("\n🔍 Verifying save by fetching from database...");
    const fetched = await storage.getSOVAnalysisById(saved.id);
    
    if (fetched) {
      console.log("✅ Fetched analysis from database:");
      console.log("  ID:", fetched.id);
      console.log("  Brand:", fetched.brandName);
      console.log("  Status:", fetched.status);
      console.log("  Metrics:", JSON.stringify(fetched.metrics, null, 2));
    } else {
      console.log("❌ Could not fetch saved analysis!");
    }
    
    // Test fetching latest
    console.log("\n🔍 Testing getLatestSOVAnalysis...");
    const latest = await storage.getLatestSOVAnalysis("demo-client-id", "main");
    
    if (latest) {
      console.log("✅ Got latest analysis:");
      console.log("  ID:", latest.id);
      console.log("  Brand:", latest.brandName);
      console.log("  Created:", latest.createdAt);
    } else {
      console.log("❌ Could not fetch latest analysis!");
    }
    
    // Check total count
    const allAnalyses = await db.select().from(sovAnalyses);
    console.log(`\n📊 Total analyses in database: ${allAnalyses.length}`);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
  
  process.exit(0);
}

testSOVSave();