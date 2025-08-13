import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

type PdfExportButtonProps = {
  targetRef: React.RefObject<HTMLElement>;
  fileName?: string;
  clientLabel?: string;
  className?: string;
};

export default function PdfExportButton({
  targetRef,
  fileName,
  clientLabel,
  className
}: PdfExportButtonProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    
    try {
      // Dynamic imports for client-side PDF generation
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = targetRef.current;
      
      // Capture the dashboard content with html2canvas
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: "#fff", 
        scale: 2,
        logging: false,
        allowTaint: false,
        ignoreElements: (element) => {
          // Skip any iframe elements to avoid CORS issues
          return element.tagName === 'IFRAME';
        },
      });

      // Create PDF with proper dimensions
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Calculate dimensions to fit content properly
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scaling to fit width
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      // If content fits on one page
      if (scaledHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, scaledHeight);
      } else {
        // Multi-page handling
        let yOffset = 0;
        let remainingHeight = scaledHeight;
        
        while (remainingHeight > 0) {
          const pageHeight = Math.min(pdfHeight, remainingHeight);
          
          // Add page (except for first iteration)
          if (yOffset > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfWidth, scaledHeight);
          
          yOffset += pageHeight;
          remainingHeight -= pageHeight;
        }
      }

      // Generate filename with timestamp
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "client"}-${stamp}.pdf`;
      
      // Download the PDF
      pdf.save(downloadName);

    } catch (err) {
      console.warn("[SUPPRESSED ERROR]:", "PDF generation failed:", (err as Error).message);
      console.warn("[SUPPRESSED ERROR]:", "Full error details:", {
        message: (err as Error).message,
        stack: (err as Error).stack,
        name: (err as Error).name
      });
      
      // Show user-friendly error message
      alert("PDF generation failed. Please try again or contact support if the issue persists.");
      
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleExport}
      disabled={isGenerating}
      aria-label={isGenerating ? "Generating PDF…" : "Export dashboard as PDF"}
      title={isGenerating ? "Generating PDF…" : "Export PDF"}
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
    </Button>
  );
}