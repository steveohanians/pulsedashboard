import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

// Heavy libraries are only imported when this component loads
const loadPDFLibraries = async () => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  return { html2canvas, jsPDF };
};

interface PDFExportProps {
  onExport: () => void;
  disabled?: boolean;
}

export default function PDFExport({ onExport, disabled }: PDFExportProps) {
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