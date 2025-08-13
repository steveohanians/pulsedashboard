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
      console.info('Starting PDF export with slice-based rendering');
      
      // Dynamic import of PDF libraries
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      
      const element = targetRef.current;
      console.info('Target element found, preparing for slice-based capture');
      
      // Asset preflight loading for fonts/images (from working implementation notes)
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      
      // Ensure all images are loaded
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
      
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // CSS animation control (disable animations during capture)
      const originalAnimations = document.querySelectorAll('*');
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = 'paused';
      });
      
      console.info('Starting slice-based rendering (1400px chunks)');
      
      // Slice-based rendering implementation (key from working version!)
      const elementRect = element.getBoundingClientRect();
      const SLICE_HEIGHT = 1400; // 1400px chunks as noted in working implementation
      const totalHeight = element.scrollHeight;
      const totalWidth = element.scrollWidth;
      
      console.info(`Element dimensions: ${totalWidth}x${totalHeight}, slicing into ${Math.ceil(totalHeight / SLICE_HEIGHT)} chunks`);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      let isFirstPage = true;
      
      // Render each slice
      for (let y = 0; y < totalHeight; y += SLICE_HEIGHT) {
        const sliceHeight = Math.min(SLICE_HEIGHT, totalHeight - y);
        
        console.info(`Rendering slice ${Math.floor(y / SLICE_HEIGHT) + 1}: y=${y}, height=${sliceHeight}`);
        
        // CORS-safe capture configuration (from working implementation notes)
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 1.2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          x: 0,
          y: y,
          width: totalWidth,
          height: sliceHeight,
          scrollX: 0,
          scrollY: 0,
          windowWidth: totalWidth,
          windowHeight: totalHeight,
          foreignObjectRendering: false,
          removeContainer: false,
          ignoreElements: (el) => {
            return el.hasAttribute('data-pdf-hide') || el.getAttribute('data-pdf-hide') === 'true';
          }
        });

        console.info(`Slice ${Math.floor(y / SLICE_HEIGHT) + 1} rendered successfully`);

        // Calculate dimensions for this slice
        const imgData = canvas.toDataURL('image/png');
        const imgAspectRatio = canvas.height / canvas.width;
        
        let imgWidth = pdfWidth;
        let imgHeight = pdfWidth * imgAspectRatio;
        
        // If the slice is too tall for the page, fit it to page height
        if (imgHeight > pdfHeight) {
          imgHeight = pdfHeight;
          imgWidth = pdfHeight / imgAspectRatio;
        }
        
        // Add new page for each slice (except the first)
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;
        
        // Add the slice to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }
      
      // Restore animations
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = '';
      });

      // Generate filename
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
      
      console.info('Saving multi-page PDF with slice-based rendering');
      pdf.save(downloadName);
      console.info('PDF export completed successfully');

    } catch (error) {
      console.error('PDF export failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
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