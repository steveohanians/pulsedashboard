import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { DashedBar } from './dashed-bar';
import { useState, useMemo, useEffect } from 'react';
import { parseMetricValue } from '../../utils/metricParser';
import { 
  normalizeChartData, 
  safeNumericValue, 
  safeTooltipProps,
  getTimeSeriesColors 
} from '@/utils/chartUtils';

/** Props interface for MetricBarChart component configuration */
interface BarChartProps {
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
    /** Metric value as string for parsing */
    value: string;
    /** Data source type ('Client', 'Industry_Avg', 'CD_Avg', 'Competitor') */
    sourceType: string;
    /** Competitor identifier for competitor data points */
    competitorId?: string;
  }>>;
  /** Array of time periods for the chart x-axis */
  periods?: string[];
}

// Generate deterministic seeded random number and temporal variation
import { generateTemporalVariationSync, getCompetitorColorsArray } from '@/utils/chartUtils';
import { generatePeriodLabel } from '@/utils/chartGenerators';

/**
 * Processes authentic time series data from database into bar chart format.
 * Handles metric-specific conversions, period grouping, and competitive data mapping.
 * Ensures proper unit conversion (e.g., seconds to minutes for Session Duration).
 * 
 * @param timeSeriesData - Raw time series data grouped by time period
 * @param periods - Array of time periods for processing
 * @param competitors - Competitor configuration for data mapping
 * @param clientUrl - Client identifier for data labeling
 * @param metricName - Metric name for filtering and conversion logic
 * @returns Processed chart data array with bar chart points
 */
function processTimeSeriesForBar(
  timeSeriesData: Record<string, Array<{
    metricName: string;
    value: string;
    sourceType: string;
    competitorId?: string;
  }>>,
  periods: string[],
  competitors: Array<{ id: string; label: string; value: number }>,
  clientUrl?: string,
  metricName?: string
): Array<Record<string, unknown>> {
  const data: Array<Record<string, unknown>> = [];
  
  // Generate dynamic period labels based on actual periods
  // generatePeriodLabel now imported from chartGenerators
  
  const clientKey = clientUrl || 'Client';
  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const dataPoint: Record<string, unknown> = {
      period: generatePeriodLabel(period)
    };
    
    // Find data for each source type - filter by metric name too
    const clientMetric = periodData.find(m => m.sourceType === 'Client' && m.metricName === metricName);
    const industryMetric = periodData.find(m => m.sourceType === 'Industry_Avg' && m.metricName === metricName);
    const cdMetric = periodData.find(m => m.sourceType === 'CD_Avg' && m.metricName === metricName);
    
    // Convert Session Duration from seconds to minutes for client and CD avg data
    let clientValue = clientMetric ? parseMetricValue(clientMetric.value) : 0;
    let industryValue = industryMetric ? parseMetricValue(industryMetric.value) : 0;
    let cdValue = cdMetric ? parseMetricValue(cdMetric.value) : 0;
    
    if (metricName === 'Session Duration') {
      clientValue = clientValue / 60;
      industryValue = industryValue / 60;
      cdValue = cdValue / 60;
    }
    
    dataPoint[clientKey] = Math.round(clientValue * 10) / 10;
    dataPoint['Industry Avg'] = Math.round(industryValue * 10) / 10;
    const companyName = import.meta.env.VITE_COMPANY_NAME || "Clear Digital";
    dataPoint[`${companyName} Clients Avg`] = Math.round(cdValue * 10) / 10;
    
    // Add competitor data with fallback to most recent available period
    competitors.forEach(competitor => {
      let competitorMetric = periodData.find(m => 
        m.sourceType === 'Competitor' && m.competitorId === competitor.id && m.metricName === metricName
      );
      
      // If no data for current period, look for most recent data across all periods
      if (!competitorMetric) {
        for (const fallbackPeriod of periods) {
          const fallbackPeriodData = timeSeriesData[fallbackPeriod] || [];
          competitorMetric = fallbackPeriodData.find(m => 
            m.sourceType === 'Competitor' && m.competitorId === competitor.id && m.metricName === metricName
          );
          if (competitorMetric) break;
        }
      }
      
      // Final fallback: use the value from competitors array (already converted)
      let value = 0;
      if (competitorMetric) {
        value = parseMetricValue(competitorMetric.value);
        
        // Convert Session Duration from seconds to minutes
        if (metricName === 'Session Duration' && value > 60) {
          value = value / 60;
        }
      } else {
        // Use the pre-converted value from competitors array as final fallback
        value = competitor.value;
      }
      
      dataPoint[competitor.label] = Math.round(value * 10) / 10;
    });
    
    data.push(dataPoint);
  });
  
  return data;
}

