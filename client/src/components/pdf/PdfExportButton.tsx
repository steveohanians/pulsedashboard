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
      // Dynamic imports to avoid build issues with SSR
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);

      const element = targetRef.current;
      
      // Create canvas with comprehensive filtering for clean PDF capture
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: true,
        height: element.scrollHeight,
        width: element.scrollWidth,
        onclone: (clonedDoc, element) => {
          // Additional cleanup in cloned document
          const scripts = clonedDoc.querySelectorAll('script');
          scripts.forEach(script => script.remove());
          
          // Remove any remaining error overlays
          const errorOverlays = clonedDoc.querySelectorAll('[class*="vite"], [class*="error"], [id*="vite"], [id*="error"]');
          errorOverlays.forEach(overlay => overlay.remove());
          
          return clonedDoc;
        },
        ignoreElements: (element) => {
          try {
            // Filter out development/debugging elements only
            const tagName = element.tagName?.toLowerCase() || '';
            const id = element.id?.toLowerCase() || '';
            
            // Handle className properly - can be string, DOMTokenList, or SVGAnimatedString
            let className = '';
            if (element.className) {
              if (typeof element.className === 'string') {
                className = element.className.toLowerCase();
              } else if (element.className.toString) {
                className = element.className.toString().toLowerCase();
              }
            }
            
            // Remove Vite development overlays and error iframes
            if (tagName === 'iframe' && (
              id.includes('vite') || 
              id.includes('error') || 
              className.includes('vite') || 
              className.includes('error')
            )) {
              return true;
            }
            
            // Remove script tags and development tools
            if (tagName === 'script') return true;
            
            // Remove any Vite HMR elements
            if (className.includes('vite-error-overlay')) return true;
            
            return false;
          } catch (e) {
            // If there's any error in filtering, just don't filter this element
            console.warn('Error filtering element:', e);
            return false;
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/png");

      // Create PDF with proper dimensions
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Scale image to fit page width
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let positionY = 0;

      // First page
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
      positionY = -pageHeight;

      // Additional pages if needed
      while (remainingHeight > 0) {
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, positionY, imgWidth, imgHeight);
        remainingHeight -= pageHeight;
        positionY -= pageHeight;
      }

      // Generate filename
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "client"}-${stamp}.pdf`;

      pdf.save(downloadName);

    } catch (err) {
      console.error("PDF generation failed:", err);
      console.error("Full error details:", {
        message: (err as Error).message,
        stack: (err as Error).stack,
        name: (err as Error).name
      });
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