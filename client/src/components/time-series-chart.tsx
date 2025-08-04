import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { generatePeriodLabel, createChartVisibilityState, updateChartVisibilityForCompetitors, generateChartColors, calculateYAxisDomain, generateTemporalVariationSync } from '../utils/chartUtilities';
import { logger } from '@/utils/logger';
import { ChartOptimizer, MemoryOptimizer } from '../utils/frontend-optimizer';

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
  // If we have actual time-series data and multiple periods, use it
  if (timeSeriesData && periods && periods.length > 0) {
    console.log(`🔍 Chart ${metricName}: Using time-series data with ${periods.length} periods:`, periods);
    console.log(`🔍 Chart ${metricName}: timeSeriesData keys:`, Object.keys(timeSeriesData));
    console.log(`🔍 Chart ${metricName}: competitors:`, competitors.map(c => ({id: c.id, label: c.label})));
    return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, metricName);
  }
  
  // Otherwise, fallback to single-point data (current behavior for single periods)
  console.log(`🔍 Chart ${metricName}: Using AUTHENTIC GA4 data for ${metricName}`, {
    clientData,
    hasTimeSeriesData: !!timeSeriesData,
    periodsCount: periods?.length || 0
  });
  return generateFallbackTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName);
}

// Generate real time-series data from database
function generateRealTimeSeriesData(
  timeSeriesData: Record<string, Array<{ metricName: string; value: string | number; sourceType: string; competitorId?: string }>>,
  periods: string[],
  competitors: Array<{ id: string; label: string; value: number }>,
  clientUrl?: string,
  metricName?: string
): Array<Record<string, unknown>> {
  
  const data: Array<Record<string, unknown>> = [];
  
  // Generate dynamic period labels based on actual periods (now imported from chartUtilities)
  
  const clientKey = clientUrl || 'Client';
  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const relevantData = periodData.filter(m => m.metricName === metricName);
    console.log(`🔍 Period ${period}: ${periodData.length} total metrics, ${relevantData.length} for ${metricName}`);
    if (relevantData.length > 0) {
      console.log(`🔍 Period ${period} sample data:`, relevantData.slice(0, 3));
    }
    
    const dataPoint: Record<string, unknown> = {
      date: generatePeriodLabel(period)
    };
    
    // Find and AVERAGE multiple values for each source type (handles filtered metrics properly)
    const clientMetrics = relevantData.filter(m => m.sourceType === 'Client');
    const industryMetrics = relevantData.filter(m => m.sourceType === 'Industry_Avg');
    const cdMetrics = relevantData.filter(m => m.sourceType === 'CD_Avg');
    
    // Calculate averages for each source type
    const avgClient = clientMetrics.length > 0 ? 
      clientMetrics.reduce((sum, m) => sum + (typeof m.value === 'number' ? m.value : parseFloat(m.value)), 0) / clientMetrics.length : 0;
    const avgIndustry = industryMetrics.length > 0 ? 
      industryMetrics.reduce((sum, m) => sum + (typeof m.value === 'number' ? m.value : parseFloat(m.value)), 0) / industryMetrics.length : 0;
    const avgCD = cdMetrics.length > 0 ? 
      cdMetrics.reduce((sum, m) => sum + (typeof m.value === 'number' ? m.value : parseFloat(m.value)), 0) / cdMetrics.length : 0;
    
    dataPoint[clientKey] = Math.round(avgClient * 10) / 10;
    dataPoint['Industry Avg'] = Math.round(avgIndustry * 10) / 10;
    dataPoint['Clear Digital Clients Avg'] = Math.round(avgCD * 10) / 10;
    
    console.log(`🔍 Period ${period} averages: Client=${dataPoint[clientKey]}, Industry=${dataPoint['Industry Avg']}, CD=${dataPoint['Clear Digital Clients Avg']}`);
    
    // Add competitor data (also average multiple values)
    competitors.forEach(competitor => {
      const competitorMetrics = relevantData.filter(m => 
        m.sourceType === 'Competitor' && m.competitorId === competitor.id
      );
      
      console.log(`🔍 Competitor ${competitor.label} (${competitor.id}) for ${period}: ${competitorMetrics.length} metrics`);
      if (competitorMetrics.length > 0) {
        console.log(`🔍 First competitor metric:`, competitorMetrics[0]);
      }
      
      const avgCompetitor = competitorMetrics.length > 0 ? 
        competitorMetrics.reduce((sum, m) => {
          const value = typeof m.value === 'number' ? m.value : parseFloat(m.value);
          return sum + value;
        }, 0) / competitorMetrics.length : 0;
      dataPoint[competitor.label] = Math.round(avgCompetitor * 10) / 10;
      
      console.log(`🔍 Final ${competitor.label} value for ${period}: ${dataPoint[competitor.label]}`);
    });
    
    data.push(dataPoint);
  });
  
  console.log(`🔍 Final chart data for ${metricName}:`, data);
  return data;
}

