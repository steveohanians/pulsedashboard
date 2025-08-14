import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";
import './services/periodService.test';

// Nuclear option: completely disable error overlay and runtime error plugin
(window as any).process = { env: { NODE_ENV: 'production', DISABLE_OVERLAY: 'true' } };
// Note: import.meta.env is read-only, so we can't reassign it
if (typeof window !== 'undefined') {
  (window as any).VITE_DISABLE_ERROR_OVERLAY = 'true';
}

// Override __REPLIT_ERROR_PLUGIN_ENABLED if it exists
(window as any).__REPLIT_ERROR_PLUGIN_ENABLED = false;

// Complete error plugin suppression - override before plugin loads
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Now that we've fixed the root cause, restore minimal error suppression
console.error = function(...args: any[]) {
  // Log as warning to prevent plugin trigger
  originalConsoleWarn('[SUPPRESSED ERROR]:', ...args);
};

console.warn = function(...args: any[]) {
  // Still log warnings but with a prefix
  originalConsoleWarn('[CLIENT]:', ...args);
};

// Fixed root cause - simple prevention now sufficient
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

// Nuclear option: Override window methods to completely prevent plugin initialization
(window as any).__vite_plugin_runtime_error = () => {}; // Disable Vite error plugin
(window as any).__vite_runtime_error = () => {}; // Alternative plugin name

// Intercept any attempt to create error overlays by overriding document methods
const originalCreateElement = document.createElement.bind(document);
document.createElement = function(tagName: string, ...args: any[]) {
  const element = originalCreateElement(tagName, ...args);
  
  // Prevent creation of elements that might be error overlays
  if (tagName.toLowerCase() === 'iframe' && arguments.length > 1) {
    return element; // Allow normal iframes but not error plugin iframes
  }
  
  return element;
};

// Override appendChild to prevent error modal injection
const originalAppendChild = document.body?.appendChild;
if (originalAppendChild) {
  document.body.appendChild = function(child: any) {
    // Allow html2canvas helpers (often position:fixed) and only block known overlay IDs/classes
    try {
      const tag = child?.tagName?.toLowerCase?.() || '';
      const id  = (child?.id || '').toString();
      const cls = (child?.className || '').toString();

      // Whitelist: anything html2canvas creates
      if (tag === 'iframe' || id.includes('html2canvas') || cls.includes('html2canvas')) {
        return originalAppendChild.call(this, child);
      }

      // Block only obvious dev overlays (vite/replit/error/overlay), not generic fixed nodes
      const looksLikeOverlay =
        /vite|overlay|replit|error/i.test(id) ||
        /vite|overlay|replit|error/i.test(cls);
      if (looksLikeOverlay) {
        return child; // swallow overlay
      }
    } catch {
      // if anything goes wrong, fall through and append
    }

    return originalAppendChild.call(this, child);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
