import { db } from "./server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  console.log("🚀 Running SOV migration...\n");
  
  try {
    const migrationPath = path.join(__dirname, "migrations", "add_sov_analyses_table.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
    
    console.log("📝 Executing migration SQL...");
    await db.execute(sql.raw(migrationSQL));
    
    console.log("✅ Migration completed successfully!");
    
    // Verify the table exists
    const tableCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sov_analyses'
      ORDER BY ordinal_position;
    `);
    
    console.log("\n📊 Table structure:");
    tableCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check indexes
    const indexCheck = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'sov_analyses';
    `);
    
    console.log("\n🔍 Indexes:");
    indexCheck.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
  
  process.exit(0);
}

runMigration();