import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useState, useMemo } from 'react';

interface RadialChartProps {
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

export default function MetricRadialChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors }: RadialChartProps) {
  const clientKey = clientUrl || 'Client';
  
  // Prepare data for donut chart
  const data = [
    {
      name: clientKey,
      value: clientData,
      fill: 'hsl(318, 97%, 50%)', // Primary pink
      type: 'client'
    },
    {
      name: 'Industry Avg',
      value: industryAvg,
      fill: '#9ca3af', // Light grey
      type: 'average'
    },
    {
      name: 'CD Client Avg',
      value: cdAvg,
      fill: '#4b5563', // Dark grey
      type: 'average'
    },
    ...competitors.map((comp, index) => ({
      name: comp.label,
      value: comp.value,
      fill: ['#8b5cf6', '#06b6d4', '#ef4444'][index % 3], // Purple, cyan, red
      type: 'competitor'
    }))
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full h-full flex items-center">
      <div className="w-2/3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                
                const data = payload[0];
                const percentage = ((data.value / total) * 100).toFixed(1);
                
                return (
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                    padding: '8px 12px',
                    fontSize: '12px'
                  }}>
                    <div style={{ 
                      fontWeight: data.name === clientKey ? 'bold' : 'normal',
                      color: data.name === clientKey ? 'hsl(318, 97%, 50%)' : '#374151'
                    }}>
                      {data.name}: {Math.round(data.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? ' min' : ''}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                      {percentage}% of total
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="w-1/3 pl-4 space-y-2">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center text-xs">
            <div 
              className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <div className="min-w-0">
              <div 
                className={`truncate ${entry.name === clientKey ? 'font-bold text-pink-600' : 'text-slate-700'}`}
                title={entry.name}
              >
                {entry.name}
              </div>
              <div className="text-slate-500 text-xs">
                {Math.round(entry.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? 'min' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}