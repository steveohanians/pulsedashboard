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
  const colorClass = isOutperforming 
    ? "bg-green-100 text-green-800 border-green-200" 
    : "bg-red-100 text-red-800 border-red-200";

  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colorClass} ${className}`}
      data-testid={`comparison-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label} {sign}{percentage}%
    </span>
  );
};

export default ComparisonChip;