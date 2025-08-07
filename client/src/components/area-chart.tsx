import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { parseMetricValue } from '../utils/metricParser';

// Custom diamond dot component
import { DiamondDot } from './shared/DiamondDot';

interface AreaChartProps {
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

// Generate deterministic seeded random number and temporal variation
import { generateTemporalVariationSync } from '@/utils/chartUtils';

// Generate stable time series data for area chart
interface AreaDataPoint {
  date: string;
  client: number;
  industryAvg: number;
  cdAvg: number;
  [key: string]: string | number;
}

interface CompetitorData {
  id: string;
  label: string;
  value: number;
}

function generateAreaData(
  timePeriod: string, 
  clientData: number, 
  industryAvg: number, 
  cdAvg: number, 
  competitors: CompetitorData[], 
  clientUrl?: string, 
  metricName?: string,
  timeSeriesData?: Record<string, Array<{
    metricName: string;
    value: string | number;
    sourceType: string;
    competitorId?: string;
  }>>,
  periods?: string[]
): AreaDataPoint[] {
  const data: AreaDataPoint[] = [];
  
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
    // Show current quarter months (dynamic)
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    for (let i = 0; i < 3; i++) {
      const quarterMonth = quarterStartMonth + i;
      if (quarterMonth < now.getMonth() + 1) {
        const monthDate = new Date(now.getFullYear(), quarterMonth, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dates.push(`${monthNames[quarterMonth]} ${String(now.getFullYear()).slice(-2)}`);
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
    dates = [months[0], months[2], months[4], months[6], months[8], months[10], months[11]];
  } else {
    // Custom date range - show 6 points ending last month
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 7)); // Weekly
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }

  // Generate temporal variation for "Last Month" to show authentic trends instead of flat lines
  const clientKey = clientUrl || 'Client';
  
  if (timePeriod === "Last Month") {
    // Check if we have authentic timeSeriesData first (from backend daily data grouping)
    if (timeSeriesData && periods && periods.length > 0) {
      // Use authentic timeSeriesData for this metric
      const relevantPeriods = periods.filter(p => timeSeriesData[p]?.some(m => m.metricName === metricName));
      
      if (relevantPeriods.length > 0) {
        // Build authentic data points from timeSeriesData
        relevantPeriods.forEach((period, index) => {
          const periodData = timeSeriesData[period] || [];
          const clientMetric = periodData.find(m => m.metricName === metricName && m.sourceType === 'Client');
          const cdAvgMetric = periodData.find(m => m.metricName === metricName && m.sourceType === 'CD_Avg');
          
          // Create authentic data point
          const point: AreaDataPoint = {
            date: `Period ${index + 1}`,
            client: Number(clientMetric?.value) || 0,
            industryAvg: 0, // No synthetic data for industry
            cdAvg: Number(cdAvgMetric?.value) || 0,
            [clientKey]: Number(clientMetric?.value) || 0,
            'Industry Avg': 0,
            'Clear Digital Clients Avg': Number(cdAvgMetric?.value) || 0,
          };
          
          // Add competitor data
          competitors.forEach(competitor => {
            const competitorMetric = periodData.find(m => 
              m.metricName === metricName && 
              m.sourceType === 'Competitor' && 
              m.competitorId === competitor.id
            );
            point[competitor.label] = Number(competitorMetric?.value) || 0;
          });
          
          data.push(point);
        });
        
        return data; // Return authentic data, skip synthetic fallback
      }
    }
    
    // Fallback: Generate temporal variations for each data source (only if no authentic data)
    const safeMetricName = metricName || 'Unknown Metric';
    const clientVariations = generateTemporalVariationSync(clientData, dates, safeMetricName, `client-${safeMetricName}`);
    const industryVariations = generateTemporalVariationSync(industryAvg, dates, safeMetricName, `industry-${safeMetricName}`);
    const cdVariations = generateTemporalVariationSync(cdAvg, dates, safeMetricName, `cd-${safeMetricName}`);
    
    // Generate competitor variations
    const competitorVariations = competitors.map((competitor, index) => 
      generateTemporalVariationSync(competitor.value || clientData, dates, safeMetricName, `comp-${competitor.id}-${safeMetricName}`)
    );
    
    dates.forEach((date, index) => {
      const point: AreaDataPoint = {
        date,
        client: clientVariations[index],
        industryAvg: industryVariations[index],
        cdAvg: cdVariations[index],
        [clientKey]: clientVariations[index],
        'Industry Avg': industryVariations[index],
        'Clear Digital Clients Avg': cdVariations[index],
      };

      // Add competitor data with temporal variations
      competitors.forEach((competitor, compIndex) => {
        point[competitor.label] = competitorVariations[compIndex][index];
      });

      data.push(point);
    });
  } else {
    // For other time periods, use static values (existing behavior)
    dates.forEach((date, index) => {
      const point: AreaDataPoint = {
        date,
        client: Math.round(clientData * 100) / 100,
        industryAvg: Math.round(industryAvg * 100) / 100,
        cdAvg: Math.round(cdAvg * 100) / 100,
        [clientKey]: Math.round(clientData * 100) / 100,
        'Industry Avg': Math.round(industryAvg * 100) / 100,
        'Clear Digital Clients Avg': Math.round(cdAvg * 100) / 100,
      };

      // Add competitor data with actual values
      competitors.forEach((competitor, compIndex) => {
        const baseValue = competitor.value || clientData;
        point[competitor.label] = Math.round(baseValue * 100) / 100;
      });

      data.push(point);
    });
  }

  return data;
}

export default function SessionDurationAreaChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: AreaChartProps) {
  // Memoize data generation to prevent re-calculation on every render
  const data = useMemo(() => 
    generateAreaData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName, timeSeriesData, periods),
    [timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName, timeSeriesData, periods]
  );

  const clientKey = clientUrl || 'Client';
  
  // Define colors for each area
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

  // Calculate fixed Y-axis domain based on all data
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
  const padding = (maxValue - minValue) * 0.15;
  const yAxisDomain = [Math.max(0, Math.floor(minValue - padding)), Math.ceil(maxValue + padding)];

  // State for toggling areas
  const [visibleAreas, setVisibleAreas] = useState<Record<string, boolean>>(() => {
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

  // Update visible areas whenever competitors change
  useEffect(() => {
    setVisibleAreas(prev => {
      const updated = { ...prev };
      competitors.forEach(comp => {
        if (!(comp.label in updated)) {
          updated[comp.label] = true;
        }
      });
      return updated;
    });
  }, [competitors]);

  // Track if this is the initial render for animation
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleArea = (areaKey: string) => {
    setIsInitialRender(false);
    setVisibleAreas(prev => ({
      ...prev,
      [areaKey]: !prev[areaKey]
    }));
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart 
          data={data} 
          margin={{ top: 20, right: 5, left: 5, bottom: 5 }}
        >
        <defs>
          <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors[clientKey]} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={colors[clientKey]} stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="industryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="cdGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4b5563" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#4b5563" stopOpacity={0.1}/>
          </linearGradient>
          {competitorColors.map((color, index) => (
            <linearGradient key={index} id={`competitorGradient${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.6}/>
              <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
            </linearGradient>
          ))}
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          fontSize={9} 
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          fontSize={9}
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          domain={yAxisDomain}
          tickFormatter={(value) => `${Math.round(value * 10) / 10}min`}
          width={45}
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
                        backgroundColor: entry.color || '#64748b', 
                        marginRight: '6px',
                        borderRadius: '50%'
                      }} 
                    />
                    <span style={{ 
                      fontWeight: entry.name === clientKey ? 'bold' : 'normal',
                      color: entry.name === clientKey ? colors[clientKey] : '#374151'
                    }}>
                      {entry.name}: {Math.round(entry.value * 100) / 100} min
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />

        {/* Client area (primary pink with gradient) */}
        {visibleAreas[clientKey] && (
          <Area 
            type="monotone" 
            dataKey={clientKey} 
            stroke={colors[clientKey]}
            strokeWidth={3}
            fill="url(#clientGradient)"
            dot={{ fill: colors[clientKey], r: 3 }}
            activeDot={{ r: 5, stroke: colors[clientKey], strokeWidth: 2, fill: 'white' }}
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* Industry Average area */}
        {visibleAreas['Industry Avg'] && (
          <Area 
            type="monotone" 
            dataKey="Industry Avg" 
            stroke={colors['Industry Avg']}
            strokeWidth={2}
            fill="url(#industryGradient)"
            dot={(props: any) => {
              const { cx, cy, key, ...restProps } = props;
              return <DiamondDot cx={cx} cy={cy} fill={colors['Industry Avg']} stroke={colors['Industry Avg']} strokeWidth={1} />;
            }}
            strokeDasharray="5 5"
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* Clear Digital Clients Average area */}
        {visibleAreas['Clear Digital Clients Avg'] && (
          <Area 
            type="monotone" 
            dataKey="Clear Digital Clients Avg" 
            stroke={colors['Clear Digital Clients Avg']}
            strokeWidth={2}
            fill="url(#cdGradient)"
            dot={(props: any) => {
              const { cx, cy, key, ...restProps } = props;
              return <DiamondDot cx={cx} cy={cy} fill={colors['Clear Digital Clients Avg']} stroke={colors['Clear Digital Clients Avg']} strokeWidth={1} />;
            }}
            strokeDasharray="8 4"
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* Competitor areas */}
        {competitors.map((competitor, index) => (
          visibleAreas[competitor.label] && (
            <Area 
              key={competitor.id}
              type="monotone" 
              dataKey={competitor.label} 
              stroke={competitorColors[index % competitorColors.length]}
              strokeWidth={2}
              fill={`url(#competitorGradient${index % competitorColors.length})`}
              dot={(props: any) => {
                const { cx, cy, key, ...restProps } = props;
                return <DiamondDot cx={cx} cy={cy} fill={competitorColors[index % competitorColors.length]} stroke={competitorColors[index % competitorColors.length]} strokeWidth={1} />;
              }}
              animationDuration={isInitialRender ? 800 : 0}
            />
          )
        ))}
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-3 pb-1">
        {/* Client checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleAreas[clientKey] || false}
            onChange={() => toggleArea(clientKey)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleAreas[clientKey] ? 'bg-primary border-primary' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleAreas[clientKey] ? colors[clientKey] : 'transparent' }}
          >
            {visibleAreas[clientKey] && (
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
            checked={visibleAreas['Industry Avg']}
            onChange={() => toggleArea('Industry Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleAreas['Industry Avg'] ? 'bg-gray-400 border-gray-400' : 'border-gray-300'
            }`}
          >
            {visibleAreas['Industry Avg'] && (
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
            checked={visibleAreas['Clear Digital Clients Avg']}
            onChange={() => toggleArea('Clear Digital Clients Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleAreas['Clear Digital Clients Avg'] ? 'bg-gray-600 border-gray-600' : 'border-gray-300'
            }`}
          >
            {visibleAreas['Clear Digital Clients Avg'] && (
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
              checked={visibleAreas[competitor.label]}
              onChange={() => toggleArea(competitor.label)}
              className="sr-only"
            />
            <div 
              className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors`}
              style={{ 
                backgroundColor: visibleAreas[competitor.label] ? competitorColors[index % competitorColors.length] : 'transparent',
                borderColor: visibleAreas[competitor.label] ? competitorColors[index % competitorColors.length] : '#d1d5db'
              }}
            >
              {visibleAreas[competitor.label] && (
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