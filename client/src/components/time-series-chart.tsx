import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { generatePeriodLabel, createChartVisibilityState, updateChartVisibilityForCompetitors, generateChartColors, calculateYAxisDomain, generateTemporalVariationSync } from '../utils/chartUtilities';
import { logger } from '@/utils/logger';
import { ChartOptimizer, MemoryOptimizer } from '../utils/frontend-optimizer';
import { parseMetricValue } from '../utils/metricParser';

// Use shared DiamondDot component
import { DiamondDot } from './shared/DiamondDot';

interface TimeSeriesChartProps {
  metricName: string;
  timePeriod: string;
  clientData: number;
  industryAvg: number;
  cdAvg: number;
  clientUrl?: string;
  competitors: Array<{
    id: string;
    label: string;
    value: number;
  }>;
  timeSeriesData?: Record<string, Array<{
    metricName: string;
    value: string | number;
    sourceType: string;
    competitorId?: string;
  }>>;
  periods?: string[];
}



// Generate time series data from database or fallback to current behavior
function generateTimeSeriesData(
  timePeriod: string, 
  clientData: number, 
  industryAvg: number, 
  cdAvg: number, 
  competitors: Array<{ id: string; label: string; value: number }>, 
  clientUrl?: string,
  timeSeriesData?: Record<string, Array<{
    metricName: string;
    value: string | number;
    sourceType: string;
    competitorId?: string;
  }>>,
  periods?: string[],
  metricName?: string
): Array<Record<string, unknown>> {
  // Debug Session Duration timeSeriesData processing
  if (metricName === 'Session Duration' && timeSeriesData && periods) {
    console.log(`🔍 generateTimeSeriesData for Session Duration: timePeriod=${timePeriod}, periods.length=${periods.length}`, {
      timeSeriesDataKeys: Object.keys(timeSeriesData),
      periods: periods
    });
  }
  
  // Only use authentic time-series data - no fallback generation
  if (timeSeriesData && periods && periods.length > 0) {
    return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, metricName, cdAvg);
  }
  
  // For Last Month view, use daily data if available, otherwise show single authentic point
  if (timePeriod === "Last Month" && clientData !== undefined && clientData !== null && !isNaN(clientData)) {
    
    // Check if we have time series data for the last month - this would be daily data
    if (timeSeriesData && periods && periods.length === 1) {
      // Use the existing time series generation but for daily data
      return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, metricName, cdAvg);
    }
    
    // Fallback to single data point for Last Month using dynamic period
    const clientKey = clientUrl || 'democompany.com';
    // Use the actual period from the query instead of hardcoded
    const currentPeriod = periods && periods.length > 0 ? periods[0] : '2025-07';
    const currentMonth = generatePeriodLabel(currentPeriod);
    
    // Convert CD_Avg from decimal to percentage for Bounce Rate, handle undefined/null cases
    const processedCdAvg = (cdAvg !== undefined && cdAvg !== null && !isNaN(cdAvg)) 
      ? (metricName?.includes('Rate') ? cdAvg * 100 : cdAvg)
      : 0;
    

    
    return [{
      date: currentMonth,
      [clientKey]: Number(clientData).toFixed(metricName?.includes('Pages per Session') || metricName?.includes('Sessions per User') ? 1 : 0),
      'Industry Avg': 0, // No synthetic data
      'Clear Digital Clients Avg': Number(processedCdAvg).toFixed(metricName?.includes('Pages per Session') || metricName?.includes('Sessions per User') ? 1 : 0),
      ...competitors.reduce((acc, comp) => ({ ...acc, [comp.label]: 0 }), {})
    }];
  }
  
  // No authentic data available - return empty data rather than fake data
  return [];
}

