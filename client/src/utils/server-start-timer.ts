// Get server boot time from API endpoint
let SERVER_BOOT_TIME: number;

// Fetch server boot time immediately
(async () => {
  try {
    const response = await fetch('/api/server-boot-time');
    const data = await response.json();
    SERVER_BOOT_TIME = data.bootTime;
    console.log(`📡 [CLIENT] Connected to server booted at: ${new Date(SERVER_BOOT_TIME).toISOString()}`);
  } catch (error) {
    SERVER_BOOT_TIME = Date.now();
    console.log(`⚠️ [CLIENT] Could not get server boot time, using current time`);
  }
})();

export function getServerStartTime() {
  return SERVER_BOOT_TIME;
}

export function markDashboardComplete() {
  const endTime = Date.now();
  const totalTime = endTime - SERVER_BOOT_TIME;
  
  // Verify visual elements
  const charts = document.querySelectorAll('.recharts-wrapper').length;
  const metrics = document.querySelectorAll('[id^="metric-"]').length;
  const paths = document.querySelectorAll('svg path, svg circle, svg rect').length;
  
  console.log(`\n=== TRUE LOAD TIME MEASUREMENT ===`);
  console.log(`🚀 Server Boot Time: ${new Date(SERVER_BOOT_TIME).toISOString()}`);
  console.log(`🏁 Dashboard Complete: ${new Date(endTime).toISOString()}`);
  console.log(`⏱️  TOTAL BOOT-TO-DASHBOARD TIME: ${(totalTime/1000).toFixed(2)} SECONDS`);
  console.log(`📊 Visual Verification: ${charts} charts, ${metrics} metrics, ${paths} graphics`);
  console.log(`=====================================\n`);
  
  return totalTime;
}