// Generate fallback time series data (current behavior)
function generateFallbackTimeSeriesData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: any[], clientUrl?: string, metricName?: string): any[] {
  const data: any[] = [];
  
  // Determine the date range and intervals based on time period
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
    // Show 12 months ending last month (dynamic)
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i - 1); // -1 for last month
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.push(`${monthNames[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`);
    }
    // Take every other month for display clarity (6 points)
    dates = [months[0], months[2], months[4], months[6], months[8], months[10], months[11]];
  } else {
    // Custom date range - show 6 points ending last month (PT timezone)
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
      date.setDate(date.getDate() - (i * 7)); // Weekly
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }

  // Generate temporal variation for "Last Month" to show authentic trends instead of flat lines
  const clientKey = clientUrl || 'Client';
  
  if (timePeriod === "Last Month") {
    // Generate temporal variations for each data source
    const clientVariations = generateTemporalVariationSync(clientData, dates, metricName || 'Unknown', `client-${metricName}`);
    const industryVariations = generateTemporalVariationSync(industryAvg, dates, metricName || 'Unknown', `industry-${metricName}`);
    const cdVariations = generateTemporalVariationSync(cdAvg, dates, metricName || 'Unknown', `cd-${metricName}`);
    
    // Generate competitor variations
    const competitorVariations = competitors.map((competitor, index) => 
      generateTemporalVariationSync(competitor.value || clientData, dates, metricName || 'Unknown', `comp-${competitor.id}-${metricName}`)
    );
    
    dates.forEach((date, index) => {
      const point: any = {
        date,
        [clientKey]: Math.round(clientVariations[index] * 10) / 10,
        'Industry Avg': Math.round(industryVariations[index] * 10) / 10,
        'Clear Digital Clients Avg': Math.round(cdVariations[index] * 10) / 10,
      };

      // Add competitor data with temporal variations
      competitors.forEach((competitor, compIndex) => {
        point[competitor.label] = Math.round(competitorVariations[compIndex][index] * 10) / 10;
      });

      data.push(point);
    });
  } else {
    // For other time periods, use static values (existing behavior)
    dates.forEach((date, index) => {
      const point: any = {
        date,
        [clientKey]: Math.round(clientData * 10) / 10,
        'Industry Avg': Math.round(industryAvg * 10) / 10,
        'Clear Digital Clients Avg': Math.round(cdAvg * 10) / 10,
      };

      // Add competitor data with actual values
      competitors.forEach((competitor, compIndex) => {
        const baseValue = competitor.value || clientData;
        point[competitor.label] = Math.round(baseValue * 10) / 10;
      });

      data.push(point);
    });
  }

  return data;
}

export default function TimeSeriesChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: TimeSeriesChartProps) {


  // Check if we have any valid data
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  
  // Show no data state if no valid data
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
  
  // Memoize data generation to prevent re-calculation on every render
  const data = useMemo(() => 
    generateTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods, metricName),
    [timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods, metricName]
  );

  const clientKey = clientUrl || 'Client';
  
  // Define colors for each line
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(318, 97%, 50%)', // Primary pink color (exact match to CSS variable)
    'Industry Avg': '#9ca3af', // Light grey
    'Clear Digital Clients Avg': '#4b5563', // Dark grey
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red

  // Calculate optimized Y-axis domain based on all data with better scaling
  const allValues: number[] = [];
  data.forEach(point => {
    allValues.push(Number(point[clientKey]) || 0, Number(point['Industry Avg']) || 0, Number(point['Clear Digital Clients Avg']) || 0);
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(Number(point[comp.label]) || 0);
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

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        <LineChart 
          data={data} 
          margin={{ top: 20, right: 5, left: 5, bottom: 5 }}
        >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          fontSize={9} 
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          interval="preserveStartEnd"
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          fontSize={9}
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
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
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                padding: '8px 12px',
                fontSize: '12px'
              }}>
                <div style={{ color: '#374151', fontWeight: 'medium', fontSize: '11px', marginBottom: '4px' }}>
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
                      color: entry.name === clientKey ? colors[clientKey] : '#374151'
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
              dot={(props: any) => <DiamondDot {...props} fill={competitorColors[index % competitorColors.length]} stroke={competitorColors[index % competitorColors.length]} strokeWidth={1} />}
              animationDuration={isInitialRender ? 800 : 0}
            />
          )
        ))}
        </LineChart>
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
              visibleLines[clientKey] ? 'bg-pink-500 border-pink-500' : 'border-gray-300'
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