// Generate real time-series data from database
function generateRealTimeSeriesData(
  timeSeriesData: Record<string, Array<{ metricName: string; value: string | number; sourceType: string; competitorId?: string }>>,
  periods: string[],
  competitors: Array<{ id: string; label: string; value: number }>,
  clientUrl?: string,
  metricName?: string,
  cdAvg?: number
): Array<Record<string, unknown>> {
  
  const data: Array<Record<string, unknown>> = [];
  
  // Generate dynamic period labels based on actual periods (now imported from chartUtilities)
  
  const clientKey = clientUrl || 'Client';
  
  // Debug Session Duration specifically
  if (metricName === 'Session Duration') {
    console.log(`🔍 generateRealTimeSeriesData called for Session Duration with ${periods.length} periods:`, periods);
    console.log(`🔍 timeSeriesData keys:`, Object.keys(timeSeriesData));
  }
  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const relevantData = periodData.filter(m => m.metricName === metricName);
    
    // Debug Session Duration data processing
    if (metricName === 'Session Duration') {
      console.log(`🔍 Period ${period}: Found ${periodData.length} total metrics, ${relevantData.length} Session Duration metrics`);
      if (relevantData.length > 0) {
        console.log(`🔍 Session Duration data for ${period}:`, relevantData);
      }
    }
    

    
    const dataPoint: Record<string, unknown> = {
      date: generatePeriodLabel(period)
    };
    
    // Find and AVERAGE multiple values for each source type (handles filtered metrics properly)
    const clientMetrics = relevantData.filter(m => m.sourceType === 'Client');
    const industryMetrics = relevantData.filter(m => m.sourceType === 'Industry_Avg');
    
    // Calculate averages for each source type
    const avgClient = clientMetrics.length > 0 ? 
      clientMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / clientMetrics.length : 0;
    const avgIndustry = industryMetrics.length > 0 ? 
      industryMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / industryMetrics.length : 0;
    
    // Check if we have CD_Avg metrics in the time series data for this period
    const cdMetrics = relevantData.filter(m => m.sourceType === 'CD_Avg' || m.sourceType === 'CD_Portfolio');
    const avgCD = cdMetrics.length > 0 ? 
      cdMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / cdMetrics.length : (cdAvg || 0);
    
    // Convert CD_Avg from decimal to percentage for Rate metrics
    const processedAvgCD = metricName?.includes('Rate') ? avgCD * 100 : avgCD;
    

    

    
    dataPoint[clientKey] = Math.round(avgClient * 10) / 10;
    dataPoint['Industry Avg'] = Math.round(avgIndustry * 10) / 10;
    dataPoint['Clear Digital Clients Avg'] = Math.round(processedAvgCD * 10) / 10;
    
    // NO COMPETITOR DATA - only show authentic client data
    // Competitors contain synthetic data, so we exclude them to maintain data integrity
    competitors.forEach(competitor => {
      dataPoint[competitor.label] = 0; // Show zero instead of synthetic competitor data
    });
    
    data.push(dataPoint);
  });
  
  return data;
}

// REMOVED: Fallback data generator completely eliminated per user request
// No fake/sample data will ever be generated - only authentic GA4 data or empty state

