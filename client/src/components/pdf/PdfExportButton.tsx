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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);

      // Get the target element
      const element = targetRef.current;
      
      // Create canvas with comprehensive iframe blocking
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        height: element.scrollHeight,
        width: element.scrollWidth,
        onclone: (clonedDoc) => {
          // Remove all iframes from cloned document
          const iframes = clonedDoc.querySelectorAll('iframe');
          iframes.forEach(iframe => iframe.remove());
          
          // Also remove any elements with iframe-like behavior
          const embeds = clonedDoc.querySelectorAll('embed, object, applet');
          embeds.forEach(embed => embed.remove());
        }
      });
        
        
        const imgData = canvas.toDataURL("image/png");

        // PDF dimensions (A4 portrait)
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Scale image to fit page width, then paginate vertically
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

        const today = new Date();
        const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        const base = fileName || `Pulse-Dashboard-${clientLabel || "client"}-${stamp}.pdf`;

        pdf.save(base);
    } catch (err) {
      console.error("PDF generation failed:", err);
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