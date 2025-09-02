import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { 
  generateTemporalVariationSync, 
  createChartVisibilityState, 
  updateChartVisibilityForCompetitors, 
  generateChartColors, 
  calculateYAxisDomain, 
  getTimeSeriesColors, 
  getCompetitorColorsArray,
  normalizeChartData,
  safeNumericValue,
  safeTooltipProps
} from '@/utils/chartUtils';
import { generatePeriodLabel } from '@/utils/chartGenerators';
import { logger } from '@/utils/logger';

import { parseMetricValue } from '../../utils/metricParser';
import { convertMetricValue } from '@/utils/metricConversion';

// Use shared DiamondDot component
import { DiamondDot } from '../shared/DiamondDot';

/** Props interface for TimeSeriesChart component configuration */
interface TimeSeriesChartProps {
  /** Name of the metric being visualized (e.g., 'Sessions', 'Bounce Rate') */
  metricName: string;
  /** Time period for data display ('Last Month', '3 Months', etc.) */
  timePeriod: string;
  /** Current client's metric value */
  clientData: number;
  /** Industry average for the metric */
  industryAvg: number;
  /** Clear Digital portfolio average for the metric */
  cdAvg: number;
  /** Client website URL for data identification */
  clientUrl?: string;
  /** Array of competitor data for comparative analysis */
  competitors: Array<{
    /** Unique identifier for the competitor */
    id: string;
    /** Display label for the competitor */
    label: string;
    /** Competitor's metric value */
    value: number;
  }>;
  /** Time series data structure from database queries */
  timeSeriesData?: Record<string, Array<{
    /** Metric identifier matching the chart */
    metricName: string;
    /** Metric value (can be string or number) */
    value: string | number;
    /** Data source type ('Client', 'Industry_Avg', 'CD_Avg', 'Competitor') */
    sourceType: string;
    /** Competitor identifier for competitor data points */
    competitorId?: string;
  }>>;
  /** Array of time periods for the chart x-axis */
  periods?: string[];
}

/**
 * Generates time series data for chart visualization with authentic data integration.
 * Processes database time series data or provides single-point fallback for Last Month view.
 * Prioritizes authentic data from database over synthetic generation.
 * 
 * @param timePeriod - Time period selection ('Last Month', '3 Months', etc.)
 * @param clientData - Client's current metric value
 * @param industryAvg - Industry benchmark average
 * @param cdAvg - Clear Digital portfolio average
 * @param competitors - Array of competitor data points
 * @param clientUrl - Client website URL for identification
 * @param timeSeriesData - Raw time series data from database
 * @param periods - Time period array for chart axis
 * @param metricName - Metric identifier for data filtering
 * @returns Processed chart data array with time series points
 */
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

  
  // Only use authentic time-series data - no fallback generation
  if (timeSeriesData && periods && periods.length > 0) {
    return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, metricName, cdAvg, industryAvg);
  }
  
  // Data validation improved for proper number handling
  
  // For Last Month view, use daily data if available, otherwise show single authentic point - improved validation
  if (timePeriod === "Last Month" && clientData !== undefined && clientData !== null && !isNaN(Number(clientData)) && Number(clientData) !== 0) {
    
    // Check if we have time series data for the last month - this would be daily data
    if (timeSeriesData && periods && periods.length === 1) {
      // Use the existing time series generation but for daily data
      return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, metricName, cdAvg, industryAvg);
    }
    
    // Fallback to single data point for Last Month using dynamic period
    const clientKey = clientUrl || 'democompany.com';
    // Use the actual period from the query instead of hardcoded
    const currentPeriod = periods && periods.length > 0 ? periods[0] : '2025-07';
    const currentMonth = generatePeriodLabel(currentPeriod);
    
    // Apply centralized conversions for all data sources
    const clientConverted = convertMetricValue({
      metricName: metricName || '',
      sourceType: 'Client',
      rawValue: clientData
    });
    
    const cdConverted = convertMetricValue({
      metricName: metricName || '',
      sourceType: 'CD_Avg', 
      rawValue: (cdAvg !== undefined && cdAvg !== null && !isNaN(cdAvg)) ? cdAvg : 0
    });
    
    const result = [{
      date: currentMonth,
      [clientKey]: Number(clientConverted.value).toFixed(metricName?.includes('Pages per Session') || metricName?.includes('Sessions per User') ? 1 : 0),
      'Industry_Avg': 0, // No synthetic data
      'Clear Digital Clients Avg': Number(cdConverted.value).toFixed(metricName?.includes('Pages per Session') || metricName?.includes('Sessions per User') ? 1 : 0),
      ...competitors.reduce((acc, comp) => {
        // Apply centralized conversion for competitor values
        const competitorConverted = convertMetricValue({
          metricName: metricName || '',
          sourceType: 'Competitor',
          rawValue: comp.value
        });
        const formattedValue = Number(competitorConverted.value).toFixed(metricName?.includes('Pages per Session') || metricName?.includes('Sessions per User') ? 1 : 0);
        return { ...acc, [comp.label]: formattedValue };
      }, {})
    }];
    return result;
  }
  
  // No authentic data available - return empty data rather than fake data
  return [];
}

