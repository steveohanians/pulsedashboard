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
      console.info('Starting PDF export - attempting to bypass iframe detection bug');
      
      // Dynamic import of PDF libraries
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      
      const element = targetRef.current;
      console.info('Target element found, dimensions:', {
        width: element.scrollWidth,
        height: element.scrollHeight
      });
      
      // Asset preflight loading
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
      
      console.info('Starting capture with iframe bug bypass options');
      
      // Ultra-minimal html2canvas options designed to avoid iframe detection bug
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 1,
        useCORS: false,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 0,
        removeContainer: false,
        async: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: function(clonedDoc: Document, clonedElement: HTMLElement) {
          console.info('Cleaning cloned document to prevent iframe issues');
          // Remove any elements that might trigger iframe detection
          const problematicElements = clonedDoc.querySelectorAll('iframe, embed, object, frame, frameset, applet');
          problematicElements.forEach(el => {
            console.info('Removing potentially problematic element:', el.tagName);
            el.remove();
          });
          
          // Also remove any Replit error overlay elements that might cause issues
          const errorElements = clonedDoc.querySelectorAll('[data-vite-error-overlay]');
          errorElements.forEach(el => el.remove());
          
          return clonedElement;
        }
      });

      console.info('Canvas captured successfully, dimensions:', {
        width: canvas.width,
        height: canvas.height
      });
      
      // Restore animations
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = '';
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png');
      const imgAspectRatio = canvas.height / canvas.width;
      
      // Calculate dimensions to fit within PDF page
      let imgWidth = pdfWidth;
      let imgHeight = pdfWidth * imgAspectRatio;
      
      // If too tall, fit to height
      if (imgHeight > pdfHeight) {
        imgHeight = pdfHeight;
        imgWidth = pdfHeight / imgAspectRatio;
      }
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Generate filename
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
      
      console.info('Saving PDF');
      pdf.save(downloadName);
      console.info('PDF export completed successfully');

    } catch (error) {
      console.error('PDF export failed:', error);
      
      // If it's the specific iframe error, provide detailed information
      if (error instanceof Error && error.message.includes('iframe window')) {
        console.error('IFRAME BUG DETECTED - This is a known issue with html2canvas 1.4.1');
        console.error('Attempted workarounds:', {
          removedProblematicElements: true,
          minimalOptions: true,
          asyncDisabled: true
        });
      }
      
      // Try server-side fallback as last resort
      if (error instanceof Error && error.message.includes('iframe window')) {
        console.info('Attempting server-side PDF generation as fallback');
        try {
          const element = targetRef.current;
          if (element) {
            const elementData = {
              html: element.outerHTML,
              width: element.scrollWidth,
              height: element.scrollHeight,
              clientLabel: clientLabel || 'Demo Company'
            };

            const response = await fetch('/api/export-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(elementData)
            });

            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              const today = new Date();
              const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
              const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
              a.download = downloadName;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              
              console.info('Server-side PDF generation successful');
            } else {
              console.error('Server-side PDF generation also failed');
            }
          }
        } catch (serverError) {
          console.error('Server-side PDF fallback failed:', serverError);
        }
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