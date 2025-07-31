// Custom hook for dashboard navigation logic
import { useState, useEffect, useCallback } from 'react';

export function useNavigation() {
  const [activeSection, setActiveSection] = useState<string>("Bounce Rate");
  const [manualClick, setManualClick] = useState<boolean>(false);

  // Scroll to section when navigation item is clicked
  const scrollToSection = useCallback((sectionId: string) => {
    setManualClick(true);
    setActiveSection(sectionId);
    
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 84; // Header height + padding
      const elementPosition = element.offsetTop;
      const offsetPosition = elementPosition - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    
    // Reset manual click flag after scroll animation
    setTimeout(() => {
      setManualClick(false);
    }, 1000);
  }, []);

  // Handle scroll-based section detection
  useEffect(() => {
    if (manualClick) return;
    
    const handleScroll = () => {
      const sections = ["Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User", "Traffic Channels", "Device Distribution"];
      const scrollPosition = window.scrollY + 120;
      
      let currentSection = sections[0];
      let minDistance = Infinity;
      
      sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
          const distance = Math.abs(element.offsetTop - scrollPosition);
          if (distance < minDistance) {
            minDistance = distance;
            currentSection = sectionId;
          }
        }
      });
      
      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    const debouncedHandleScroll = debounce(handleScroll, 100);
    window.addEventListener('scroll', debouncedHandleScroll);
    
    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
    };
  }, [activeSection, manualClick]);

  return {
    activeSection,
    scrollToSection
  };
}

// Debounce helper function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}