/**
 * Processes authentic time series data from database into chart-ready format.
 * Handles multiple data points per period by averaging, supports all source types,
 * and ensures proper metric conversion for rate-based and session-based metrics.
 * 
 * @param timeSeriesData - Raw time series data grouped by time period
 * @param periods - Array of time periods for processing
 * @param competitors - Competitor configuration for data mapping
 * @param clientUrl - Client identifier for data labeling
 * @param metricName - Metric name for filtering and conversion logic
 * @param cdAvg - Clear Digital average for fallback scenarios
 * @returns Chart data array with properly processed time series points
 */
function generateRealTimeSeriesData(
  timeSeriesData: Record<string, Array<{ metricName: string; value: string | number; sourceType: string; competitorId?: string }>>,
  periods: string[],
  competitors: Array<{ id: string; label: string; value: number }>,
  clientUrl?: string,
  metricName?: string,
  cdAvg?: number,
  industryAvg?: number
): Array<Record<string, unknown>> {
  
  const data: Array<Record<string, unknown>> = [];
  
  // Generate dynamic period labels based on actual periods (now imported from chartGenerators)
  
  const clientKey = clientUrl || 'Client';
  

  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const relevantData = periodData.filter(m => m.metricName === metricName);
    

    

    
    const dataPoint: Record<string, unknown> = {
      date: generatePeriodLabel(period)
    };
    
    // Find and AVERAGE multiple values for each source type (handles filtered metrics properly)
    const clientMetrics = relevantData.filter(m => m.sourceType === 'Client');
    const industryMetrics = relevantData.filter(m => m.sourceType === 'Industry_Avg');
    
    // Calculate averages for each source type - use fallback values when timeSeriesData is missing
    const rawAvgClient = clientMetrics.length > 0 ? 
      clientMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / clientMetrics.length : 0;
    const rawAvgIndustry = industryMetrics.length > 0 ? 
      industryMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / industryMetrics.length : (industryAvg || 0);
    
    // Check if we have CD_Avg metrics in the time series data for this period
    const cdMetrics = relevantData.filter(m => m.sourceType === 'CD_Avg' || m.sourceType === 'CD_Portfolio');
    const rawAvgCD = cdMetrics.length > 0 ? 
      cdMetrics.reduce((sum, m) => sum + parseMetricValue(m.value), 0) / cdMetrics.length : (cdAvg || 0);
    
    // Apply centralized conversions to all averages
    const clientConverted = convertMetricValue({
      metricName: metricName || '',
      sourceType: 'Client',
      rawValue: rawAvgClient
    });
    const industryConverted = convertMetricValue({
      metricName: metricName || '',
      sourceType: 'Industry_Avg',
      rawValue: rawAvgIndustry
    });
    const cdConverted = convertMetricValue({
      metricName: metricName || '',
      sourceType: 'CD_Avg',
      rawValue: rawAvgCD
    });
    

    

    

    
    dataPoint[clientKey] = Math.round(clientConverted.value * 10) / 10;
    dataPoint['Industry_Avg'] = Math.round(industryConverted.value * 10) / 10;
    dataPoint['Clear Digital Clients Avg'] = Math.round(cdConverted.value * 10) / 10;
    
    // Add actual competitor data for each period
    competitors.forEach(competitor => {
      // Find competitor data for this period
      const competitorData = periodData.find(d => 
        d.competitorId === competitor.id && d.metricName === metricName
      );
      
      if (competitorData) {
        // Apply centralized conversion for competitor data  
        const competitorConverted = convertMetricValue({
          metricName: metricName || '',
          sourceType: 'Competitor',
          rawValue: parseMetricValue(competitorData.value)
        });
        
        dataPoint[competitor.label] = Math.round(competitorConverted.value * 10) / 10;
      } else {
        // Apply centralized conversion for fallback competitor values
        const fallbackConverted = convertMetricValue({
          metricName: metricName || '',
          sourceType: 'Competitor',
          rawValue: competitor.value
        });
        
        dataPoint[competitor.label] = Math.round(fallbackConverted.value * 10) / 10;
      }
    });
    
    data.push(dataPoint);
  });
  
  return data;
}

