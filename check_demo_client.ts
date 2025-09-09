import { db } from "./server/db";
import { clients, competitors } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkDemoClient() {
  console.log("🔍 Checking demo client data...\n");
  
  try {
    // Get the demo client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, "demo-client-id"));
    
    if (client) {
      console.log("📊 Demo Client:");
      console.log("  ID:", client.id);
      console.log("  Name:", client.name);
      console.log("  Website:", client.websiteUrl);
      console.log("  Industry:", client.industryVertical);
      console.log("");
    } else {
      console.log("❌ No demo client found with ID 'demo-client-id'");
    }
    
    // Get competitors for demo client
    const competitorList = await db
      .select()
      .from(competitors)
      .where(eq(competitors.clientId, "demo-client-id"));
    
    console.log(`📊 Competitors (${competitorList.length} total):`);
    competitorList.forEach((comp, index) => {
      console.log(`  ${index + 1}. ${comp.label || comp.domain}`);
      console.log(`     Domain: ${comp.domain}`);
      console.log(`     Label: ${comp.label || "not set"}`);
      console.log("");
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

checkDemoClient();