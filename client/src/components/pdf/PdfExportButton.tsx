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

  // Preflight to ensure fonts and images are ready
  async function ensureAssetsReady(root: HTMLElement) {
    if (document.fonts?.ready) { await document.fonts.ready; }
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.decode?.().catch(() => {})));
  }

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    
    try {
      // Dynamic imports for client-side PDF generation
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = targetRef.current;
      
      // Wait for fonts and images to be ready
      await ensureAssetsReady(element);
      
      // Add capture class for CSS control
      element.classList.add("pdf-capture");
      
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Render in chunks to avoid huge canvas memory
      const sliceHeightPx = 1400; // safe chunk height in CSS px
      const totalHeight = element.scrollHeight; // or getBoundingClientRect().height
      let y = 0;
      let firstPage = true;

      while (y < totalHeight) {
        const slice = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: Math.min(2, window.devicePixelRatio || 1),
          useCORS: true,
          logging: false,
          y,
          height: sliceHeightPx,
          windowWidth: element.scrollWidth,
          windowHeight: sliceHeightPx,
          onclone: (doc) => {
            // Strip problematic backgrounds known to be off-origin
            doc.querySelectorAll('[data-pdf-hide="true"]').forEach(n => n.remove());
          }
        });
        
        const imgData = slice.toDataURL("image/png");
        const imgW = pageW;
        const imgH = (slice.height * imgW) / slice.width;
        
        if (!firstPage) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
        firstPage = false;
        y += sliceHeightPx;
      }

      // Generate filename with timestamp
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "client"}-${stamp}.pdf`;
      
      // Download the PDF
      pdf.save(downloadName);

    } catch (err) {
      // User-friendly error without console spam
      // Optional: could add toast notification here instead of alert
      
    } finally {
      // Always clean up
      if (targetRef.current) {
        targetRef.current.classList.remove("pdf-capture");
      }
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