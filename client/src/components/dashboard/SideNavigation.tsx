// Side navigation component for dashboard
import { TrendingUp, BarChart3, Users2, Globe, Smartphone, Clock } from 'lucide-react';

interface SideNavigationProps {
  activeSection: string;
  onSectionClick: (section: string) => void;
  className?: string;
}

const navigationItems = [
  { 
    id: "Bounce Rate", 
    label: "Bounce Rate", 
    icon: TrendingUp,
    description: "Percentage of single-page visits"
  },
  { 
    id: "Session Duration", 
    label: "Session Duration", 
    icon: Clock,
    description: "Average time spent on site"
  },
  { 
    id: "Pages per Session", 
    label: "Pages per Session", 
    icon: BarChart3,
    description: "Average pages viewed per visit"
  },
  { 
    id: "Sessions per User", 
    label: "Sessions per User", 
    icon: Users2,
    description: "Average sessions per unique user"
  },
  { 
    id: "Traffic Channels", 
    label: "Traffic Channels", 
    icon: Globe,
    description: "How visitors find your site"
  },
  { 
    id: "Device Distribution", 
    label: "Device Distribution", 
    icon: Smartphone,
    description: "Breakdown by device type"
  }
];

export default function SideNavigation({
  activeSection,
  onSectionClick,
  className = ""
}: SideNavigationProps) {
  return (
    <nav className={`space-y-2 ${className}`}>
      <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">
        Metrics Overview
      </h3>
      
      {navigationItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeSection === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onSectionClick(item.id)}
            className={`
              w-full text-left p-3 rounded-lg transition-all duration-200 group
              ${isActive 
                ? 'bg-primary text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <IconComponent className={`
                h-4 w-4 mt-0.5 flex-shrink-0
                ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
              `} />
              <div className="min-w-0">
                <div className={`
                  font-medium text-sm
                  ${isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'}
                `}>
                  {item.label}
                </div>
                <div className={`
                  text-xs mt-0.5 leading-tight
                  ${isActive ? 'text-primary-100' : 'text-slate-500 group-hover:text-slate-600'}
                `}>
                  {item.description}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}