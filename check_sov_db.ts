import { db } from "./server/db";
import { sovAnalyses } from "@shared/schema";
import { sql } from "drizzle-orm";

async function checkSOVDatabase() {
  console.log("🔍 Checking SOV database...\n");
  
  try {
    // Check if table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sov_analyses'
      );
    `);
    
    console.log("Table exists:", tableCheck.rows[0]?.exists);
    
    if (!tableCheck.rows[0]?.exists) {
      console.log("❌ Table 'sov_analyses' does not exist!");
      console.log("The migration may not have been applied.");
      
      // Try to create the table
      console.log("\n📦 Creating table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sov_analyses (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id VARCHAR REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
          brand_name TEXT NOT NULL,
          brand_url TEXT NOT NULL,
          competitors JSONB NOT NULL,
          vertical TEXT NOT NULL,
          analysis_type VARCHAR(10) DEFAULT 'main' NOT NULL,
          summary JSONB,
          metrics JSONB,
          question_results JSONB,
          status VARCHAR(20) DEFAULT 'pending' NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          completed_at TIMESTAMP,
          created_by VARCHAR REFERENCES users(id)
        );
      `);
      
      // Create indexes
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sov_analyses_client_created 
        ON sov_analyses(client_id, created_at);
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sov_analyses_status 
        ON sov_analyses(status);
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sov_analyses_type 
        ON sov_analyses(analysis_type);
      `);
      
      console.log("✅ Table created successfully!");
    }
    
    // Check for any records
    const records = await db.select().from(sovAnalyses);
    console.log(`\n📊 Total SOV analyses in database: ${records.length}`);
    
    if (records.length > 0) {
      console.log("\n📝 Recent analyses:");
      records.slice(0, 5).forEach(record => {
        console.log(`  - ID: ${record.id}`);
        console.log(`    Client: ${record.clientId}`);
        console.log(`    Brand: ${record.brandName}`);
        console.log(`    Type: ${record.analysisType}`);
        console.log(`    Status: ${record.status}`);
        console.log(`    Created: ${record.createdAt}`);
        console.log("");
      });
    }
    
  } catch (error) {
    console.error("❌ Error checking database:", error);
  }
  
  process.exit(0);
}

checkSOVDatabase();