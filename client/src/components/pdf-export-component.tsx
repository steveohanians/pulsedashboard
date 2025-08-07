import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { loadPDFLibraries } from '@/utils/performanceUtils';

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