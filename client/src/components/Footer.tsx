import { useState } from "react";
import { Info } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

// Environment-based configuration constants
const COMPANY_LEGAL_NAME = import.meta.env.VITE_COMPANY_LEGAL_NAME || "Clear Digital, Inc.";
const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || "Clear Digital";

/**
 * Application footer component that displays copyright information
 * and provides access to legal disclaimer through a drawer overlay.
 * Supports white-label configuration via environment variables.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Copyright */}
        <div className="text-center mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-gray-600">
            © {currentYear} {COMPANY_LEGAL_NAME}. All rights reserved.
          </p>
        </div>

        {/* Disclaimer Drawer Trigger */}
        <div className="text-center">
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-gray-500 hover:text-gray-700 p-2"
              >
                <Info className="h-3 w-3 mr-1" />
                View Disclaimer
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-sm font-semibold text-gray-800">
                  Disclaimer
                </DrawerTitle>
                <DrawerDescription className="text-xs text-gray-600 leading-relaxed">
                  The metrics and rankings presented herein are compiled from multiple third-party sources. 
                  These figures are provided "as-is" for general benchmarking purposes and are not guaranteed 
                  to be complete, reliable, or error‐free. {COMPANY_NAME} and its data providers make no 
                  warranties—express or implied—regarding the accuracy, timeliness, or suitability of this 
                  information. Users should verify critical insights against their own analytics before making decisions.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline" size="sm">
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </footer>
  );
}