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

  // Asset preflight loading for fonts/images
  const preflightAssets = async () => {
    return new Promise((resolve) => {
      const images = document.querySelectorAll('img');
      let loadedCount = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        resolve(true);
        return;
      }

      const checkComplete = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          resolve(true);
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkComplete();
        } else {
          img.onload = checkComplete;
          img.onerror = checkComplete;
        }
      });

      // Timeout after 3 seconds
      setTimeout(() => resolve(true), 3000);
    });
  };

  // CSS animation control - pause animations during capture
  const controlAnimations = (pause: boolean) => {
    const animatedElements = document.querySelectorAll('*');
    animatedElements.forEach((el) => {
      const element = el as HTMLElement;
      if (pause) {
        element.style.animationPlayState = 'paused';
        element.style.transitionDuration = '0s';
      } else {
        element.style.animationPlayState = '';
        element.style.transitionDuration = '';
      }
    });
  };

  // Slice-based rendering (1400px chunks) to prevent memory crashes
  const captureInSlices = async (element: HTMLElement, html2canvas: any) => {
    const SLICE_HEIGHT = 1400;
    const elementHeight = element.scrollHeight;
    const elementWidth = element.scrollWidth;
    const totalSlices = Math.ceil(elementHeight / SLICE_HEIGHT);
    
    console.info(`📐 Slice-based capture: ${totalSlices} slices of ${SLICE_HEIGHT}px each`);
    
    const canvases: HTMLCanvasElement[] = [];
    
    for (let i = 0; i < totalSlices; i++) {
      const yOffset = i * SLICE_HEIGHT;
      const sliceHeight = Math.min(SLICE_HEIGHT, elementHeight - yOffset);
      
      console.info(`🔍 Capturing slice ${i + 1}/${totalSlices} at y=${yOffset}, height=${sliceHeight}`);
      
      // CORS-safe capture configuration
      const canvas = await html2canvas(element, {
        height: sliceHeight,
        width: elementWidth,
        x: 0,
        y: yOffset,
        scrollX: 0,
        scrollY: -yOffset,
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
        async: true,
        windowWidth: elementWidth,
        windowHeight: sliceHeight
      });
      
      canvases.push(canvas);
      
      // Small delay between slices to prevent memory overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return canvases;
  };

  // Stitch slices into final canvas
  const stitchSlices = (slices: HTMLCanvasElement[]) => {
    if (slices.length === 0) return null;
    if (slices.length === 1) return slices[0];

    const totalHeight = slices.reduce((sum, canvas) => sum + canvas.height, 0);
    const width = slices[0].width;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = totalHeight;
    
    const ctx = finalCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    let currentY = 0;
    slices.forEach(canvas => {
      ctx.drawImage(canvas, 0, currentY);
      currentY += canvas.height;
    });

    return finalCanvas;
  };

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    
    try {
      console.info('🚀 Trying html2canvas with iframe bypass options');
      
      // Import libraries  
      console.info('Step 1: Testing html2canvas import...');
      const { default: html2canvas } = await import('html2canvas');
      console.info('✅ html2canvas imported successfully');
      
      console.info('Step 2: Testing jsPDF import...');
      const { jsPDF } = await import('jspdf');
      console.info('✅ jsPDF imported successfully');
      
      const element = targetRef.current;
      
      // Step 1: Asset preflight loading
      console.info('📦 Asset preflight loading...');
      await preflightAssets();
      
      // Step 2: CSS animation control
      console.info('⏸️ Pausing animations for stable capture...');
      controlAnimations(true);
      
      // Small delay to ensure animations are paused
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Single capture with iframe bypass options
      console.info('📸 Starting direct capture with iframe bypass...');
      const canvas = await html2canvas(element, {
        // Iframe bypass options
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
        // Force specific window context to bypass iframe detection  
        onclone: function(clonedDoc: Document) {
          // Try to set window context in cloned document
          if (window.parent && window.parent !== window) {
            console.info('🔧 Using parent window context to bypass iframe detection');
          }
          return clonedDoc.documentElement;
        }
      });
      
      console.info('✅ Canvas captured successfully');
      
      console.info('📄 Creating PDF from captured canvas...', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      });
      
      // Step 4: Create PDF with proper scaling
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgData = canvas.toDataURL('image/png', 0.8);
      const imgAspectRatio = canvas.height / canvas.width;
      
      let imgWidth = pdfWidth;
      let imgHeight = pdfWidth * imgAspectRatio;
      
      // Handle multi-page if needed
      let yPosition = 0;
      const margin = 0;
      
      while (yPosition < imgHeight) {
        const pageHeight = pdfHeight - margin;
        const remainingHeight = imgHeight - yPosition;
        const sliceHeight = Math.min(pageHeight, remainingHeight);
        
        if (yPosition > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(
          imgData, 
          'PNG', 
          0, 
          margin - yPosition, 
          imgWidth, 
          imgHeight,
          '',
          'FAST'
        );
        
        yPosition += sliceHeight;
      }

      // Step 6: Generate filename and download
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
      
      pdf.save(downloadName);
      console.info('✅ Visual PDF export completed successfully!');
      
    } catch (error) {
      console.error('❌ Visual PDF export failed:', error);
      
      // If visual capture fails, provide meaningful error
      if (error instanceof Error && error.message.includes('iframe')) {
        alert('PDF export temporarily unavailable due to browser security restrictions. Please contact support.');
      } else {
        alert('PDF export failed. Please try again or contact support if the issue persists.');
      }
    } finally {
      // Step 7: Restore animations
      console.info('▶️ Restoring animations...');
      controlAnimations(false);
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