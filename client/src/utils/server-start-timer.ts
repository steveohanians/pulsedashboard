// Timer that starts immediately when the client loads
const SERVER_START_TIME = Date.now();
console.log(`🚀 [SERVER-TIMER] Client script loading at: ${new Date(SERVER_START_TIME).toISOString()}`);

export function getServerStartTime() {
  return SERVER_START_TIME;
}

export function markDashboardComplete() {
  const endTime = Date.now();
  const totalTime = endTime - SERVER_START_TIME;
  
  // Verify visual elements
  const charts = document.querySelectorAll('.recharts-wrapper').length;
  const metrics = document.querySelectorAll('[id^="metric-"]').length;
  const paths = document.querySelectorAll('svg path, svg circle, svg rect').length;
  
  console.log(`\n=== TRUE LOAD TIME MEASUREMENT ===`);
  console.log(`🚀 Server/Client Start: ${new Date(SERVER_START_TIME).toISOString()}`);
  console.log(`🏁 Dashboard Complete: ${new Date(endTime).toISOString()}`);
  console.log(`⏱️  TOTAL SERVER-TO-DASHBOARD TIME: ${(totalTime/1000).toFixed(2)} SECONDS`);
  console.log(`📊 Visual Verification: ${charts} charts, ${metrics} metrics, ${paths} graphics`);
  console.log(`=====================================\n`);
  
  return totalTime;
}