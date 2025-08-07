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