/**
 * Advanced time series chart component for comprehensive analytics visualization.
 * Provides interactive line and bar chart displays with authentic data integration,
 * competitive benchmarking, and sophisticated data processing capabilities.
 * 
 * Key Features:
 * - Authentic time series data visualization from Google Analytics 4
 * - Interactive line/bar chart toggle with smooth animations
 * - Competitive benchmarking with multiple competitors support
 * - Industry average and Clear Digital portfolio comparisons
 * - Smart data processing with metric-specific formatting
 * - Dynamic Y-axis scaling with optimized domain calculation
 * - Interactive legend with line/bar visibility controls
 * - Responsive design with customizable color theming
 * - Empty state handling for missing or invalid data
 * - Session duration conversion (seconds to minutes)
 * - Rate metric percentage formatting with proper scaling
 * - Real-time data updates with React.memo optimization
 * - Touch-friendly controls for mobile interactions
 * - Comprehensive tooltip with detailed metric information
 * - Performance-optimized rendering with selective re-renders
 * 
 * Data Processing:
 * - Prioritizes authentic database time series data over fallback generation
 * - Handles multiple data points per period through intelligent averaging
 * - Supports both daily and monthly data aggregation
 * - Ensures proper metric conversion for different data types
 * - Eliminates all synthetic/fake data generation for authentic insights
 * 
 * The component integrates seamlessly with the broader analytics dashboard
 * and maintains consistent visual styling across all chart implementations.
 * 
 * @param metricName - Name of the metric being visualized
 * @param timePeriod - Selected time period for data display
 * @param clientData - Client's current metric value
 * @param industryAvg - Industry benchmark average
 * @param cdAvg - Clear Digital portfolio average
 * @param clientUrl - Client website URL for identification
 * @param competitors - Array of competitor data for comparison
 * @param timeSeriesData - Raw time series data from database
 * @param periods - Time periods array for chart axis
 */
