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
      
      // Create canvas with aggressive iframe filtering to prevent "Unable to find iframe window" errors
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false, // Disable logging to reduce console noise
        height: element.scrollHeight,
        width: element.scrollWidth,
        // Completely disable iframe processing in html2canvas
        ignoreElements: (element) => {
          try {
            const tagName = element.tagName?.toLowerCase() || '';
            
            // AGGRESSIVE: Remove ALL iframes to prevent "Unable to find iframe window" error
            if (tagName === 'iframe') {
              return true;
            }
            
            // Remove script tags
            if (tagName === 'script') return true;
            
            // Remove any elements that might contain iframes or cause issues
            if (tagName === 'embed' || tagName === 'object') return true;
            
            return false;
          } catch (e) {
            // If filtering fails, exclude the element to be safe
            return true;
          }
        },
        onclone: (clonedDoc) => {
          try {
            // Aggressive cleanup in cloned document - remove ALL iframes and problematic elements
            const iframes = clonedDoc.querySelectorAll('iframe');
            iframes.forEach(iframe => iframe.remove());
            
            const scripts = clonedDoc.querySelectorAll('script');
            scripts.forEach(script => script.remove());
            
            const embeds = clonedDoc.querySelectorAll('embed, object');
            embeds.forEach(embed => embed.remove());
            
            // Remove any Vite-related elements
            const viteElements = clonedDoc.querySelectorAll('[class*="vite"], [id*="vite"], [data-vite]');
            viteElements.forEach(el => el.remove());
            
            return clonedDoc;
          } catch (e) {
            console.warn('Error in onclone cleanup:', e);
            return clonedDoc;
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
      
      // Show user-friendly error and suggest fallback
      alert("PDF generation failed. This might be due to browser restrictions. Try using your browser's Print function (Ctrl+P) and select 'Save as PDF' instead.");
      
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