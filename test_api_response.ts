#!/usr/bin/env npx tsx

async function testAPIResponse() {
  console.log('\n=== TESTING API RESPONSE DATA ===\n');
  
  // Simulate API call
  const response = await fetch('http://localhost:3000/api/effectiveness/latest/demo-client-id', {
    headers: {
      'Authorization': 'Bearer test-token'
    }
  });
  
  if (!response.ok) {
    console.log('API call failed:', response.status);
    return;
  }
  
  const data = await response.json();
  
  // Check client run data
  console.log('CLIENT RUN:');
  console.log('  Run ID:', data.run?.id?.slice(0, 8));
  console.log('  Status:', data.run?.status);
  console.log('  Criteria count:', data.run?.criterionScores?.length || 0);
  
  // Check speed score specifically
  const clientSpeed = data.run?.criterionScores?.find((s: any) => s.criterion === 'speed');
  console.log('  Speed score:', clientSpeed?.score || 'MISSING');
  
  // Check all client scores
  console.log('  All scores:');
  data.run?.criterionScores?.forEach((s: any) => {
    console.log(`    - ${s.criterion}: ${s.score}`);
  });
  
  console.log('\nCOMPETITOR DATA:');
  data.competitorEffectivenessData?.forEach((comp: any, i: number) => {
    console.log(`\n  ${comp.competitor.label}:`);
    console.log('    Run ID:', comp.run?.id?.slice(0, 8));
    console.log('    Criteria count:', comp.run?.criterionScores?.length || 0);
    
    const compSpeed = comp.run?.criterionScores?.find((s: any) => s.criterion === 'speed');
    console.log('    Speed score:', compSpeed?.score || 'MISSING');
  });
  
  // Check for data mixing
  console.log('\n=== DATA INTEGRITY CHECK ===\n');
  
  const clientSpeedScore = clientSpeed?.score;
  let dataMixing = false;
  
  data.competitorEffectivenessData?.forEach((comp: any) => {
    const compSpeed = comp.run?.criterionScores?.find((s: any) => s.criterion === 'speed');
    if (compSpeed && clientSpeedScore === compSpeed.score) {
      console.log(`⚠️  WARNING: Client speed (${clientSpeedScore}) matches ${comp.competitor.label} speed (${compSpeed.score})`);
      dataMixing = true;
    }
  });
  
  if (!dataMixing) {
    console.log('✅ No obvious data mixing detected');
  }
}

testAPIResponse().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
