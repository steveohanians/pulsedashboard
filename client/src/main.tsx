import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

// Global error handlers to prevent runtime error modal
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection caught:', event.reason);
  // Prevent the runtime error modal by handling the rejection
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.warn('Global error caught:', event.error);
  // Log but don't throw to prevent runtime error modal
});

createRoot(document.getElementById("root")!).render(<App />);