export default function TimeSeriesChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: TimeSeriesChartProps) {
  

  // ALL HOOKS MUST BE CALLED FIRST - no early returns before hooks
  const data = useMemo(() => 
    generateTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods, metricName),
    [timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods, metricName]
  );

  // Check data validity AFTER all hooks
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  const hasChartData = data && data.length > 0;

  const clientKey = clientUrl || 'Client';
  
  // Define colors for each line
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(var(--color-client))',
    'Industry Avg': 'hsl(var(--color-industry-avg))',
    'Clear Digital Clients Avg': 'hsl(var(--color-cd-avg))',
  };

  // Additional colors for competitors using CSS variables
  const competitorColors = [
    'hsl(var(--color-competitor-1))',
    'hsl(var(--color-competitor-2))', 
    'hsl(var(--color-competitor-3))'
  ];

  // Calculate optimized Y-axis domain based on all data with better scaling
  const allValues: number[] = [];
  data.forEach(point => {
    allValues.push(parseMetricValue(point[clientKey]) || 0, parseMetricValue(point['Industry Avg']) || 0, parseMetricValue(point['Clear Digital Clients Avg']) || 0);
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(parseMetricValue(point[comp.label]) || 0);
      }
    });
  });
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  
  // Always start from 0 for better visual context and comparison
  const padding = maxValue * 0.1; // 10% padding from top
  const yAxisDomain = [0, Math.ceil(maxValue + padding)];

  // State for toggling lines - ensure all competitors are visible by default
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      [clientKey]: true,
      'Industry Avg': true,
      'Clear Digital Clients Avg': true,
    };
    competitors.forEach(comp => {
      initial[comp.label] = true;
    });
    return initial;
  });

  // Update visible lines whenever competitors change to include new ones
  useEffect(() => {
    setVisibleLines(prev => {
      const updated = { ...prev };
      competitors.forEach(comp => {
        if (!(comp.label in updated)) {
          updated[comp.label] = true; // Default new competitors to visible
        }
      });
      return updated;
    });
  }, [competitors]);

  // Track if this is the initial render to allow animation only once
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleLine = (lineKey: string) => {
    setIsInitialRender(false); // Disable animation after first interaction
    setVisibleLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  // Render based on data availability - NO EARLY RETURNS
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📈</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Trend data will appear here once metrics are collected</div>
        </div>
      </div>
    );
  }

  if (!hasChartData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📊</div>
          <div className="text-sm">No authentic data available</div>
          <div className="text-xs text-slate-400 mt-1">Authentic GA4 data will appear here when available</div>
        </div>
      </div>
    );
  }

  // Determine if we should use bar chart for single data point visualization
  const useBars = data.length === 1;

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        {useBars ? (
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              fontSize={9} 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              fontSize={9}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              domain={yAxisDomain}
              tickFormatter={(value) => {
                if (metricName === "Pages per Session" || metricName === "Sessions per User") {
                  return value.toFixed(1);
                }
                return Math.round(value).toString();
              }}
              width={35}
              type="number"
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (!active || !payload || !label) return null;
                
                return (
                  <div style={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                    padding: '8px 12px',
                    fontSize: '12px'
                  }}>
                    <div style={{ color: 'hsl(var(--foreground))', fontWeight: 'medium', fontSize: '11px', marginBottom: '4px' }}>
                      {label}
                    </div>
                    {payload.map((entry: any, index: number) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <div 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            backgroundColor: entry.color, 
                            marginRight: '6px',
                            borderRadius: '50%'
                          }} 
                        />
                        <span style={{ 
                          fontWeight: entry.name === clientKey ? 'bold' : 'normal',
                          color: entry.name === clientKey ? colors[clientKey] : 'hsl(var(--foreground))'
                        }}>
                          {entry.name}: {Math.round(entry.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Pages per Session') ? ' pages' : metricName.includes('Sessions per User') ? ' sessions' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {/* Client bar (primary pink) */}
            {visibleLines[clientKey] && (
              <Bar 
                dataKey={clientKey} 
                fill={colors[clientKey]}
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Industry Average bar */}
            {visibleLines['Industry Avg'] && (
              <Bar 
                dataKey="Industry Avg" 
                fill={colors['Industry Avg']}
                fillOpacity={0.7}
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Clear Digital Clients Average bar */}
            {visibleLines['Clear Digital Clients Avg'] && (
              <Bar 
                dataKey="Clear Digital Clients Avg" 
                fill={colors['Clear Digital Clients Avg']}
                fillOpacity={0.8}
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Competitor bars */}
            {competitors.map((competitor, index) => (
              visibleLines[competitor.label] && (
                <Bar 
                  key={competitor.id}
                  dataKey={competitor.label} 
                  fill={competitorColors[index % competitorColors.length]}
                  fillOpacity={0.6}
                  animationDuration={isInitialRender ? 800 : 0}
                />
              )
            ))}
          </BarChart>
        ) : (
          <LineChart 
            data={data} 
            margin={{ top: 20, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              fontSize={9} 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              fontSize={9}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              domain={yAxisDomain}
              tickFormatter={(value) => {
                if (metricName === "Pages per Session" || metricName === "Sessions per User") {
                  return value.toFixed(1);
                }
                return Math.round(value).toString();
              }}
              width={35}
              type="number"
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (!active || !payload || !label) return null;
                
                return (
                  <div style={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                    padding: '8px 12px',
                    fontSize: '12px'
                  }}>
                    <div style={{ color: 'hsl(var(--foreground))', fontWeight: 'medium', fontSize: '11px', marginBottom: '4px' }}>
                      {label}
                    </div>
                    {payload.map((entry: any, index: number) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <div 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            backgroundColor: entry.color, 
                            marginRight: '6px',
                            borderRadius: '50%'
                          }} 
                        />
                        <span style={{ 
                          fontWeight: entry.name === clientKey ? 'bold' : 'normal',
                          color: entry.name === clientKey ? colors[clientKey] : 'hsl(var(--foreground))'
                        }}>
                          {entry.name}: {Math.round(entry.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Pages per Session') ? ' pages' : metricName.includes('Sessions per User') ? ' sessions' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {/* Client line (primary pink) */}
            {visibleLines[clientKey] && (
              <Line 
                type="monotone" 
                dataKey={clientKey} 
                stroke={colors[clientKey]}
                strokeWidth={3}
                dot={{ fill: colors[clientKey], r: 3 }}
                activeDot={{ r: 5, stroke: colors[clientKey], strokeWidth: 2, fill: 'white' }}
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Industry Average line */}
            {visibleLines['Industry Avg'] && (
              <Line 
                type="monotone" 
                dataKey="Industry Avg" 
                stroke={colors['Industry Avg']}
                strokeWidth={2}
                dot={(props: any) => <DiamondDot {...props} fill={colors['Industry Avg']} stroke={colors['Industry Avg']} strokeWidth={1} />}
                strokeDasharray="5 5"
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Clear Digital Clients Average line */}
            {visibleLines['Clear Digital Clients Avg'] && (
              <Line 
                type="monotone" 
                dataKey="Clear Digital Clients Avg" 
                stroke={colors['Clear Digital Clients Avg']}
                strokeWidth={2}
                dot={(props: any) => <DiamondDot {...props} fill={colors['Clear Digital Clients Avg']} stroke={colors['Clear Digital Clients Avg']} strokeWidth={1} />}
                strokeDasharray="8 4"
                animationDuration={isInitialRender ? 800 : 0}
              />
            )}
            
            {/* Competitor lines */}
            {competitors.map((competitor, index) => (
              visibleLines[competitor.label] && (
                <Line 
                  key={competitor.id}
                  type="monotone" 
                  dataKey={competitor.label} 
                  stroke={competitorColors[index % competitorColors.length]}
                  strokeWidth={2}
                  dot={(props: any) => <DiamondDot {...props} fill={competitorColors[index % competitorColors.length]} stroke={colors[competitorColors[index % competitorColors.length]]} strokeWidth={1} />}
                  animationDuration={isInitialRender ? 800 : 0}
                />
              )
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
      
      {/* Custom Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-3 pb-1">
        {/* Client checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines[clientKey] || false}
            onChange={() => toggleLine(clientKey)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines[clientKey] ? 'bg-primary border-primary' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines[clientKey] ? colors[clientKey] : 'transparent' }}
          >
            {visibleLines[clientKey] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700 font-medium">{clientKey}</span>
        </label>

        {/* Industry Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines['Industry Avg']}
            onChange={() => toggleLine('Industry Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines['Industry Avg'] ? 'border-gray-400' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines['Industry Avg'] ? colors['Industry Avg'] : 'transparent' }}
          >
            {visibleLines['Industry Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">Industry Avg</span>
        </label>

        {/* Clear Digital Clients Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines['Clear Digital Clients Avg']}
            onChange={() => toggleLine('Clear Digital Clients Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines['Clear Digital Clients Avg'] ? 'border-gray-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines['Clear Digital Clients Avg'] ? colors['Clear Digital Clients Avg'] : 'transparent' }}
          >
            {visibleLines['Clear Digital Clients Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">Clear Digital Clients Avg</span>
        </label>

        {/* Competitor checkboxes */}
        {competitors.map((competitor, index) => (
          <label key={competitor.id} className="flex items-center cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={visibleLines[competitor.label]}
              onChange={() => toggleLine(competitor.label)}
              className="sr-only"
            />
            <div 
              className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
                visibleLines[competitor.label] ? 'border-gray-400' : 'border-gray-300'
              }`}
              style={{ 
                backgroundColor: visibleLines[competitor.label] 
                  ? competitorColors[index % competitorColors.length] 
                  : 'transparent' 
              }}
            >
              {visibleLines[competitor.label] && (
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-slate-700">{competitor.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}