import { storage } from "./server/storage";

async function testSOVLoad() {
  console.log("🧪 Testing SOV Load Functionality\n");
  
  try {
    // Test loading for demo client
    const clientId = "demo-client-id";
    
    console.log("📝 Testing getLatestSOVAnalysis for client:", clientId);
    
    // Test main analysis
    console.log("\n1️⃣ Testing type='main':");
    const mainAnalysis = await storage.getLatestSOVAnalysis(clientId, "main");
    
    if (mainAnalysis) {
      console.log("✅ Found main analysis:");
      console.log("  ID:", mainAnalysis.id);
      console.log("  Brand:", mainAnalysis.brandName);
      console.log("  Status:", mainAnalysis.status);
      console.log("  Created:", mainAnalysis.createdAt);
      console.log("  Summary:", mainAnalysis.summary ? "Present" : "Missing");
      console.log("  Metrics:", mainAnalysis.metrics ? "Present" : "Missing");
      console.log("  Questions:", mainAnalysis.questionResults ? "Present" : "Missing");
    } else {
      console.log("❌ No main analysis found");
    }
    
    // Test test analysis
    console.log("\n2️⃣ Testing type='test':");
    const testAnalysis = await storage.getLatestSOVAnalysis(clientId, "test");
    
    if (testAnalysis) {
      console.log("✅ Found test analysis:");
      console.log("  ID:", testAnalysis.id);
      console.log("  Brand:", testAnalysis.brandName);
      console.log("  Status:", testAnalysis.status);
      console.log("  Created:", testAnalysis.createdAt);
    } else {
      console.log("ℹ️ No test analysis found (expected if none saved)");
    }
    
    // Test loading by ID
    if (mainAnalysis) {
      console.log("\n3️⃣ Testing getSOVAnalysisById:");
      const byId = await storage.getSOVAnalysisById(mainAnalysis.id);
      
      if (byId) {
        console.log("✅ Successfully loaded by ID:", byId.id);
      } else {
        console.log("❌ Failed to load by ID");
      }
    }
    
    // Test loading all for client
    console.log("\n4️⃣ Testing getSOVAnalysesByClient:");
    const allAnalyses = await storage.getSOVAnalysesByClient(clientId);
    console.log(`✅ Found ${allAnalyses.length} total analyses for client`);
    
    if (allAnalyses.length > 0) {
      console.log("  Recent analyses:");
      allAnalyses.slice(0, 3).forEach(a => {
        console.log(`    - ${a.brandName} (${a.analysisType}) - ${a.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
  
  process.exit(0);
}

testSOVLoad();