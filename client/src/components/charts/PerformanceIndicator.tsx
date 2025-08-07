// Performance indicator component for showing metric comparisons
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatMetricValue } from '@/utils/chartUtils';

interface PerformanceIndicatorProps {
  clientValue: number;
  industryValue: number;
  metricName: string;
  className?: string;
}

export default function PerformanceIndicator({
  clientValue,
  industryValue,
  metricName,
  className = ""
}: PerformanceIndicatorProps) {
  // Determine if higher values are better (for most metrics they are, except bounce rate)
  const higherIsBetter = !metricName.toLowerCase().includes('bounce');
  
  // Calculate performance comparison
  const isAboveIndustry = higherIsBetter 
    ? clientValue > industryValue 
    : clientValue < industryValue;
  
  const percentageDiff = Math.abs(((clientValue - industryValue) / industryValue) * 100);
  
  // Determine icon and styling
  const getIndicator = () => {
    if (Math.abs(clientValue - industryValue) < 0.1) {
      return {
        icon: Minus,
        color: 'text-slate-500',
        bgColor: 'bg-slate-100',
        text: 'Similar to industry'
      };
    }
    
    if (isAboveIndustry) {
      return {
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        text: `${percentageDiff.toFixed(1)}% better`
      };
    } else {
      return {
        icon: TrendingDown,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        text: `${percentageDiff.toFixed(1)}% below`
      };
    }
  };

  const indicator = getIndicator();
  const IconComponent = indicator.icon;

  return (
    <div className={`flex items-center justify-between text-sm ${className}`}>
      <div className="flex items-center space-x-3">
        <span className="font-medium text-slate-700">
          Client: {formatMetricValue(clientValue, metricName)}
        </span>
        <span className="text-slate-500">
          vs Industry: {formatMetricValue(industryValue, metricName)}
        </span>
      </div>
      
      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${indicator.bgColor}`}>
        <IconComponent className={`h-3 w-3 ${indicator.color}`} />
        <span className={`text-xs font-medium ${indicator.color}`}>
          {indicator.text}
        </span>
      </div>
    </div>
  );
}