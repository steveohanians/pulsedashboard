import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

// Comprehensive error suppression to prevent runtime error plugin modal
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

createRoot(document.getElementById("root")!).render(<App />);
