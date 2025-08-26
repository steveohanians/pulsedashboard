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
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="criterion" 
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            className="text-xs"
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
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ fill: 'hsl(var(--primary))', stroke: 'none', r: 4 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}