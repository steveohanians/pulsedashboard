// Shared SVG components
// Consolidates custom chart markers found in multiple chart components

interface DiamondDotProps {
  cx: number;
  cy: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  size?: number;
}

/**
 * Diamond-shaped dot marker for charts
 * Extracted from area-chart.tsx and time-series-chart.tsx
 */
export const DiamondDot = (props: DiamondDotProps) => {
  const { cx, cy, fill, stroke, strokeWidth, size = 3 } = props;
  
  return (
    <polygon
      points={`${cx},${cy-size} ${cx+size},${cy} ${cx},${cy+size} ${cx-size},${cy}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};

interface CircleDotProps {
  cx: number;
  cy: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  r?: number;
}

/**
 * Circle dot marker for charts
 * Standardizes circular markers across chart components
 */
export const CircleDot = (props: CircleDotProps) => {
  const { cx, cy, fill, stroke = 'none', strokeWidth = 0, r = 3 } = props;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};

interface SquareDotProps {
  cx: number;
  cy: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  size?: number;
}

/**
 * Square dot marker for charts
 * Provides alternative marker style for chart differentiation
 */
export const SquareDot = (props: SquareDotProps) => {
  const { cx, cy, fill, stroke = 'none', strokeWidth = 0, size = 3 } = props;
  
  return (
    <rect
      x={cx - size}
      y={cy - size}
      width={size * 2}
      height={size * 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};