// Bundle size optimization utilities
export const loadChartingLibrary = async () => {
  // Lazy load recharts only when needed
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = await import('recharts');
  return { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer };
};

export const loadPDFLibraries = async () => {
  // Only load PDF libraries when export is clicked
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  return { html2canvas, jsPDF };
};