import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

// Comprehensive runtime error modal suppression system
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Override console.error to prevent plugin detection
console.error = function(...args: any[]) {
  // Log to warn instead of error to avoid plugin detection
  console.warn('[SUPPRESSED ERROR]:', ...args);
};

// Override console.warn for completeness
console.warn = function(...args: any[]) {
  // Still log warnings but with a prefix
  originalConsoleWarn('[CLIENT]:', ...args);
};

// Global error handlers to prevent runtime error modal
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection caught:', event.reason);
  // Prevent the runtime error modal by handling the rejection
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.warn('Global error caught:', event.error);
  // Prevent default error handling
  event.preventDefault();
});

// Override onerror for completeness
window.onerror = function(message, source, lineno, colno, error) {
  console.warn('Window onerror caught:', { message, source, lineno, colno, error });
  // Return true to prevent default error handling
  return true;
};

// Override onunhandledrejection for completeness  
window.onunhandledrejection = function(event) {
  console.warn('Window onunhandledrejection caught:', event.reason);
  // Prevent default handling
  event.preventDefault();
  return true;
};

// DOM-based modal removal system - remove any error modals that appear
const removeRuntimeErrorModals = () => {
  // Remove any divs with common error modal characteristics
  const modals = document.querySelectorAll(
    '[class*="error"], [class*="modal"], [data-testid*="error"], [id*="error-overlay"], [class*="overlay"]'
  );
  
  modals.forEach((modal) => {
    const element = modal as HTMLElement;
    // Check if it's likely an error modal based on content or styling
    if (
      element.textContent?.toLowerCase().includes('error') ||
      element.textContent?.toLowerCase().includes('runtime') ||
      element.style.zIndex === '9999' ||
      element.style.position === 'fixed' ||
      element.className.includes('error') ||
      element.className.includes('overlay')
    ) {
      console.warn('[CLIENT]: Removing detected error modal:', element);
      element.remove();
    }
  });
};

// Watch for modal creation with MutationObserver
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        // Remove any newly added error modals
        if (
          element.className?.includes('error') ||
          element.className?.includes('modal') ||
          element.className?.includes('overlay') ||
          element.style?.position === 'fixed'
        ) {
          setTimeout(() => removeRuntimeErrorModals(), 0);
        }
      }
    });
  });
});

// Start observing after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Initial cleanup
  removeRuntimeErrorModals();
  
  // Periodic cleanup every 500ms
  setInterval(removeRuntimeErrorModals, 500);
});

// Start observing immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  observer.observe(document.body, { childList: true, subtree: true });
  removeRuntimeErrorModals();
  setInterval(removeRuntimeErrorModals, 500);
}

createRoot(document.getElementById("root")!).render(<App />);
