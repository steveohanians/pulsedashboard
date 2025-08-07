import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { loadPDFLibraries } from '@/utils/performanceUtils';

interface PDFExportProps {
  /** Function to handle the PDF export process */
  onExport: () => void;
  /** Whether the export button should be disabled */
  disabled?: boolean;
}

/**
 * PDF Export component with performance-optimized library loading.
 * Provides a button interface for triggering PDF exports with lazy-loaded dependencies
 * to minimize initial bundle size. Uses dynamic imports for html2canvas and jsPDF libraries.
 * 
 * @param onExport - Function to execute when export is triggered
 * @param disabled - Boolean to disable export functionality
 */
export function PDFExport({ onExport, disabled }: PDFExportProps) {
  const handleExport = async () => {
    try {
      const { html2canvas, jsPDF } = await loadPDFLibraries();
      onExport();
    } catch (error) {
      // PDF export libraries failed to load
    }
  };

  return (
    <Button 
      onClick={handleExport} 
      disabled={disabled}
      variant="outline"
      size="sm"
    >
      <Download className="w-4 h-4 mr-2" />
      Export PDF
    </Button>
  );
}