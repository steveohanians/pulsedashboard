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

  // Slice-based rendering (1400px chunks) to prevent memory crashes
  const captureInSlices = async (element: HTMLElement, html2canvas: any) => {
    const SLICE_HEIGHT = 1400;
    const elementHeight = element.scrollHeight;
    const elementWidth = element.scrollWidth;
    const totalSlices = Math.ceil(elementHeight / SLICE_HEIGHT);

    console.info(
      `📐 Slice-based capture: ${totalSlices} slices of ${SLICE_HEIGHT}px each`,
    );

    const canvases: HTMLCanvasElement[] = [];

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

      // Create a temporary container that includes both header and content for PDF
      const headerElement = document.querySelector("header");
      const dashboardContent = targetRef.current;
      
      console.info("Target element found, preparing for slice-based capture");
      
      // Create a temporary container for PDF that includes header + content
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.top = "-9999px";
      tempContainer.style.left = "0";
      tempContainer.style.width = "100%";
      tempContainer.style.background = "#f8fafc";
      tempContainer.style.minHeight = "100vh";
      tempContainer.style.zIndex = "-1";
      
      // Clone and add header
      if (headerElement) {
        const headerClone = headerElement.cloneNode(true) as HTMLElement;
        headerClone.style.position = "static";
        headerClone.style.top = "0";
        headerClone.style.zIndex = "1";
        headerClone.style.background = "linear-gradient(to right, #ffffff, #ffffff, #f8fafc80)";
        
        // Hide elements that shouldn't appear in PDF
        const elementsToHide = headerClone.querySelectorAll('.logout-button, button[class*="mobile"], button[class*="menu"], [data-pdf-hide="true"]');
        elementsToHide.forEach(el => {
          (el as HTMLElement).style.display = "none";
        });
        
        tempContainer.appendChild(headerClone);
      }
      
      // Clone and add dashboard content
      if (dashboardContent) {
        const contentClone = dashboardContent.cloneNode(true) as HTMLElement;
        contentClone.style.marginTop = "0";
        contentClone.style.paddingTop = "1rem";
        tempContainer.appendChild(contentClone);
      }
      
      document.body.appendChild(tempContainer);
      const element = tempContainer;

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
      const slices = await captureInSlices(element, html2canvas);
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
      
      for (let idx = 0; idx < slices.length; idx++) {
        const canvas = slices[idx];
        if (idx > 0) pdf.addPage();
        const imgData = canvas.toDataURL("image/png");
        const aspect = canvas.height / canvas.width;
        let w = pdfWidth;
        let h = w * aspect;
        if (h > pdfHeight) {
          h = pdfHeight;
          w = h / aspect;
        }
        pdf.addImage(imgData, "PNG", 0, 0, w, h);
      }

      // Restore animations
      originalAnimations.forEach((el: Element) => {
        (el as HTMLElement).style.animationPlayState = "";
      });

      // Clean up the temporary container
      if (tempContainer && tempContainer.parentNode) {
        document.body.removeChild(tempContainer);
      }

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
      
      // Clean up temporary container if it exists
      const existingTempContainer = document.querySelector('[style*="-9999px"]');
      if (existingTempContainer && existingTempContainer.parentNode) {
        existingTempContainer.parentNode.removeChild(existingTempContainer);
      }
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
