/**
 * Temporary debug utility to understand device distribution data structure
 * This will help us see what data actually exists
 */

export function debugDeviceDistribution(dashboardData: any) {
  console.log("=== DEVICE DISTRIBUTION DEBUG ===");
  
  // Check what's in metrics
  const deviceMetrics = dashboardData?.metrics?.filter((m: any) => 
    m.metricName === "Device Distribution"
  ) || [];
  
  console.log("1. Device Distribution Metrics Count:", deviceMetrics.length);
  console.log("2. Unique Source Types:", 
    Array.from(new Set(deviceMetrics.map((m: any) => m.sourceType)))
  );
  
  // Group by source type
  const bySourceType: any = {};
  deviceMetrics.forEach((m: any) => {
    const key = m.sourceType;
    if (!bySourceType[key]) bySourceType[key] = [];
    bySourceType[key].push({
      value: m.value,
      channel: m.channel,
      competitorId: m.competitorId,
      timePeriod: m.timePeriod
    });
  });
  
  console.log("3. Metrics by Source Type:", bySourceType);
  
  // Check averagedMetrics
  if (dashboardData?.averagedMetrics) {
    console.log("4. AveragedMetrics Keys:", Object.keys(dashboardData.averagedMetrics));
    if (dashboardData.averagedMetrics["Device Distribution"]) {
      console.log("5. Device Distribution in AveragedMetrics:", 
        dashboardData.averagedMetrics["Device Distribution"]
      );
    }
  }
  
  // Check competitors
  console.log("6. Competitors:", dashboardData?.competitors?.map((c: any) => ({
    id: c.id,
    domain: c.domain
  })));
  
  // Look for ANY metric with competitor data
  const competitorMetrics = dashboardData?.metrics?.filter((m: any) => 
    m.sourceType === "Competitor" && m.competitorId
  ) || [];
  
  console.log("7. Total Competitor Metrics (all types):", competitorMetrics.length);
  console.log("8. Competitor Metric Names:", 
    Array.from(new Set(competitorMetrics.map((m: any) => m.metricName)))
  );
  
  console.log("=== END DEBUG ===");
}