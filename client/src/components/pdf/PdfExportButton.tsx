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
      console.info('Starting PDF export process');
      
      // Import PDF libraries
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      
      const element = targetRef.current;
      console.info('Target element found, preparing for capture');
      
      // Wait for fonts and images to load
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
      
      console.info('Starting html2canvas capture');
      
      // Try html2canvas with minimal options to avoid iframe issues
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 1,
        useCORS: false,
        allowTaint: false,
        foreignObjectRendering: false,
        proxy: undefined,
        logging: true,
        onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
          // Remove any problematic elements that might cause iframe issues
          const problematicElements = clonedDoc.querySelectorAll('iframe, embed, object, video, audio');
          problematicElements.forEach(el => el.remove());
          return clonedElement;
        }
      });

      console.info('Canvas created successfully, generating PDF');

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgAspectRatio = canvas.height / canvas.width;
      const pdfAspectRatio = pdfHeight / pdfWidth;

      let imgWidth = pdfWidth;
      let imgHeight = pdfWidth * imgAspectRatio;

      // If the image is too tall, fit it to page height
      if (imgAspectRatio > pdfAspectRatio) {
        imgHeight = pdfHeight;
        imgWidth = pdfHeight / imgAspectRatio;
      }

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Generate filename
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
      
      console.info('Saving PDF file');
      pdf.save(downloadName);
      console.info('PDF export completed successfully');

    } catch (error) {
      console.error('PDF export failed:', error);
      // Show user-friendly error message
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