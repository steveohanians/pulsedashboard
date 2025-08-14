import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

type PdfExportButtonProps = {
  targetRef: React.RefObject<HTMLElement>;
  fileName?: string;
  clientLabel?: string;
  clientName?: string;
  className?: string;
};

export default function PdfExportButton({
  targetRef,
  fileName,
  clientLabel,
  clientName = "Demo Company",
  className,
}: PdfExportButtonProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0, phase: "" });

  // Elements we must ignore during canvas capture (iframes/canvas/video or anything tagged to hide)
  const shouldIgnoreForPdf = (el: Element) => {
    const node = el as HTMLElement;
    const tag = node.tagName;
    if (tag === "IFRAME" || tag === "VIDEO" || tag === "CANVAS") return true;
    return (
      node.hasAttribute("data-pdf-hide") ||
      node.getAttribute("data-pdf-hide") === "true"
    );
  };

  // Ensure <img> tags won't taint canvas: add crossOrigin to in-page images
  const prepareImagesForCors = (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => {
      try {
        // Don't stomp on explicit dev settings
        if (!img.getAttribute("crossorigin")) {
          img.setAttribute("crossorigin", "anonymous");
        }
        // Optional: reduces Referer-based hotlinking/CORS rejections in some setups
        if (!img.getAttribute("referrerpolicy")) {
          img.setAttribute("referrerpolicy", "no-referrer");
        }
      } catch {}
    });
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
    const origin = document.referrer ? new URL(document.referrer).origin : "*";
    const messageId = `PULSE_PDF_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const ack = new Promise<boolean>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (origin !== "*" && e.origin !== origin) return;
        const data = e.data as any;
        if (
          data &&
          data.type === "PULSE_PDF_DOWNLOAD_ACK" &&
          data.messageId === messageId
        ) {
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
        origin,
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
      const images = document.querySelectorAll("img");
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
    const animatedElements = document.querySelectorAll("*");
    animatedElements.forEach((el) => {
      const element = el as HTMLElement;
      if (pause) {
        element.style.animationPlayState = "paused";
        element.style.transitionDuration = "0s";
      } else {
        element.style.animationPlayState = "";
        element.style.transitionDuration = "";
      }
    });
  };

  // Create PDF header with actual Clear logo
  const createPdfHeader = (clientName: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas dimensions (A4 width in pixels at 96 DPI)
      canvas.width = 794; // 210mm at 96 DPI
      canvas.height = 80; // ~21mm at 96 DPI
      
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw bottom border
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 1);
      ctx.lineTo(canvas.width, canvas.height - 1);
      ctx.stroke();
      
      // Load and draw the actual Clear logo
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = () => {
        // Draw logo at appropriate size
        ctx.drawImage(logo, 40, 20, 60, 40);
        
        // Draw main title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Pulse Dashboard™', 130, 32);
        
        // Draw subtitle
        ctx.fillStyle = '#6b7280';
        ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Analytics Report for ${clientName}`, 130, 50);
        
        // Draw generated info on the right
        const currentDate = new Date().toLocaleDateString('en-US', { 
          month: 'numeric', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        ctx.textAlign = 'right';
        ctx.fillText(`Generated: ${currentDate}`, canvas.width - 40, 32);
        ctx.fillText('Period: Last Month', canvas.width - 40, 50);
        
        resolve(canvas);
      };
      
      logo.onerror = () => {
        // Fallback to text logo if image fails
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('clear.', 40, 40);
        
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Pulse Dashboard™', 130, 32);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Analytics Report for ${clientName}`, 130, 50);
        
        const currentDate = new Date().toLocaleDateString('en-US', { 
          month: 'numeric', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        ctx.textAlign = 'right';
        ctx.fillText(`Generated: ${currentDate}`, canvas.width - 40, 32);
        ctx.fillText('Period: Last Month', canvas.width - 40, 50);
        
        resolve(canvas);
      };
      
      // Try to load the Clear logo from assets - try multiple paths
      const tryLoadLogo = () => {
        const paths = [
          '/attached_assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png',
          './attached_assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png',
          'attached_assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png'
        ];
        
        let attempts = 0;
        const fallbackToText = () => {
          // Final fallback - draw text logo
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('clear.', 40, 40);
          
          ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('Pulse Dashboard™', 130, 32);
          
          ctx.fillStyle = '#6b7280';
          ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(`Analytics Report for ${clientName}`, 130, 50);
          
          const currentDate = new Date().toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
          });
          
          ctx.textAlign = 'right';
          ctx.fillText(`Generated: ${currentDate}`, canvas.width - 40, 32);
          ctx.fillText('Period: Last Month', canvas.width - 40, 50);
          
          resolve(canvas);
        };
        
        const attemptLoad = () => {
          if (attempts >= paths.length) {
            console.warn('Failed to load Clear logo from all paths, using fallback');
            fallbackToText();
            return;
          }
          
          console.log(`Attempting to load logo from: ${paths[attempts]}`);
          logo.src = paths[attempts];
          attempts++;
        };
        
        logo.onerror = () => {
          if (attempts < paths.length) {
            setTimeout(attemptLoad, 100);
          } else {
            fallbackToText();
          }
        };
        
        attemptLoad();
      };
      
      tryLoadLogo();
    });
  };

  // Slice-based rendering (1400px chunks) to prevent memory crashes
  const captureInSlices = async (element: HTMLElement, html2canvas: any, clientName: string) => {
    const SLICE_HEIGHT = 1400;
    const elementHeight = element.scrollHeight;
    const elementWidth = element.scrollWidth;
    const totalSlices = Math.ceil(elementHeight / SLICE_HEIGHT);

    console.info(
      `📐 Slice-based capture: ${totalSlices} slices of ${SLICE_HEIGHT}px each`,
    );

    const canvases: HTMLCanvasElement[] = [];
    
    // Add header as first slice
    const headerCanvas = await createPdfHeader(clientName);
    canvases.push(headerCanvas);

    for (let i = 0; i < totalSlices; i++) {
      const yOffset = i * SLICE_HEIGHT;
      const sliceHeight = Math.min(SLICE_HEIGHT, elementHeight - yOffset);

      console.info(
        `🔍 Capturing slice ${i + 1}/${totalSlices} at y=${yOffset}, height=${sliceHeight}`,
      );

      // Update progress before capture
      setProgress({ current: i + 1, total: totalSlices, phase: "Capturing" });
      
      // Brief yield to allow progress update to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // CORS-safe capture configuration with robust onclone adjustments
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(element, {
          height: sliceHeight,
          width: elementWidth,
          ignoreElements: shouldIgnoreForPdf,
          x: 0,
          y: yOffset,
          scrollX: 0,
          scrollY: -yOffset,
          backgroundColor: "#ffffff",
          scale: 1,
          useCORS: true,
          allowTaint: false,
          foreignObjectRendering: false,
          logging: false,
          imageTimeout: 15000,
          removeContainer: true,
          async: true,
          windowWidth: elementWidth,
          windowHeight: sliceHeight,
          onclone: (doc: Document) => {
            // Strip risky elements in the clone to avoid runtime errors
            doc
              .querySelectorAll(
                'iframe,video,canvas,[data-pdf-hide="true"],[data-pdf-hide]',
              )
              .forEach((n: Element) => n.parentNode?.removeChild(n));
            
            // Remove grey backgrounds - make everything outline only
            doc.querySelectorAll("*").forEach((el: Element) => {
              const element = el as HTMLElement;
              if (element.style) {
                // Remove all background colors but keep borders/outlines
                if (element.style.backgroundColor && 
                    element.style.backgroundColor !== 'transparent' &&
                    element.style.backgroundColor !== 'white') {
                  element.style.backgroundColor = 'transparent';
                }
                
                // Target specific UI components that commonly have grey backgrounds
                const classStr = element.className ? element.className.toString() : '';
                const isMetricBox = classStr.includes('metric') || 
                                  classStr.includes('card') || 
                                  classStr.includes('bg-') ||
                                  classStr.includes('surface') ||
                                  classStr.includes('container') ||
                                  classStr.includes('box') ||
                                  classStr.includes('panel');
                
                if (isMetricBox || element.tagName === 'svg' || element.tagName === 'DIV') {
                  element.style.backgroundColor = 'transparent';
                  // Also remove any background properties
                  element.style.background = 'transparent';
                }
              }
              
              // Remove computed background colors by checking common grey colors
              const computedStyle = getComputedStyle(element);
              const bgColor = computedStyle.backgroundColor;
              if (bgColor && (
                bgColor.includes('rgb(243, 244, 246)') || // bg-gray-100
                bgColor.includes('rgb(249, 250, 251)') || // bg-gray-50
                bgColor.includes('rgb(229, 231, 235)') || // bg-gray-200
                bgColor.includes('gray') ||
                bgColor.includes('grey')
              )) {
                element.style.backgroundColor = 'transparent !important';
                element.style.background = 'transparent !important';
              }
            });
            
            // Add crossOrigin/referrerpolicy to images in the clone
            doc.querySelectorAll("img").forEach((img: HTMLImageElement) => {
              if (!img.getAttribute("crossorigin"))
                img.setAttribute("crossorigin", "anonymous");
              if (!img.getAttribute("referrerpolicy"))
                img.setAttribute("referrerpolicy", "no-referrer");
            });
          },
        });
      } catch (err) {
        const msg =
          err instanceof Error && err.message ? err.message : String(err);
        console.error(
          `❌ html2canvas failed on slice ${i + 1}/${totalSlices} at y=${yOffset}:`,
          msg,
        );
        throw err; // bubble to outer handler so we don't hang silently
      }

      canvases.push(canvas);
    }

    return canvases;
  };

  // Stitch slices into final canvas
  const stitchSlices = (slices: HTMLCanvasElement[]) => {
    if (slices.length === 0) return null;
    if (slices.length === 1) return slices[0];

    const totalHeight = slices.reduce((sum, canvas) => sum + canvas.height, 0);
    const width = slices[0].width;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = width;
    finalCanvas.height = totalHeight;

    const ctx = finalCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, totalHeight);

    let currentY = 0;
    slices.forEach((canvas) => {
      ctx.drawImage(canvas, 0, currentY);
      currentY += canvas.height;
    });

    return finalCanvas;
  };

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    setProgress({ current: 0, total: 0, phase: "Preparing..." });

    try {
      console.info("Starting PDF export with slice-based rendering");

      // Dynamic import of PDF libraries (exact from July 31st)
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const element = targetRef.current;
      console.info("Target element found, preparing for slice-based capture");

      // Asset preflight loading for fonts/images (from working implementation notes)
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      // Ensure in-page <img> won't taint the canvas
      prepareImagesForCors(element);

      // Ensure all images are loaded
      const images = Array.from(element.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }),
      );

      // Small delay to ensure rendering is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CSS animation control (disable animations during capture)
      const originalAnimations = document.querySelectorAll("*");
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = "paused";
      });

      console.info("Starting slice-based rendering via captureInSlices()");
      const slices = await captureInSlices(element, html2canvas, clientName);
      if (!slices || slices.length === 0) {
        throw new Error(
          "No slices captured (captureInSlices returned 0 canvases)",
        );
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      console.info(`Captured ${slices.length} slice(s); composing PDF pages`);
      setProgress({ current: slices.length, total: slices.length, phase: "Composing PDF" });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle header and content positioning
      let currentPage = 1;
      let currentY = 0;
      
      for (let idx = 0; idx < slices.length; idx++) {
        const canvas = slices[idx];
        const imgData = canvas.toDataURL("image/png");
        const aspect = canvas.height / canvas.width;
        
        let w = pdfWidth;
        let h = w * aspect;
        if (h > pdfHeight) {
          h = pdfHeight;
          w = h / aspect;
        }
        
        // For first slice (header), place at top
        if (idx === 0) {
          pdf.addImage(imgData, "PNG", 0, 0, w, h);
          currentY = h;
        } else {
          // Check if content fits on current page
          if (currentY + h > pdfHeight) {
            // Start new page
            pdf.addPage();
            currentY = 0;
          }
          
          pdf.addImage(imgData, "PNG", 0, currentY, w, h);
          currentY += h;
        }
      }

      // Restore animations
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = "";
      });

      // Generate filename
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName =
        fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;

      console.info("Saving multi-page PDF with slice-based rendering");
      // Use a consistent, environment-agnostic save path to avoid jsPDF's iframe saver
      const blob = pdf.output("blob");
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
      console.info("PDF export completed successfully");
    } catch (error) {
      // Log the *real* failure for visibility
      const msg =
        error instanceof Error && error.message ? error.message : String(error);
      console.error("PDF export failed:", msg);
      if (error instanceof Error && (error as any).stack) {
        console.error("Stack:", (error as any).stack);
      }
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, phase: "" });
    }
  };

  // Calculate progress percentage
  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        onClick={handleExport}
        disabled={isGenerating}
        aria-label={isGenerating ? `${progress.phase} ${Math.round(progressPercentage)}%` : "Export dashboard as PDF"}
        title={isGenerating ? `${progress.phase} ${Math.round(progressPercentage)}%` : "Export PDF"}
        data-testid="button-export-pdf"
      >
        {isGenerating ? (
          <div className="flex flex-col items-center gap-1">
            <div className="relative w-4 h-4">
              {progress.total > 0 ? (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 opacity-100">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-black transition-all duration-300 opacity-100"
                    style={{
                      background: `conic-gradient(#000000 ${progressPercentage * 3.6}deg, transparent 0deg)`,
                      opacity: 1
                    }}
                  />
                </div>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
          </div>
        ) : (
          <FileDown className="h-4 w-4" />
        )}
      </Button>
      
      {isGenerating && progress.phase && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap pointer-events-none z-10">
          {progress.phase} {progress.total > 0 && `${Math.round(progressPercentage)}%`}
        </div>
      )}
    </div>
  );
}
