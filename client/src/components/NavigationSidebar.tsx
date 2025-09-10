import { Link } from "wouter";
import {
  Settings,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavigationSidebarProps {
  variant: 'desktop' | 'mobile';
  currentPath: string;
  metricNames: string[];
  activeSection: string;
  onSectionClick: (section: string) => void;
  userRole?: string;
  viewAsUserRole?: string;
  onRefreshData: () => void;
  onCloseMobile?: () => void;
  onLogout: () => void;
}

export function NavigationSidebar({
  variant,
  currentPath,
  metricNames,
  activeSection,
  onSectionClick,
  userRole,
  viewAsUserRole,
  onRefreshData,
  onCloseMobile,
  onLogout,
}: NavigationSidebarProps) {
  // Determine which section should be expanded based on current route
  const currentSection = currentPath.startsWith('/brand-signals') ? 'brand-signals' : 'vitals';
  
  // Brand Signals subsections (hardcoded)
  const brandSignalsSubsections = ["AI Share of Voice", "AI Brand Perception"];
  
  // Check if user is admin
  const isAdmin = viewAsUserRole === "Admin" || (!viewAsUserRole && userRole === "Admin");
  
  // Handle section navigation
  const handleVitalsNavigation = () => {
    if (currentSection !== 'vitals') {
      // Navigate to dashboard if we're not already there
      window.location.href = '/dashboard';
    }
  };
  
  const handleBrandSignalsNavigation = () => {
    if (currentSection !== 'brand-signals') {
      // Navigate to brand signals if we're not already there
      window.location.href = '/brand-signals';
    }
  };
  
  const handleSubsectionClick = (subsection: string) => {
    onSectionClick(subsection);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };
  
  const handleRefreshClick = () => {
    onRefreshData();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };
  
  const handleLogoutClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
    onLogout();
  };

  if (variant === 'mobile') {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800">Navigation</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCloseMobile}
          >
            ×
          </Button>
        </div>
        
        <nav>
          {/* Vitals Section */}
          <div className="mb-4">
            <button
              onClick={handleVitalsNavigation}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-sm font-bold mb-2 ${
                currentSection === 'vitals'
                  ? "text-slate-800"
                  : "text-slate-700 hover:text-primary"
              }`}
            >
              <span>Vitals</span>
              {currentSection === 'vitals' ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            
            {currentSection === 'vitals' && (
              <ul className="space-y-1">
                {metricNames.map((metricName) => (
                  <li key={metricName}>
                    <button
                      onClick={() => handleSubsectionClick(metricName)}
                      className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                        activeSection === metricName
                          ? "bg-slate-100 text-primary"
                          : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                      }`}
                    >
                      {metricName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <hr className="border-slate-200 my-4" />
          
          {/* Brand Signals Section */}
          <div className="mb-4">
            <button
              onClick={handleBrandSignalsNavigation}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-sm font-bold mb-2 ${
                currentSection === 'brand-signals'
                  ? "text-slate-800"
                  : "text-slate-700 hover:text-primary"
              }`}
            >
              <span>Brand Signals</span>
              {currentSection === 'brand-signals' ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            
            {currentSection === 'brand-signals' && (
              <ul className="space-y-1">
                {brandSignalsSubsections.map((subsection) => (
                  <li key={subsection}>
                    <button
                      onClick={() => handleSubsectionClick(subsection)}
                      className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                        activeSection === subsection
                          ? "bg-slate-100 text-primary"
                          : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                      }`}
                    >
                      {subsection}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Admin Section */}
          {isAdmin && (
            <>
              <hr className="border-slate-200 my-4" />
              <ul className="space-y-2">
                <li>
                  <Link href="/admin">
                    <button 
                      className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                      onClick={onCloseMobile}
                    >
                      <Settings className="h-3 w-3 inline mr-2" />
                      Admin Panel
                    </button>
                  </Link>
                </li>
                <li>
                  <button
                    onClick={handleRefreshClick}
                    className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                  >
                    <RefreshCw className="h-3 w-3 inline mr-2" />
                    Refresh Data
                  </button>
                </li>
              </ul>
            </>
          )}
          
          <hr className="border-slate-200 my-4" />
          <ul className="space-y-2">
            <li>
              <button
                onClick={handleLogoutClick}
                className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
              >
                <LogOut className="h-3 w-3 inline mr-2" />
                Logout
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  }

  // Desktop variant
  return (
    <div className="p-4">
      {/* Vitals Section */}
      <div className="mb-4">
        <button
          onClick={handleVitalsNavigation}
          className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-base font-bold mb-4 ${
            currentSection === 'vitals'
              ? "text-slate-800"
              : "text-slate-700 hover:text-primary"
          }`}
        >
          <span>Vitals</span>
          {currentSection === 'vitals' ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        
        {currentSection === 'vitals' && (
          <ul className="space-y-2">
            {metricNames.map((metricName) => (
              <li key={metricName}>
                <button
                  onClick={() => onSectionClick(metricName)}
                  className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                    activeSection === metricName
                      ? "bg-slate-100 text-primary"
                      : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                  }`}
                >
                  {metricName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <hr className="border-slate-200 my-4" />
      
      {/* Brand Signals Section */}
      <div className="mb-4">
        <button
          onClick={handleBrandSignalsNavigation}
          className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-base font-bold mb-4 ${
            currentSection === 'brand-signals'
              ? "text-slate-800"
              : "text-slate-700 hover:text-primary"
          }`}
        >
          <span>Brand Signals</span>
          {currentSection === 'brand-signals' ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        
        {currentSection === 'brand-signals' && (
          <ul className="space-y-2">
            {brandSignalsSubsections.map((subsection) => (
              <li key={subsection}>
                <button
                  onClick={() => onSectionClick(subsection)}
                  className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                    activeSection === subsection
                      ? "bg-slate-100 text-primary"
                      : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                  }`}
                >
                  {subsection}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Admin Section */}
      {isAdmin && (
        <>
          <hr className="border-slate-200 my-4" />
          <ul className="space-y-2">
            <li>
              <Link href="/admin">
                <button className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary">
                  <Settings className="h-3 w-3 inline mr-2" />
                  Admin Panel
                </button>
              </Link>
            </li>
            <li>
              <button
                onClick={onRefreshData}
                className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
              >
                <RefreshCw className="h-3 w-3 inline mr-2" />
                Refresh Data
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}