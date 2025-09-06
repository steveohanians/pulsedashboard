#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    console.log('🔍 CHECKING DATABASE FOR PROGRESS RECORDS');
    console.log('═══════════════════════════════════════════');
    
    // Get the latest effectiveness runs with client names
    const result = await sql`
      SELECT er.id, c.name as client_name, er.status, er.progress, er.progress_detail, er.created_at
      FROM effectiveness_runs er
      LEFT JOIN clients c ON er.client_id = c.id
      ORDER BY er.created_at DESC 
      LIMIT 5
    `;
    
    if (result.length === 0) {
      console.log('❌ No effectiveness runs found');
      return;
    }
    
    console.log(`✅ Found ${result.length} recent runs\n`);
    
    for (let i = 0; i < result.length; i++) {
      const run = result[i];
      console.log(`📋 Run ${i + 1} (${run.id.substring(0, 8)}...):`);
      console.log(`   Client: ${run.client_name}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Progress: ${run.progress}`);
      console.log(`   ProgressDetail exists: ${!!run.progress_detail}`);
      console.log(`   Created: ${run.created_at}`);
      
      if (run.progress_detail) {
        try {
          const progressState = JSON.parse(run.progress_detail as string);
          console.log(`   ✅ Valid JSON with ${progressState.overallPercent}% progress`);
          console.log(`   Phase: ${progressState.currentPhase}`);
          if (progressState.timeRemaining) {
            console.log(`   Time: ${progressState.timeRemaining}`);
          }
        } catch (e) {
          console.log(`   ❌ Invalid JSON: ${run.progress_detail}`);
        }
      } else {
        console.log(`   ❌ No progressDetail saved`);
      }
      console.log('');
    }

    // Test the API endpoint if server is running
    console.log('🌐 TESTING API ENDPOINT:');
    console.log('────────────────────────');
    try {
      const response = await fetch('http://localhost:5000/api/effectiveness/latest');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API Response:');
        console.log(`   Status: ${data.status}`);
        console.log(`   Progress: ${data.progress}`);
        console.log(`   ProgressDetail exists: ${!!data.progressDetail}`);
        console.log(`   ProgressDetail type: ${typeof data.progressDetail}`);
        
        if (data.progressDetail) {
          try {
            const progressState = typeof data.progressDetail === 'string' ? 
              JSON.parse(data.progressDetail) : data.progressDetail;
            console.log(`   ✅ Parsed: ${progressState.overallPercent}% (${progressState.currentPhase})`);
          } catch (e) {
            console.log(`   ❌ Could not parse: ${data.progressDetail}`);
          }
        }
      } else {
        console.log(`❌ API returned ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ API not available: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

checkDatabase();