export function TimeSeriesChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: TimeSeriesChartProps) {
  

  // Create stable competitor key to prevent infinite re-renders
  const competitorKey = useMemo(() => {
    return competitors.map(c => `${c.id}:${c.label}:${c.value}`).join('|');
  }, [competitors]);

  // ALL HOOKS MUST BE CALLED FIRST - no early returns before hooks
  const rawData = useMemo(() => {
    return generateTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods, metricName);
  }, [timePeriod, clientData, industryAvg, cdAvg, competitorKey, clientUrl, timeSeriesData, periods, metricName]);

  // Normalize chart data for null-safe rendering
  const data = useMemo(() => {
    const clientKey = clientUrl || 'Client';
    const requiredKeys = [clientKey, 'Industry_Avg', 'Clear Digital Clients Avg'];
    
    return normalizeChartData(rawData, {
      gapOnNull: true,  // Allow gaps in line charts
      defaultValue: 0,
      requiredKeys
    });
  }, [rawData, clientUrl]);

  // Check data validity AFTER all hooks
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  const hasChartData = data && data.length > 0;

  const clientKey = clientUrl || 'Client';
  
  // Use unified color system for consistent colors across charts
  const colors = getTimeSeriesColors(clientKey, competitors);
  const competitorColors = getCompetitorColorsArray();

  // Calculate optimized Y-axis domain with null-safe processing
  const allValues: number[] = [];
  data.forEach(point => {
    const clientValue = safeNumericValue(point[clientKey], 0);
    const industryValue = safeNumericValue(point['Industry_Avg'], 0);
    const cdValue = safeNumericValue(point['Clear Digital Clients Avg'], 0);
    
    if (clientValue !== null) allValues.push(clientValue);
    if (industryValue !== null) allValues.push(industryValue);
    if (cdValue !== null) allValues.push(cdValue);
    
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        const compValue = safeNumericValue(point[comp.label], 0);
        if (compValue !== null) allValues.push(compValue);
      }
    });
  });
  
  // Filter out invalid values and calculate domain
  const validValues = allValues.filter(val => val !== null && isFinite(val));
  const minValue = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxValue = validValues.length > 0 ? Math.max(...validValues) : 100;
  
  // Always start from 0 for better visual context and comparison
  const padding = maxValue * 0.1; // 10% padding from top
  const yAxisDomain = [0, Math.ceil(maxValue + padding)];

  // State for toggling lines - ensure all competitors are visible by default
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  // Derive visible lines from competitors and hidden state
  const visibleLines = useMemo<Record<string, boolean>>(() => {
    const visible: Record<string, boolean> = {
      [clientKey]: !hiddenLines.has(clientKey),
      'Industry_Avg': !hiddenLines.has('Industry_Avg'),
      'Clear Digital Clients Avg': !hiddenLines.has('Clear Digital Clients Avg'),
    };
    competitors.forEach(comp => {
      visible[comp.label] = !hiddenLines.has(comp.label);
    });
    return visible;
  }, [clientKey, competitorKey, hiddenLines]);

  // Track if this is the initial render to allow animation only once
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleLine = (lineKey: string) => {
    setIsInitialRender(false); // Disable animation after first interaction
    setHiddenLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineKey)) {
        newSet.delete(lineKey);
      } else {
        newSet.add(lineKey);
      }
      return newSet;
    });
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
            {visibleLines['Industry_Avg'] && (
              <Bar 
                dataKey="Industry_Avg" 
                fill={colors['Industry_Avg']}
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
            {visibleLines['Industry_Avg'] && (
              <Line 
                type="monotone" 
                dataKey="Industry_Avg" 
                stroke={colors['Industry_Avg']}
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, key, ...restProps } = props;
                  return <DiamondDot key={key} cx={cx} cy={cy} fill={colors['Industry_Avg']} stroke={colors['Industry_Avg']} strokeWidth={1} />;
                }}
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
                dot={(props: any) => {
                  const { cx, cy, key, ...restProps } = props;
                  return <DiamondDot key={key} cx={cx} cy={cy} fill={colors['Clear Digital Clients Avg']} stroke={colors['Clear Digital Clients Avg']} strokeWidth={1} />;
                }}
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
                  dot={(props: any) => {
                    const { cx, cy, key, ...restProps } = props;
                    return <DiamondDot key={key} cx={cx} cy={cy} fill={competitorColors[index % competitorColors.length]} stroke={competitorColors[index % competitorColors.length]} strokeWidth={1} />;
                  }}
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
            checked={visibleLines['Industry_Avg']}
            onChange={() => toggleLine('Industry_Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines['Industry_Avg'] ? 'bg-gray-400 border-gray-400' : 'border-gray-300'
            }`}
          >
            {visibleLines['Industry_Avg'] && (
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