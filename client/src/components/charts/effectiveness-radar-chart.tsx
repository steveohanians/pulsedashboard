import React, { useState, useMemo } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { getTimeSeriesColors } from '@/utils/chartUtils';
import { EffectivenessErrorBoundary } from '../EffectivenessErrorBoundary';
import { AlertCircle } from 'lucide-react';

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

interface CompetitorEffectivenessData {
  competitor: {
    id: string;
    domain: string;
    label: string;
  };
  run: {
    overallScore: number;
    criterionScores: CriterionScore[];
  };
}

interface EffectivenessRadarChartProps {
  criterionScores: CriterionScore[];
  competitorEffectivenessData?: CompetitorEffectivenessData[];
  clientName?: string;
  className?: string;
}

/**
 * Transforms multiple datasets into radar chart format with all entities
 */
function transformDataForRadar(
  clientScores: CriterionScore[],
  competitorData: CompetitorEffectivenessData[] = [],
  clientName: string = 'Your Website'
) {
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

  // Get all criteria from client scores
  const allCriteria = clientScores.map(score => score.criterion);
  
  // Transform data to have one object per criterion with all entities
  return allCriteria.map(criterion => {
    const criterionName = criterionMap[criterion] || 
                         criterion.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const dataPoint: any = {
      criterion: criterionName
    };
    
    // Add client score
    const clientScore = clientScores.find(score => score.criterion === criterion);
    dataPoint[clientName] = clientScore ? clientScore.score : 0;
    
    // Add competitor scores
    competitorData.forEach(compData => {
      const competitorScore = compData.run.criterionScores.find(score => score.criterion === criterion);
      dataPoint[compData.competitor.label] = competitorScore ? competitorScore.score : 0;
    });
    
    return dataPoint;
  });
}

/**
 * Custom tooltip component for radar chart with multiple entities
 */
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.dataKey}: {entry.value}/10
          </p>
        ))}
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
 * Radar chart component for displaying website effectiveness criteria scores with competitors
 */
export function EffectivenessRadarChart({ 
  criterionScores, 
  competitorEffectivenessData = [],
  clientName = 'Your Website',
  className 
}: EffectivenessRadarChartProps) {
  if (!criterionScores || criterionScores.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500">
        No criteria scores available
      </div>
    );
  }

  // State for controlling visibility of each entity
  const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set());
  
  // Get colors from chart utils (same as other dashboard charts)
  const competitors = competitorEffectivenessData.map(data => ({ 
    label: data.competitor.label 
  }));
  const colors = getTimeSeriesColors(clientName, competitors);
  
  // Transform data for radar chart
  const data = transformDataForRadar(criterionScores, competitorEffectivenessData, clientName);
  
  // Get all entities (client + competitors)
  const allEntities = useMemo(() => {
    const entities = [clientName];
    competitorEffectivenessData.forEach(compData => {
      entities.push(compData.competitor.label);
    });
    return entities;
  }, [clientName, competitorEffectivenessData]);
  
  // Toggle entity visibility
  const toggleEntity = (entityName: string) => {
    setHiddenEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityName)) {
        newSet.delete(entityName);
      } else {
        newSet.add(entityName);
      }
      return newSet;
    });
  };
  
  // Get visible entities
  const visibleEntities = allEntities.filter(entity => !hiddenEntities.has(entity));

  return (
    <EffectivenessErrorBoundary 
      clientName={clientName}
      fallback={
        <div className={`w-full h-64 flex items-center justify-center ${className}`}>
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">Unable to load effectiveness radar chart</p>
          </div>
        </div>
      }
    >
      <div className={className}>
      {/* Radar Chart */}
      <ResponsiveContainer width="100%" height={322}>
        <RadarChart data={data} style={{ backgroundColor: 'white' }}>
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
          
          {/* Client Radar */}
          {visibleEntities.includes(clientName) && (
            <Radar
              name={clientName}
              dataKey={clientName}
              stroke={colors[clientName] || colors['Client']}
              fill={colors[clientName] || colors['Client']}
              fillOpacity={0.1}
              strokeWidth={2}
              dot={{ fill: colors[clientName] || colors['Client'], stroke: 'none', r: 4, fillOpacity: 1 }}
            />
          )}
          
          {/* Competitor Radars */}
          {competitorEffectivenessData.map((compData, index) => {
            const competitorLabel = compData.competitor.label;
            if (!visibleEntities.includes(competitorLabel)) return null;
            
            // Use competitor colors from chart utils - colors are mapped by competitor label
            const competitorColor = colors[competitorLabel];
            
            return (
              <Radar
                key={compData.competitor.id}
                name={competitorLabel}
                dataKey={competitorLabel}
                stroke={competitorColor}
                fill={competitorColor}
                fillOpacity={0.05}
                strokeWidth={2}
                dot={{ fill: competitorColor, stroke: 'none', r: 3, fillOpacity: 1 }}
              />
            );
          })}
          
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-4 pb-8 sm:pb-12 border-t border-gray-200 mt-6">
        {/* Client Legend Item */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={!hiddenEntities.has(clientName)}
            onChange={() => toggleEntity(clientName)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 rounded-sm mr-2 border-2 transition-all flex items-center justify-center ${
              !hiddenEntities.has(clientName) ? 'border-primary' : 'border-gray-300'
            }`}
            style={{ 
              backgroundColor: !hiddenEntities.has(clientName) 
                ? colors[clientName] || colors['Client']
                : 'transparent' 
            }}
          >
            {!hiddenEntities.has(clientName) && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-gray-700">{clientName}</span>
        </label>
        
        {/* Competitor Legend Items */}
        {competitorEffectivenessData.map((compData, index) => {
          const competitorLabel = compData.competitor.label;
          const competitorColor = colors[competitorLabel];
          
          return (
            <label key={compData.competitor.id} className="flex items-center cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={!hiddenEntities.has(competitorLabel)}
                onChange={() => toggleEntity(competitorLabel)}
                className="sr-only"
              />
              <div 
                className={`w-3 h-3 rounded-sm mr-2 border-2 transition-all flex items-center justify-center ${
                  !hiddenEntities.has(competitorLabel) ? 'border-gray-400' : 'border-gray-300'
                }`}
                style={{ 
                  backgroundColor: !hiddenEntities.has(competitorLabel) 
                    ? competitorColor
                    : 'transparent' 
                }}
              >
                {!hiddenEntities.has(competitorLabel) && (
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-gray-700">{competitorLabel}</span>
            </label>
          );
        })}
      </div>
    </div>
    </EffectivenessErrorBoundary>
  );
}