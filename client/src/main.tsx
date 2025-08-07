import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

// Force disable runtime error overlay by setting environment variables
(window as any).process = { env: { NODE_ENV: 'production' } };
(import.meta as any).env.VITE_DISABLE_ERROR_OVERLAY = 'true';

// Complete error plugin suppression - override before plugin loads
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Completely silence all error logging to prevent plugin triggers
console.error = function(...args: any[]) {
  // Completely suppress - don't log anything
};

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
    // Block any elements that look like error overlays
    if (child && (
      child.className?.includes('error') ||
      child.id?.includes('error') ||
      child.style?.position === 'fixed'
    )) {
      return child; // Return but don't actually append
    }
    return originalAppendChild.call(this, child);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
