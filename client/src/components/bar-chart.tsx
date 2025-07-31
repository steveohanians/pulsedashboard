import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useMemo, useEffect } from 'react';

interface BarChartProps {
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

export default function MetricBarChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors }: BarChartProps) {
  const clientKey = clientUrl || 'Client';
  
  // Prepare data for horizontal bar chart
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

  // Sort data by value for better visualization
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={sortedData} 
          layout="horizontal"
          margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            type="number"
            fontSize={9}
            tick={{ fill: '#64748b' }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}${metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? 'min' : ''}`}
          />
          <YAxis 
            type="category"
            dataKey="name"
            fontSize={9}
            tick={{ fill: '#64748b' }}
            axisLine={{ stroke: '#cbd5e1' }}
            width={75}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (!active || !payload || !label) return null;
              
              const data = payload[0];
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
                    fontWeight: label === clientKey ? 'bold' : 'normal',
                    color: label === clientKey ? 'hsl(318, 97%, 50%)' : '#374151'
                  }}>
                    {label}: {Math.round(data.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? ' min' : ''}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}