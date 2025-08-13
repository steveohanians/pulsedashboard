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

      // Clone and clean the target element
      const element = targetRef.current;
      const clonedElement = element.cloneNode(true) as HTMLElement;
      
      // Remove all iframes from the clone
      const iframes = clonedElement.querySelectorAll('iframe');
      iframes.forEach(iframe => iframe.remove());
      
      // Add clone to DOM temporarily for rendering
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '-9999px';
      document.body.appendChild(clonedElement);
      
      try {
        const canvas = await html2canvas(clonedElement, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
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
        
        // Clean up clone
        document.body.removeChild(clonedElement);
      } catch (canvasErr) {
        // Clean up clone if canvas creation failed
        if (document.body.contains(clonedElement)) {
          document.body.removeChild(clonedElement);
        }
        throw canvasErr;
      }
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