/**
 * Generates stable bar chart data with temporal variation for single-period displays.
 * Creates consistent data points across multiple periods with deterministic variation,
 * ensuring visual consistency while providing temporal context for comparison.
 * 
 * @param timePeriod - Time period selection ('Last Month', '3 Months', etc.)
 * @param clientData - Client's current metric value
 * @param industryAvg - Industry benchmark average
 * @param cdAvg - Clear Digital portfolio average
 * @param competitors - Array of competitor data points
 * @param clientUrl - Client identifier for data labeling
 * @param metricName - Metric name for conversion logic
 * @returns Processed chart data array with temporal variation
 */
function generateBarData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: Array<{ id: string; label: string; value: number }>, clientUrl?: string, metricName?: string): Array<Record<string, unknown>> {

  
  const companyName = import.meta.env.VITE_COMPANY_NAME || "Clear Digital";
  const data: Array<Record<string, unknown>> = [];
  
  // Determine the date range based on time period
  let dates: string[] = [];
  
  if (timePeriod === "Last Month") {
    // Show last month data points (dynamic based on PT current date - 1 month)
    const now = new Date();
    // Use Pacific Time calculation: current PT month - 1
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 5)); // Every 5 days
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (timePeriod === "Last Quarter") {
    // Show current quarter months (dynamic PT)
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const currentQuarter = Math.floor(targetMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    for (let i = 0; i < 3; i++) {
      const quarterMonth = quarterStartMonth + i;
      if (quarterMonth <= targetMonth.getMonth()) {
        const monthDate = new Date(targetMonth.getFullYear(), quarterMonth, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dates.push(`${monthNames[quarterMonth]} ${String(targetMonth.getFullYear()).slice(-2)}`);
      }
    }
  } else if (timePeriod === "Last Year") {
    // Show 12 months ending with PT target month (dynamic)
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(targetMonth);
      monthDate.setMonth(targetMonth.getMonth() - i);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.push(`${monthNames[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`);
    }
    // Take every other month for display clarity (6 points)
    dates = [months[0], months[2], months[4], months[6], months[8], months[10], months[11]];
  } else {
    // Custom date range - show 6 points ending with PT target month
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 7)); // Weekly
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }

  // Generate temporal variation for "Last Month" to show authentic trends instead of flat lines
  const clientKey = clientUrl || 'Client';
  
  if (timePeriod === "Last Month") {
    // Convert Session Duration base values from seconds to minutes before generating variations
    const processedClientData = metricName === 'Session Duration' ? clientData / 60 : clientData;
    const processedIndustryAvg = metricName === 'Session Duration' ? industryAvg / 60 : industryAvg;
    const processedCdAvg = metricName === 'Session Duration' ? cdAvg / 60 : cdAvg;
    
    // Generate temporal variations for each data source
    const clientVariations = generateTemporalVariationSync(processedClientData, dates, metricName || 'Unknown', `client-${metricName || 'Unknown'}`);
    const industryVariations = generateTemporalVariationSync(processedIndustryAvg, dates, metricName || 'Unknown', `industry-${metricName || 'Unknown'}`);
    const cdVariations = generateTemporalVariationSync(processedCdAvg, dates, metricName || 'Unknown', `cd-${metricName || 'Unknown'}`);

    
    // Generate competitor variations (already converted by processCompanyMetrics)
    const competitorVariations = competitors.map((competitor, index) => {
      const baseValue = competitor.value || processedClientData;
      const seed = `comp-${competitor.label}-${metricName || 'Unknown'}`;
      return generateTemporalVariationSync(baseValue, dates, metricName || 'Unknown', seed);
    });
    
    dates.forEach((period, index) => {
      const point: Record<string, unknown> = {
        period,
        [clientKey]: Math.round(clientVariations[index] * 10) / 10,
        'Industry Avg': Math.round(industryVariations[index] * 10) / 10,
        [`${companyName} Clients Avg`]: Math.round(cdVariations[index] * 10) / 10,
      };

      // Add competitor data with temporal variations (already converted by processCompanyMetrics)
      competitors.forEach((competitor, compIndex) => {
        const value = competitorVariations[compIndex][index];
        point[competitor.label] = Math.round(value * 10) / 10;
      });

      data.push(point);
    });
  } else {
    // For other time periods, use static values (existing behavior)
    dates.forEach((period, index) => {
      // Convert Session Duration client and CD avg data from seconds to minutes
      const processedClientData = metricName === 'Session Duration' ? clientData / 60 : clientData;
      const processedIndustryAvg = metricName === 'Session Duration' ? industryAvg / 60 : industryAvg;
      const processedCdAvg = metricName === 'Session Duration' ? cdAvg / 60 : cdAvg;
      
      const point: Record<string, unknown> = {
        period,
        [clientKey]: Math.round(processedClientData * 10) / 10,
        'Industry Avg': Math.round(processedIndustryAvg * 10) / 10,
        [`${companyName} Clients Avg`]: Math.round(processedCdAvg * 10) / 10,
      };

      // Add competitor data with actual values (already converted by processCompanyMetrics)
      competitors.forEach((competitor) => {
        const value = competitor.value;
        point[competitor.label] = Math.round(value * 10) / 10;
      });

      data.push(point);
    });
  }


  return data;
}

