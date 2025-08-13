/**
 * Server-side chart generation utilities for PDF export
 * Generates SVG charts from dashboard data
 */

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface PieChartData {
  data: { label: string; value: number; color?: string }[];
  title?: string;
}

export interface BarChartData {
  data: { label: string; value: number; color?: string }[];
  title?: string;
  yAxisLabel?: string;
}

/**
 * Generate SVG pie chart
 */
export function generatePieChartSVG(data: PieChartData, width = 400, height = 300): string {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;
  
  const total = data.data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -90; // Start at top
  
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
  
  let pathElements = '';
  let legendElements = '';
  
  data.data.forEach((item, index) => {
    const percentage = (item.value / total) * 100;
    const angleSize = (item.value / total) * 360;
    
    if (percentage > 0.5) { // Only show slices > 0.5%
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSize;
      
      const startX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
      const startY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
      const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
      const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
      
      const largeArcFlag = angleSize > 180 ? 1 : 0;
      const color = item.color || colors[index % colors.length];
      
      pathElements += `
        <path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z" 
              fill="${color}" stroke="#fff" stroke-width="2"/>
      `;
      
      // Add legend item
      const legendY = 20 + (index * 20);
      legendElements += `
        <rect x="20" y="${legendY - 10}" width="12" height="12" fill="${color}"/>
        <text x="40" y="${legendY}" font-family="Arial, sans-serif" font-size="12" fill="#333">
          ${item.label}: ${percentage.toFixed(1)}%
        </text>
      `;
    }
    
    currentAngle += angleSize;
  });
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .chart-title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #333; }
        .legend-text { font-family: Arial, sans-serif; font-size: 12px; fill: #666; }
      </style>
      ${data.title ? `<text x="${width/2}" y="20" text-anchor="middle" class="chart-title">${data.title}</text>` : ''}
      <g transform="translate(0, ${data.title ? 20 : 0})">
        ${pathElements}
      </g>
      <g transform="translate(${width - 200}, 40)">
        ${legendElements}
      </g>
    </svg>
  `;
}

/**
 * Generate SVG bar chart
 */
export function generateBarChartSVG(data: BarChartData, width = 500, height = 300): string {
  const margin = { top: 40, right: 20, bottom: 60, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const maxValue = Math.max(...data.data.map(d => d.value));
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  
  let bars = '';
  let labels = '';
  let yAxisTicks = '';
  
  const barWidth = chartWidth / data.data.length - 10;
  
  data.data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = margin.left + (index * (chartWidth / data.data.length)) + 5;
    const y = margin.top + chartHeight - barHeight;
    const color = item.color || colors[index % colors.length];
    
    bars += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
            fill="${color}" stroke="none" rx="2"/>
      <text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" 
            font-family="Arial, sans-serif" font-size="10" fill="#333">
        ${item.value.toFixed(1)}${item.value > 100 ? '' : '%'}
      </text>
    `;
    
    // X-axis labels
    labels += `
      <text x="${x + barWidth/2}" y="${margin.top + chartHeight + 20}" 
            text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#666">
        ${item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label}
      </text>
    `;
  });
  
  // Y-axis ticks
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = (maxValue / tickCount) * i;
    const y = margin.top + chartHeight - (value / maxValue) * chartHeight;
    
    yAxisTicks += `
      <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="#ccc"/>
      <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" 
            font-family="Arial, sans-serif" font-size="10" fill="#666">
        ${value.toFixed(0)}${maxValue > 100 ? '' : '%'}
      </text>
    `;
  }
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .chart-title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #333; }
        .axis-label { font-family: Arial, sans-serif; font-size: 12px; fill: #666; }
      </style>
      ${data.title ? `<text x="${width/2}" y="20" text-anchor="middle" class="chart-title">${data.title}</text>` : ''}
      
      <!-- Y-axis -->
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#ccc"/>
      ${yAxisTicks}
      
      <!-- X-axis -->
      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="#ccc"/>
      
      <!-- Bars -->
      ${bars}
      
      <!-- Labels -->
      ${labels}
      
      ${data.yAxisLabel ? `
        <text x="20" y="${height/2}" text-anchor="middle" class="axis-label" 
              transform="rotate(-90, 20, ${height/2})">
          ${data.yAxisLabel}
        </text>
      ` : ''}
    </svg>
  `;
}

/**
 * Process dashboard data into chart-ready format
 */
export function processTrafficChannels(metrics: any[]): PieChartData {
  const trafficChannels = metrics.filter(m => m.metricName === 'Traffic Channels');
  
  if (trafficChannels.length === 0) return { data: [] };
  
  // Handle Client data format (JSON array in value field)
  const clientTraffic = trafficChannels.find(m => m.sourceType === 'Client');
  if (clientTraffic && typeof clientTraffic.value === 'string') {
    try {
      const channelArray = JSON.parse(clientTraffic.value);
      return {
        title: 'Traffic Channels Distribution',
        data: channelArray.map((channel: any) => ({
          label: channel.channel,
          value: channel.percentage
        }))
      };
    } catch (e) {
      console.warn('Failed to parse client traffic channels:', e);
    }
  }
  
  // Handle individual channel records
  const channelData = trafficChannels
    .filter(m => m.sourceType === 'Client' && m.channel)
    .map(m => ({
      label: m.channel,
      value: typeof m.value === 'number' ? m.value : 0
    }));
    
  return {
    title: 'Traffic Channels Distribution',
    data: channelData
  };
}

/**
 * Process device distribution data
 */
export function processDeviceDistribution(metrics: any[]): PieChartData {
  const deviceMetrics = metrics.filter(m => m.metricName === 'Device Distribution' && m.sourceType === 'Client');
  
  const deviceData = deviceMetrics.map(m => ({
    label: m.deviceType || 'Unknown',
    value: typeof m.value === 'number' ? m.value : 0
  }));
  
  return {
    title: 'Device Distribution',
    data: deviceData
  };
}

/**
 * Process competitor bounce rate data
 */
export function processBounceRateComparison(metrics: any[], competitors: any[]): BarChartData {
  const bounceRateMetrics = metrics.filter(m => m.metricName === 'Bounce Rate');
  
  const chartData = [];
  
  // Add client data
  const clientMetric = bounceRateMetrics.find(m => m.sourceType === 'Client');
  if (clientMetric) {
    chartData.push({
      label: 'Your Site',
      value: typeof clientMetric.value === 'number' ? clientMetric.value : 0,
      color: '#10B981'
    });
  }
  
  // Add competitor data
  const competitorMetrics = bounceRateMetrics.filter(m => m.sourceType === 'Competitor');
  competitorMetrics.forEach(metric => {
    const competitor = competitors.find(c => c.id === metric.competitorId);
    if (competitor) {
      chartData.push({
        label: competitor.name,
        value: typeof metric.value === 'number' ? metric.value : 0,
        color: '#F59E0B'
      });
    }
  });
  
  // Add averages
  const cdAvg = bounceRateMetrics.find(m => m.sourceType === 'CD_Avg');
  if (cdAvg) {
    chartData.push({
      label: 'CD Portfolio',
      value: typeof cdAvg.value === 'number' ? cdAvg.value : 0,
      color: '#3B82F6'
    });
  }
  
  return {
    title: 'Bounce Rate Comparison',
    data: chartData,
    yAxisLabel: 'Bounce Rate (%)'
  };
}