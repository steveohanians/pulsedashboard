import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface CriterionScore {
  id: string;
  criterion: string;
  score: number;
  evidence: {
    description: string;
    details: Record<string, any>;
    reasoning: string;
  };
  passes: {
    passed: string[];
    failed: string[];
  };
}

interface EffectivenessRadarChartProps {
  criterionScores: CriterionScore[];
  className?: string;
}

/**
 * Transforms criterion scores into radar chart format
 */
function transformDataForRadar(criterionScores: CriterionScore[]) {
  const criterionMap: Record<string, string> = {
    positioning: 'Positioning',
    ux: 'UX',
    brand_story: 'Brand Story',
    trust: 'Trust',
    ctas: 'CTAs',
    speed: 'Speed',
    accessibility: 'Accessibility',
    seo: 'SEO'
  };

  return criterionScores.map(score => ({
    criterion: criterionMap[score.criterion] || 
               score.criterion.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    score: score.score
  }));
}

/**
 * Custom tooltip component for radar chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">
          {label}: {data.value}/10
        </p>
      </div>
    );
  }
  return null;
}

/**
 * Custom tick component for positioning labels further from the chart
 */
function CustomTick({ payload, x, y, textAnchor, cx, cy }: any) {
  const distance = 0.125; // Adjust this value to control how far labels appear from chart
  const adjustedX = x + (x - cx) * distance;
  const adjustedY = y + (y - cy) * distance;
  
  return (
    <text 
      x={adjustedX} 
      y={adjustedY} 
      textAnchor={textAnchor}
      fill="hsl(var(--foreground))"
      fontSize="12"
      className="text-xs"
    >
      {payload.value}
    </text>
  );
}

/**
 * Radar chart component for displaying website effectiveness criteria scores
 */
export function EffectivenessRadarChart({ criterionScores, className }: EffectivenessRadarChartProps) {
  if (!criterionScores || criterionScores.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500">
        No criteria scores available
      </div>
    );
  }

  const data = transformDataForRadar(criterionScores);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={322}>
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="criterion" 
            tick={<CustomTick />}
          />
          <PolarRadiusAxis 
            angle={90}
            domain={[0, 10]}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickCount={6}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.1}
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', stroke: 'none', r: 4, fillOpacity: 1 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}