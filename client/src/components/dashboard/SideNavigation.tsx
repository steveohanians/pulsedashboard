// Side navigation component for dashboard
import { TrendingUp, BarChart3, Users2, Globe, Smartphone, Clock, Settings, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface SideNavigationProps {
  activeSection: string;
  onSectionClick: (section: string) => void;
  userRole?: string;
  className?: string;
}

const navigationItems = [
  { 
    id: "Bounce Rate", 
    label: "Bounce Rate", 
    icon: TrendingUp
  },
  { 
    id: "Session Duration", 
    label: "Session Duration", 
    icon: Clock
  },
  { 
    id: "Pages per Session", 
    label: "Pages per Session", 
    icon: BarChart3
  },
  { 
    id: "Sessions per User", 
    label: "Sessions per User", 
    icon: Users2
  },
  { 
    id: "Traffic Channels", 
    label: "Traffic Channels", 
    icon: Globe
  },
  { 
    id: "Device Distribution", 
    label: "Device Distribution", 
    icon: Smartphone
  }
];

export default function SideNavigation({
  activeSection,
  onSectionClick,
  userRole,
  className = ""
}: SideNavigationProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefreshData = async () => {
    // Invalidate all dashboard-related queries to force refresh
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey[0]?.toString() || '';
        return queryKey.includes('/api/dashboard') || queryKey.includes('dashboard');
      }
    });
    
    // Also refresh filters and other related data
    queryClient.invalidateQueries({ queryKey: ['/api/filters'] });
    
    toast({
      title: "Dashboard refreshed",
      description: "All data has been refreshed from the latest sources.",
      duration: 3000,
    });
  };
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

              </div>
            </div>
          </button>
        );
      })}

      {/* Admin Panel Link */}
      {userRole === "Admin" && (
        <>
          <hr className="my-4 border-slate-200" />
          <Link href="/admin">
            <button className="w-full text-left p-3 rounded-lg transition-all duration-200 group text-slate-600 hover:bg-slate-50 hover:text-slate-900">
              <div className="flex items-start space-x-3">
                <Settings className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-slate-700 group-hover:text-slate-900">
                    Admin Panel
                  </div>
                </div>
              </div>
            </button>
          </Link>
          
          {/* Refresh Data Link */}
          <button 
            onClick={handleRefreshData}
            className="w-full text-left p-3 rounded-lg transition-all duration-200 group text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <div className="flex items-start space-x-3">
              <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
              <div className="min-w-0">
                <div className="font-medium text-sm text-slate-700 group-hover:text-slate-900">
                  Refresh Data
                </div>
              </div>
            </div>
          </button>
        </>
      )}
    </nav>
  );
}