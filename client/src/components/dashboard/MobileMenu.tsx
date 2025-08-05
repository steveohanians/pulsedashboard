// Mobile menu component for dashboard navigation
import { useState } from 'react';
import { Menu, X, LogOut, Settings, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface MobileMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  userRole?: string;
  onLogout: () => void;
  activeSection: string;
  onSectionClick: (section: string) => void;
}

const navigationItems = [
  { id: "Bounce Rate", label: "Bounce Rate" },
  { id: "Session Duration", label: "Session Duration" },
  { id: "Pages per Session", label: "Pages per Session" },
  { id: "Sessions per User", label: "Sessions per User" },
  { id: "Traffic Channels", label: "Traffic Channels" },
  { id: "Device Distribution", label: "Device Distribution" }
];

export default function MobileMenu({
  isOpen,
  onToggle,
  onClose,
  userRole,
  onLogout,
  activeSection,
  onSectionClick
}: MobileMenuProps) {
  const handleSectionClick = (sectionId: string) => {
    onSectionClick(sectionId);
    onClose();
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="lg:hidden fixed top-4 right-4 z-50 bg-white shadow-md"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={onClose} />
      )}

      {/* Mobile menu content */}
      <div className={`
        lg:hidden fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6 pt-16">
          {/* Navigation items */}
          <div className="space-y-3 mb-8">
            <h3 className="font-semibold text-slate-700 mb-4">Dashboard Sections</h3>
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionClick(item.id)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                  ${activeSection === item.id 
                    ? 'bg-primary text-white font-medium' 
                    : 'text-slate-600 hover:bg-slate-100'
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Admin links */}
          {userRole === "Admin" && (
            <div className="space-y-3 mb-8 pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-700 mb-4">Admin Panel</h3>
              
              {/* Main Admin Panel Link */}
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="w-full justify-start bg-slate-50 hover:bg-slate-100 font-medium">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              </Link>
              
              {/* Specific Admin Actions */}
              <div className="space-y-2 mt-4">
                <p className="text-xs text-slate-500 font-medium px-2">Quick Actions:</p>
                <Link href="/admin?tab=clients">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    <Building2 className="h-3 w-3 mr-2" />
                    Manage Clients
                  </Button>
                </Link>
                <Link href="/admin?tab=users">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    <Users className="h-3 w-3 mr-2" />
                    Manage Users
                  </Button>
                </Link>
                <Link href="/admin?tab=settings">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    <Settings className="h-3 w-3 mr-2" />
                    System Settings
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Logout button */}
          <div className="pt-4 border-t border-slate-200">
            <Button
              onClick={onLogout}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}