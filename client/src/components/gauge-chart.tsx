import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GaugeChartProps {
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
}

export default function MetricGaugeChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors }: GaugeChartProps) {
  const clientKey = clientUrl || 'Client';
  
  // Calculate gauge ranges (assuming bounce rate where lower is better)
  const maxValue = metricName.includes('Rate') ? 100 : Math.max(clientData, industryAvg, cdAvg, ...competitors.map(c => c.value)) * 1.2;
  const isLowerBetter = metricName.includes('Bounce Rate');
  
  // Define performance zones
  const excellent = isLowerBetter ? maxValue * 0.3 : maxValue * 0.8;
  const good = isLowerBetter ? maxValue * 0.5 : maxValue * 0.6;
  const poor = maxValue;
  
  // Create gauge data
  const gaugeData = [
    { name: 'Excellent', value: excellent, fill: '#10b981' }, // Green
    { name: 'Good', value: good - excellent, fill: '#f59e0b' }, // Yellow
    { name: 'Poor', value: poor - good, fill: '#ef4444' }, // Red
    { name: 'Empty', value: maxValue * 0.5, fill: 'transparent' } // Bottom half
  ];
  
  // Calculate needle angle based on client value
  const needleAngle = (clientData / maxValue) * 180 - 90;
  
  // Needle component
  const Needle = ({ cx, cy, angle }: { cx: number; cy: number; angle: number }) => {
    const length = 60;
    const x2 = cx + length * Math.cos((angle * Math.PI) / 180);
    const y2 = cy + length * Math.sin((angle * Math.PI) / 180);
    
    return (
      <g>
        <line
          x1={cx}
          y1={cy}
          x2={x2}
          y2={y2}
          stroke="hsl(318, 97%, 50%)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="hsl(318, 97%, 50%)"
          stroke="white"
          strokeWidth={2}
        />
      </g>
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="relative w-full h-3/4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={45}
              outerRadius={75}
              dataKey="value"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Needle overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="100%" height="100%" className="absolute" viewBox="0 0 200 160">
            <Needle cx={100} cy={128} angle={needleAngle} />
          </svg>
        </div>
      </div>
      
      {/* Value display and legend */}
      <div className="w-full px-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-primary">
            {metricName.includes('Rate') 
              ? `${Math.round(clientData * 10) / 10}%`
              : metricName.includes('Duration')
                ? `${Math.round((clientData / 60) * 10) / 10} min`
                : `${Math.round(clientData * 10) / 10}`
            }
          </div>
          <div className="text-sm text-slate-600">{clientKey}</div>
        </div>
        
        {/* Comparison values */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="text-center">
            <div className="font-medium text-slate-700">Industry Avg</div>
            <div className="text-slate-600">
              {metricName.includes('Rate') 
                ? `${Math.round(industryAvg * 10) / 10}%`
                : metricName.includes('Duration')
                  ? `${Math.round((industryAvg / 60) * 10) / 10} min`
                  : `${Math.round(industryAvg * 10) / 10}`
              }
            </div>
          </div>
          <div className="text-center">
            <div className="font-medium text-slate-700">CD Client Avg</div>
            <div className="text-slate-600">
              {metricName.includes('Rate') 
                ? `${Math.round(cdAvg * 10) / 10}%`
                : metricName.includes('Duration')
                  ? `${Math.round((cdAvg / 60) * 10) / 10} min`
                  : `${Math.round(cdAvg * 10) / 10}`
              }
            </div>
          </div>
        </div>
        
        {/* Performance indicator */}
        <div className="text-center mt-3">
          <div className={`text-xs font-medium ${
            (isLowerBetter && clientData <= excellent) || (!isLowerBetter && clientData >= excellent * (maxValue / (maxValue * 0.8)))
              ? 'text-green-600' 
              : (isLowerBetter && clientData <= good) || (!isLowerBetter && clientData >= good * (maxValue / (maxValue * 0.6)))
              ? 'text-yellow-600' 
              : 'text-red-600'
          }`}>
            {(isLowerBetter && clientData <= excellent) || (!isLowerBetter && clientData >= excellent * (maxValue / (maxValue * 0.8)))
              ? 'Excellent Performance' 
              : (isLowerBetter && clientData <= good) || (!isLowerBetter && clientData >= good * (maxValue / (maxValue * 0.6)))
              ? 'Good Performance' 
              : 'Needs Improvement'}
          </div>
        </div>
      </div>
    </div>
  );
}