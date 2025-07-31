import React from 'react';

interface DashedBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  hideBottomBorder?: boolean;
}

export const DashedBar: React.FC<DashedBarProps> = ({ 
  x = 0, 
  y = 0, 
  width = 0, 
  height = 0, 
  fill = 'none', 
  stroke = '#9ca3af', 
  strokeWidth = 2,
  strokeDasharray = '5,5',
  hideBottomBorder = false
}) => {
  if (hideBottomBorder) {
    return (
      <g>
        {/* Top border */}
        <line
          x1={x}
          y1={y}
          x2={x + width}
          y2={y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
        {/* Left border */}
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={y + height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
        {/* Right border */}
        <line
          x1={x + width}
          y1={y}
          x2={x + width}
          y2={y + height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
      </g>
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
      rx={2}
      ry={2}
    />
  );
};