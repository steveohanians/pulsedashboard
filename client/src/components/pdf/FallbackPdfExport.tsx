import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";

type FallbackPdfExportProps = {
  targetRef: React.RefObject<HTMLElement>;
  clientLabel?: string;
  className?: string;
};

export default function FallbackPdfExport({
  targetRef,
  clientLabel,
  className
}: FallbackPdfExportProps) {
  
  const handlePrintPdf = () => {
    // Use browser's built-in print functionality as fallback
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const element = targetRef.current;
    if (!element) return;
    
    // Create a clean HTML document for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pulse Dashboard - ${clientLabel || 'Client'}</title>
          <style>
            body { 
              margin: 20px; 
              font-family: Arial, sans-serif; 
              background: white;
            }
            .print-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
              text-align: center;
            }
            .print-date {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
            }
            iframe, script, [class*="vite"], [id*="vite"] {
              display: none !important;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-title">Pulse Dashboard™ Report</div>
          <div class="print-date">
            Client: ${clientLabel || 'Demo Client'} | 
            Generated: ${new Date().toLocaleDateString()}
          </div>
          ${element.innerHTML}
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`hover:bg-slate-100 transition-all duration-200 ${className || ''}`}
      onClick={handlePrintPdf}
      title="Print Dashboard as PDF"
    >
      <Printer className="h-4 w-4 mr-1" />
      <span className="hidden sm:inline">Print PDF</span>
    </Button>
  );
}