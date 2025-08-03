// Simple fresh timer that resets for each test
let startTime = 0;

export function startFreshTimer() {
  startTime = Date.now();
  console.log(`🚀 [FRESH-TEST] Starting timer at: ${new Date().toISOString()}`);
}

export function markComplete() {
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Verify visual elements
  const charts = document.querySelectorAll('.recharts-wrapper').length;
  const metrics = document.querySelectorAll('[id^="metric-"]').length;
  const paths = document.querySelectorAll('svg path, svg circle, svg rect').length;
  
  console.log(`\n=== FRESH TEST CONFIRMATION ===`);
  console.log(`⏱️  Total Load Time: ${(totalTime/1000).toFixed(2)} SECONDS`);
  console.log(`📊 Visual Elements: ${charts} charts, ${metrics} metrics, ${paths} graphics`);
  console.log(`🕒 Started: ${new Date(startTime).toISOString()}`);
  console.log(`🏁 Completed: ${new Date(endTime).toISOString()}`);
  console.log(`================================\n`);
  
  return totalTime;
}