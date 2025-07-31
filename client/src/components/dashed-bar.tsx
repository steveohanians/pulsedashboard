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
}

export const DashedBar: React.FC<DashedBarProps> = ({ 
  x = 0, 
  y = 0, 
  width = 0, 
  height = 0, 
  fill = 'none', 
  stroke = '#9ca3af', 
  strokeWidth = 2,
  strokeDasharray = '5,5'
}) => {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      rx={2}
      ry={2}
    />
  );
};