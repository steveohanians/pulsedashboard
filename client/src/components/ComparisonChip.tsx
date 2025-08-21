/**
 * Comparison chip component for displaying performance vs benchmarks
 * Shows percentage difference with color coding (green for outperforming, red for underperforming)
 */

import React from 'react';

interface ComparisonChipProps {
  label: string;
  percentage: number;
  isOutperforming: boolean;
  className?: string;
}

export const ComparisonChip: React.FC<ComparisonChipProps> = ({
  label,
  percentage,
  isOutperforming,
  className = ""
}) => {
  const sign = percentage > 0 ? "+" : "";
  const percentageColorClass = isOutperforming 
    ? "text-green-600" 
    : "text-red-600";

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 ${className}`}
      data-testid={`comparison-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span>{label}</span>
      <span className={`font-semibold ${percentageColorClass}`}>
        {sign}{percentage}%
      </span>
    </span>
  );
};

export default ComparisonChip;