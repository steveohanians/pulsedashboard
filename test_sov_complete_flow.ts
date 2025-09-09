import { storage } from "./server/storage";
import { db } from "./server/db";
import { sovAnalyses } from "@shared/schema";
import { eq } from "drizzle-orm";

async function testCompleteFlow() {
  console.log("🧪 Testing Complete SOV Flow\n");
  
  const clientId = "demo-client-id";
  
  try {
    // Step 1: Clean up any existing test data
    console.log("🧹 Cleaning up old test data...");
    await db.delete(sovAnalyses)
      .where(eq(sovAnalyses.brandName, "Integration Test Brand"));
    
    // Step 2: Simulate saving an analysis (like the API would)
    console.log("\n💾 Step 1: Simulating API save...");
    
    const analysisData = {
      clientId: clientId,
      brandName: "Integration Test Brand",
      brandUrl: "https://integrationtest.com",
      competitors: [
        { name: "Competitor A", url: "https://competitora.com" },
        { name: "Competitor B", url: "https://competitorb.com" }
      ],
      vertical: "Technology",
      analysisType: "main" as const,
      summary: {
        brand: "Integration Test Brand",
        competitors: ["Competitor A", "Competitor B"],
        totalQuestions: 15,
        timestamp: new Date().toISOString(),
        strategicInsights: "Test strategic insights for integration test"
      },
      metrics: {
        overallSoV: { 
          "Integration Test Brand": 60, 
          "Competitor A": 25, 
          "Competitor B": 15 
        },
        totalMentions: 150,
        questionCoverage: { 
          "Integration Test Brand": 85 
        }
      },
      questionResults: [
        { 
          question: "What are the best solutions for X?", 
          stage: "awareness", 
          sov: { "Integration Test Brand": 70 } 
        },
        { 
          question: "How to choose between solutions?", 
          stage: "consideration", 
          sov: { "Integration Test Brand": 55 } 
        }
      ],
      status: "completed" as const,
      createdBy: undefined
    };
    
    const saved = await storage.saveSOVAnalysis(analysisData);
    console.log("✅ Analysis saved with ID:", saved.id);
    
    // Step 3: Simulate frontend loading (like useEffect would)
    console.log("\n🔄 Step 2: Simulating frontend load...");
    
    const loaded = await storage.getLatestSOVAnalysis(clientId, "main");
    
    if (!loaded) {
      throw new Error("Failed to load saved analysis!");
    }
    
    console.log("✅ Analysis loaded successfully:");
    console.log("  - Brand:", loaded.brandName);
    console.log("  - Timestamp:", loaded.summary?.timestamp);
    console.log("  - Overall SoV:", loaded.metrics?.overallSoV);
    console.log("  - Question Coverage:", loaded.metrics?.questionCoverage);
    
    // Step 4: Verify data integrity
    console.log("\n✔️ Step 3: Verifying data integrity...");
    
    const checks = [
      {
        name: "Summary present",
        pass: loaded.summary !== null && loaded.summary !== undefined
      },
      {
        name: "Metrics present",
        pass: loaded.metrics !== null && loaded.metrics !== undefined
      },
      {
        name: "Question results present",
        pass: loaded.questionResults !== null && loaded.questionResults !== undefined
      },
      {
        name: "Timestamp exists",
        pass: loaded.summary?.timestamp !== undefined
      },
      {
        name: "Strategic insights saved",
        pass: loaded.summary?.strategicInsights === "Test strategic insights for integration test"
      },
      {
        name: "Overall SoV correct",
        pass: loaded.metrics?.overallSoV?.["Integration Test Brand"] === 60
      }
    ];
    
    checks.forEach(check => {
      console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    
    if (allPassed) {
      console.log("\n🎉 All checks passed! The SOV persistence system is working correctly.");
    } else {
      console.log("\n⚠️ Some checks failed. Review the implementation.");
    }
    
    // Step 5: Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await db.delete(sovAnalyses).where(eq(sovAnalyses.id, saved.id));
    console.log("✅ Test data cleaned up");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
  
  process.exit(0);
}

testCompleteFlow();