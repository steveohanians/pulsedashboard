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
  // Safely handle NaN values to prevent chart rendering errors
  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;
  const safeWidth = isNaN(width) || width < 0 ? 0 : width;
  const safeHeight = isNaN(height) || height < 0 ? 0 : height;
  if (hideBottomBorder) {
    return (
      <g>
        {/* Top border */}
        <line
          x1={safeX}
          y1={safeY}
          x2={safeX + safeWidth}
          y2={safeY}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
        {/* Left border */}
        <line
          x1={safeX}
          y1={safeY}
          x2={safeX}
          y2={safeY + safeHeight}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
        {/* Right border */}
        <line
          x1={safeX + safeWidth}
          y1={safeY}
          x2={safeX + safeWidth}
          y2={safeY + safeHeight}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
        />
      </g>
    );
  }

  return (
    <rect
      x={safeX}
      y={safeY}
      width={safeWidth}
      height={safeHeight}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
      rx={2}
      ry={2}
    />
  );
};