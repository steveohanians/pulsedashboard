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

  // Elements we must ignore during canvas capture (iframes/canvas/video or anything tagged to hide)
  const shouldIgnoreForPdf = (el: Element) => {
    const node = el as HTMLElement;
    const tag = node.tagName;
    if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'CANVAS') return true;
    return node.hasAttribute('data-pdf-hide') || node.getAttribute('data-pdf-hide') === 'true';
  };

  // -------- Sandbox-safe download helpers (work inside/outside iframes) --------
  const isEmbedded = () => {
    try {
      return window.self !== window.top;
    } catch {
      // Cross-origin access throws; treat as embedded
      return true;
    }
  };

  const triggerDirectDownload = (url: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const askParentToDownload = async (url: string, fileName: string) => {
    // Use a specific origin when possible; fall back to "*"
    const origin =
      document.referrer ? new URL(document.referrer).origin : "*";
    const messageId = `PULSE_PDF_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const ack = new Promise<boolean>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (origin !== "*" && e.origin !== origin) return;
        const data = e.data as any;
        if (data && data.type === "PULSE_PDF_DOWNLOAD_ACK" && data.messageId === messageId) {
          window.removeEventListener("message", handler);
          resolve(true);
        }
      };
      window.addEventListener("message", handler, { once: true });
      // If no ACK arrives quickly, fall back locally (prevents console errors)
      setTimeout(() => resolve(false), 1200);
    });

    try {
      window.parent?.postMessage(
        { type: "PULSE_PDF_DOWNLOAD", url, fileName, messageId },
        origin
      );
    } catch {
      // If posting fails, treat as unhandled by parent
      return false;
    }
    return ack;
  };
  // ---------------------------------------------------------------------------

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
        ignoreElements: shouldIgnoreForPdf,
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
      console.info('Starting PDF export with slice-based rendering');
      
      // Dynamic import of PDF libraries (exact from July 31st)
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
        
        // Enhanced CORS-safe capture configuration with improved error handling
        const canvas = await html2canvas(element, {
          height: sliceHeight,
          width: totalWidth,
          ignoreElements: shouldIgnoreForPdf,
          x: 0,
          y: y,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: "#ffffff",
          scale: 1.2,
          useCORS: true,
          allowTaint: false,
          foreignObjectRendering: false,
          logging: false,
          removeContainer: false,
          windowWidth: totalWidth,
          windowHeight: totalHeight,
          onclone: (clonedDoc) => {
            // Remove any problematic iframes from the cloned document
            const iframes = clonedDoc.querySelectorAll('iframe');
            iframes.forEach(iframe => iframe.remove());
          }
        }).catch((error) => {
          // Suppress iframe-related errors and retry with more restrictive settings
          if (error.message && error.message.includes('iframe')) {
            console.warn('[SUPPRESSED ERROR]:', 'PDF export failed:', error.message);
            return html2canvas(element, {
              height: sliceHeight,
              width: totalWidth,
              ignoreElements: (el) => {
                if (shouldIgnoreForPdf(el)) return true;
                // Also ignore any iframe-related elements
                const tag = (el as HTMLElement).tagName;
                return tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT';
              },
              x: 0,
              y: y,
              scrollX: 0,
              scrollY: 0,
              backgroundColor: "#ffffff",
              scale: 1.0,
              useCORS: false,
              allowTaint: true,
              foreignObjectRendering: false,
              logging: false,
              removeContainer: false,
              windowWidth: totalWidth,
              windowHeight: totalHeight
            });
          }
          throw error;
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
      // Use a consistent, environment-agnostic save path to avoid jsPDF's iframe saver
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);

      if (isEmbedded()) {
        // Try parent first; only rely on it if it ACKs quickly
        const handledByParent = await askParentToDownload(url, downloadName);
        if (!handledByParent) {
          // Parent not listening or blocked—fall back locally
          triggerDirectDownload(url, downloadName);
        }
      } else {
        // Not embedded: handle download locally (no postMessage, no window.open)
        triggerDirectDownload(url, downloadName);
      }
      console.info('PDF export completed successfully');

    } catch (error) {
      // Some environments surface "Unable to find iframe window" from background downloaders.
      // Treat that as benign since we use our own save path above.
      const msg = (error instanceof Error && error.message) ? error.message : String(error);
      if (msg && msg.toLowerCase().includes('unable to find iframe window')) {
        console.info('PDF export: benign iframe-window warning suppressed');
      } else {
        console.error('PDF export failed:', error);
      }
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
      data-testid="button-export-pdf"
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
    </Button>
  );
}