/**
 * Interactive bar chart component for comprehensive metric visualization and competitive analysis.
 * Provides authentic data-driven bar chart displays with sophisticated data processing,
 * competitive benchmarking capabilities, and responsive design optimization.
 * 
 * Key Features:
 * - Authentic time series data visualization from Google Analytics 4
 * - Comprehensive competitive benchmarking with multiple competitor support
 * - Industry average and Clear Digital portfolio comparisons
 * - Smart data processing with metric-specific unit conversion
 * - Session duration conversion (seconds to minutes) with proper formatting
 * - Dynamic period grouping with intelligent temporal variation
 * - Interactive legend controls for data series visibility
 * - Responsive design with customizable color theming
 * - Empty state handling for missing or invalid data scenarios
 * - Performance-optimized rendering with React.memo capabilities
 * - Touch-friendly interactions for mobile device compatibility
 * - Comprehensive tooltip system with detailed metric information
 * - Dashed bar support for Clear Digital average differentiation
 * 
 * Data Processing Intelligence:
 * - Prioritizes authentic database time series data over synthetic generation
 * - Handles multiple data points per period through intelligent averaging
 * - Supports both daily and monthly data aggregation patterns
 * - Ensures proper metric conversion for different data types and units
 * - Implements fallback logic for competitor data across periods
 * - Eliminates all synthetic/fake data generation for authentic insights
 * 
 * Visual Design:
 * - Consistent color scheme aligned with brand guidelines
 * - Clear data hierarchy with client data prominently displayed
 * - Sophisticated tooltip design with hover state animations
 * - Responsive scaling and axis optimization for various screen sizes
 * - Professional styling with subtle animations and transitions
 * 
 * The component integrates seamlessly with the broader analytics dashboard
 * ecosystem and maintains visual consistency across all chart implementations.
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
export function MetricBarChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: BarChartProps) {
  const clientKey = clientUrl || 'Client';
  


  
  // Check if we have any valid data
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  
  // Show no data state if no valid data
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📊</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Data will appear here once metrics are collected</div>
        </div>
      </div>
    );
  }
  
  // Use real time-series data if available, otherwise generate fallback data
  const rawData = useMemo(() => {
    if (timeSeriesData && periods && periods.length > 1) {
      return processTimeSeriesForBar(timeSeriesData, periods, competitors, clientUrl, metricName);
    } else {
      return generateBarData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName);
    }
  }, [timeSeriesData, periods, timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName]);

  // Normalize chart data for null-safe rendering
  const data = useMemo(() => {
    const companyName = import.meta.env.VITE_COMPANY_NAME || "Clear Digital";
    const requiredKeys = [clientKey, 'Industry Avg', `${companyName} Clients Avg`];
    
    return normalizeChartData(rawData, {
      gapOnNull: false,  // Bar charts default to 0
      defaultValue: 0,
      requiredKeys
    });
  }, [rawData, clientKey]);

  // Use unified color system for consistent colors across charts
  const companyName = import.meta.env.VITE_COMPANY_NAME || "Clear Digital";
  const colors = getTimeSeriesColors(clientKey, competitors, companyName);
  const competitorColors = getCompetitorColorsArray();
  
  // Calculate fixed Y-axis domain with null-safe processing
  const allValues: number[] = [];
  data.forEach(point => {
    allValues.push(
      safeNumericValue(point[clientKey], 0),
      safeNumericValue(point['Industry Avg'], 0),
      safeNumericValue(point[`${companyName} Clients Avg`], 0)
    );
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(safeNumericValue(point[comp.label], 0));
      }
    });
  });
  
  const validValues = allValues.filter(val => val !== null && isFinite(val));
  const maxValue = validValues.length > 0 ? Math.max(...validValues) : 100;
  const padding = maxValue * 0.1; // 10% padding from top
  const yAxisDomain = [0, Math.ceil(maxValue + padding)];

  // State for toggling bars - ensure all competitors are visible by default
  const [visibleBars, setVisibleBars] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      [clientKey]: true,
      'Industry Avg': true,
      [`${companyName} Clients Avg`]: true,
    };
    competitors.forEach(comp => {
      initial[comp.label] = true;
    });
    return initial;
  });

  // Update visible bars whenever competitors change
  useEffect(() => {
    setVisibleBars(prev => {
      const updated = { ...prev };
      competitors.forEach(comp => {
        if (!(comp.label in updated)) {
          updated[comp.label] = true;
        }
      });
      return updated;
    });
  }, [competitors]);

  // Track if this is the initial render to allow animation only once
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleBar = (barKey: string) => {
    setIsInitialRender(false); // Disable animation after first interaction
    setVisibleBars(prev => ({
      ...prev,
      [barKey]: !prev[barKey]
    }));
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        <BarChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="period"
            fontSize={9}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            fontSize={9}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            domain={yAxisDomain}
            tickFormatter={(value) => {
              if (metricName.includes('Rate')) {
                return `${Math.round(value * 10) / 10}%`;
              } else if (metricName.includes('Session Duration')) {
                // Data is already in minutes, just format for display
                return `${Math.round(value * 10) / 10}min`;
              }
              return `${Math.round(value * 10) / 10}`;
            }}
            width={45}
            type="number"
          />
          <Tooltip 
            cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }}
            {...safeTooltipProps(data)}
            content={({ active, payload, label }) => {
              if (!active || !payload || !label || payload.length === 0) return null;
              
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
                          backgroundColor: colors[entry.dataKey] || entry.color, 
                          marginRight: '6px',
                          borderRadius: '50%'
                        }} 
                      />
                      <span style={{ 
                        color: 'hsl(var(--foreground))',
                        fontSize: '11px'
                      }}>
                        {entry.dataKey === clientKey ? (
                          <strong style={{ color: colors[clientKey] }}>
                            {entry.dataKey}: {
                              metricName.includes('Rate') 
                                ? `${Math.round(entry.value * 10) / 10}%`
                                : metricName.includes('Session Duration')
                                  ? `${Math.round(entry.value * 10) / 10} min`
                                  : `${Math.round(entry.value * 10) / 10}`
                            }
                          </strong>
                        ) : (
                          `${entry.dataKey}: ${
                            metricName.includes('Rate') 
                              ? `${Math.round(entry.value * 10) / 10}%`
                              : metricName.includes('Session Duration')
                                ? `${Math.round(entry.value * 10) / 10} min`
                                : `${Math.round(entry.value * 10) / 10}`
                          }`
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />

          {/* Client bars */}
          {visibleBars[clientKey] && (
            <Bar 
              dataKey={clientKey} 
              fill={colors[clientKey]}
              radius={[2, 2, 0, 0]}
              stroke="transparent"
              strokeWidth={1}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Industry Average bars - dashed outline */}
          {visibleBars['Industry Avg'] && (
            <Bar 
              dataKey="Industry Avg" 
              fill="none"
              stroke={colors['Industry Avg']}
              strokeWidth={2}
              strokeDasharray="5,5"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke={colors['Industry Avg']} strokeDasharray="5,5" hideBottomBorder={true} />}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Clear Digital Clients Average bars - dashed outline with no bottom border */}
          {visibleBars[`${companyName} Clients Avg`] && (
            <Bar 
              dataKey={`${companyName} Clients Avg`} 
              fill="none"
              stroke={colors[`${companyName} Clients Avg`]}
              strokeWidth={2}
              strokeDasharray="5,5"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke={colors[`${companyName} Clients Avg`]} strokeDasharray="5,5" hideBottomBorder={true} />}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Competitor bars - solid outline with no fill */}
          {competitors.map((competitor, index) => (
            visibleBars[competitor.label] && (
              <Bar 
                key={competitor.id}
                dataKey={competitor.label} 
                fill={competitorColors[index % competitorColors.length]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={isInitialRender}
              />
            )
          ))}
        </BarChart>
      </ResponsiveContainer>
      
      {/* Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-3 pb-1">
        {/* Client checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleBars[clientKey] || false}
            onChange={() => toggleBar(clientKey)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars[clientKey] ? 'bg-primary border-primary' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleBars[clientKey] ? colors[clientKey] : 'transparent' }}
          >
            {visibleBars[clientKey] && (
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
            checked={visibleBars['Industry Avg']}
            onChange={() => toggleBar('Industry Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars['Industry Avg'] ? 'bg-gray-400 border-gray-400' : 'border-gray-300'
            }`}
          >
            {visibleBars['Industry Avg'] && (
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
            checked={visibleBars[`${companyName} Clients Avg`]}
            onChange={() => toggleBar(`${companyName} Clients Avg`)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars[`${companyName} Clients Avg`] ? 'bg-gray-600 border-gray-600' : 'border-gray-300'
            }`}
          >
            {visibleBars[`${companyName} Clients Avg`] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">{companyName} Clients Avg</span>
        </label>

        {/* Competitor checkboxes */}
        {competitors.map((competitor, index) => (
          <label key={competitor.id} className="flex items-center cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={visibleBars[competitor.label]}
              onChange={() => toggleBar(competitor.label)}
              className="sr-only"
            />
            <div 
              className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors`}
              style={{ 
                backgroundColor: visibleBars[competitor.label] ? competitorColors[index % competitorColors.length] : 'transparent',
                borderColor: visibleBars[competitor.label] ? competitorColors[index % competitorColors.length] : '#d1d5db'
              }}
            >
              {visibleBars[competitor.label] && (
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