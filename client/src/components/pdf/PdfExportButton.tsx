import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import clearLogo from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

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
  const [progress, setProgress] = React.useState({
    current: 0,
    total: 0,
    phase: "",
  });

  const shouldIgnoreForPdf = (el: Element) => {
    const node = el as HTMLElement;
    const tag = node.tagName;
    if (tag === "IFRAME" || tag === "VIDEO" || tag === "CANVAS") return true;
    return (
      node.hasAttribute("data-pdf-hide") ||
      node.getAttribute("data-pdf-hide") === "true"
    );
  };

  const prepareImagesForCors = (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => {
      try {
        if (!img.getAttribute("crossorigin")) {
          img.setAttribute("crossorigin", "anonymous");
        }
        if (!img.getAttribute("referrerpolicy")) {
          img.setAttribute("referrerpolicy", "no-referrer");
        }
      } catch {}
    });
  };

  const isEmbedded = () => {
    try {
      return window.self !== window.top;
    } catch {
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
      setTimeout(() => resolve(false), 1200);
    });

    try {
      window.parent?.postMessage(
        { type: "PULSE_PDF_DOWNLOAD", url, fileName, messageId },
        origin,
      );
    } catch {
      return false;
    }
    return ack;
  };

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

      setTimeout(() => resolve(true), 3000);
    });
  };

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

  const createPdfHeader = (clientName: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      canvas.width = 794;
      canvas.height = 100;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, canvas.height - 1);
      ctx.lineTo(canvas.width - 40, canvas.height - 1);
      ctx.stroke();

      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.onload = () => {
        console.log("✅ Clear logo loaded successfully");

        const maxLogoHeight = 35;
        const maxLogoWidth = 120;
        let logoHeight = maxLogoHeight;
        let logoWidth = (logo.width / logo.height) * logoHeight;

        if (logoWidth > maxLogoWidth) {
          logoWidth = maxLogoWidth;
          logoHeight = (logo.height / logo.width) * logoWidth;
        }

        console.log(
          `Logo dimensions: ${logo.width}x${logo.height}, scaling to: ${logoWidth}x${logoHeight}`,
        );

        const logoY = (canvas.height - logoHeight) / 2 - 10;
        ctx.drawImage(logo, 40, logoY, logoWidth, logoHeight);

        const textStartX = 40 + logoWidth + 30;

        ctx.fillStyle = "#1f2937";
        ctx.font =
          'bold 20px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = "left";
        ctx.fillText("Pulse Dashboard™", textStartX, 35);

        ctx.fillStyle = "#6b7280";
        ctx.font =
          '14px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Analytics Report for ${clientName}`, textStartX, 55);

        const currentDate = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        ctx.textAlign = "right";
        ctx.font =
          '12px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Generated: ${currentDate}`, canvas.width - 40, 35);
        ctx.fillText("Period: Last Month", canvas.width - 40, 55);

        resolve(canvas);
      };

      logo.onerror = () => {
        ctx.fillStyle = "#1f2937";
        ctx.font =
          'bold 28px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = "left";
        ctx.fillText("clear.", 40, 45);

        const textStartX = 150;

        ctx.font =
          'bold 20px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText("Pulse Dashboard™", textStartX, 35);

        ctx.fillStyle = "#6b7280";
        ctx.font =
          '14px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Analytics Report for ${clientName}`, textStartX, 55);

        const currentDate = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        ctx.textAlign = "right";
        ctx.font =
          '12px Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Generated: ${currentDate}`, canvas.width - 40, 35);
        ctx.fillText("Period: Last Month", canvas.width - 40, 55);

        resolve(canvas);
      };

      logo.src = clearLogo;
    });
  };

  // Find individual cards/sections for one-per-page rendering
  const findCardElements = (element: HTMLElement): HTMLElement[] => {
    const cards: HTMLElement[] = [];
    const selectors = [
      "[data-metric-card]",
      "[data-dashboard-card]",
      ".metric-card",
      ".dashboard-card",
      ".stat-card",
      ".kpi-card",
      ".card",
      '[class*="card"]',
    ];

    selectors.forEach((selector) => {
      element.querySelectorAll(selector).forEach((card) => {
        const cardEl = card as HTMLElement;
        // Skip only these specific three cards
        const cardText = cardEl.textContent || "";
        const shouldSkip =
          cardText.includes("Industry Filters") ||
          cardText.includes("Time Period") ||
          cardText.includes("Competitors");

        if (!shouldSkip && !cards.includes(cardEl)) {
          cards.push(cardEl);
        }
      });
    });

    if (cards.length === 0) {
      console.warn(
        "No card elements found, falling back to slice-based capture",
      );
      return [];
    }

    return cards;
  };

  // Capture individual cards
  const captureCardsAsPdf = async (
    element: HTMLElement,
    html2canvas: any,
    clientName: string,
  ) => {
    const cards = findCardElements(element);

    // If no cards found, fall back to slice-based approach
    if (cards.length === 0) {
      return captureInSlices(element, html2canvas, clientName);
    }

    console.info(`📊 Found ${cards.length} cards to capture`);

    const canvases: HTMLCanvasElement[] = [];
    const headerCanvas = await createPdfHeader(clientName);
    canvases.push(headerCanvas);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      console.info(`📸 Capturing card ${i + 1}/${cards.length}`);

      setProgress({
        current: i + 1,
        total: cards.length,
        phase: "Capturing cards",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const canvas = await html2canvas(card, {
          backgroundColor: "#ffffff",
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          foreignObjectRendering: false,
          logging: false,
          imageTimeout: 15000,
          removeContainer: true,
          async: true,
          ignoreElements: shouldIgnoreForPdf,
          onclone: (doc: Document) => {
            doc
              .querySelectorAll(
                'iframe,video,canvas,[data-pdf-hide="true"],[data-pdf-hide]',
              )
              .forEach((n: Element) => n.parentNode?.removeChild(n));

            doc.querySelectorAll("*").forEach((el: Element) => {
              const element = el as HTMLElement;
              if (!element.style) return;

              const classStr = element.className
                ? element.className.toString()
                : "";
              const computedStyle = doc.defaultView?.getComputedStyle(element);

              const isDataViz =
                element.tagName === "CANVAS" ||
                element.closest("svg") ||
                element.querySelector("canvas") ||
                element.querySelector("svg") ||
                classStr.includes("chart") ||
                classStr.includes("graph") ||
                classStr.includes("plot") ||
                classStr.includes("visualization");

              const isImportantUI =
                classStr.includes("metric-value") ||
                classStr.includes("metric-card") ||
                classStr.includes("stat-card") ||
                classStr.includes("kpi") ||
                classStr.includes("dashboard-card") ||
                element.hasAttribute("data-metric") ||
                element.hasAttribute("data-stat");

              if (!isDataViz && !isImportantUI) {
                const bgColor = computedStyle?.backgroundColor || "";
                const isGrayish =
                  bgColor.includes("rgb(24") ||
                  bgColor.includes("rgb(31") ||
                  bgColor.includes("rgb(55") ||
                  bgColor.includes("rgb(75") ||
                  bgColor.includes("rgb(107") ||
                  bgColor.includes("rgb(156") ||
                  bgColor.includes("rgb(209") ||
                  bgColor.includes("rgb(229") ||
                  bgColor.includes("rgb(243");

                if (isGrayish && !element.textContent?.trim()) {
                  element.style.setProperty(
                    "background-color",
                    "transparent",
                    "important",
                  );
                  element.style.setProperty(
                    "background",
                    "transparent",
                    "important",
                  );
                } else if (
                  isGrayish &&
                  element.tagName === "DIV" &&
                  !element.querySelector("img")
                ) {
                  element.style.setProperty(
                    "background-color",
                    "white",
                    "important",
                  );
                  element.style.setProperty("background", "white", "important");
                }
              } else if (isImportantUI) {
                element.style.setProperty(
                  "background-color",
                  "white",
                  "important",
                );
                element.style.setProperty(
                  "border",
                  "1px solid #e5e7eb",
                  "important",
                );
                element.style.setProperty("border-radius", "8px", "important");
                element.style.setProperty("padding", "16px", "important");
              }
            });

            doc.querySelectorAll("img").forEach((img: HTMLImageElement) => {
              if (!img.getAttribute("crossorigin"))
                img.setAttribute("crossorigin", "anonymous");
              if (!img.getAttribute("referrerpolicy"))
                img.setAttribute("referrerpolicy", "no-referrer");
            });
          },
        });

        canvases.push(canvas);
      } catch (err) {
        console.error(`❌ Failed capturing card ${i + 1}:`, err);
        throw err;
      }
    }

    return canvases;
  };

  // Fallback slice-based rendering for when cards aren't found
  const captureInSlices = async (
    element: HTMLElement,
    html2canvas: any,
    clientName: string,
  ) => {
    const SLICE_HEIGHT = 1400;
    const elementHeight = element.scrollHeight;
    const elementWidth = element.scrollWidth;
    const totalSlices = Math.ceil(elementHeight / SLICE_HEIGHT);

    console.info(
      `📐 Slice-based capture: ${totalSlices} slices of ${SLICE_HEIGHT}px each`,
    );

    const canvases: HTMLCanvasElement[] = [];
    const headerCanvas = await createPdfHeader(clientName);
    canvases.push(headerCanvas);

    for (let i = 0; i < totalSlices; i++) {
      const yOffset = i * SLICE_HEIGHT;
      const sliceHeight = Math.min(SLICE_HEIGHT, elementHeight - yOffset);

      console.info(
        `📸 Capturing slice ${i + 1}/${totalSlices} at y=${yOffset}, height=${sliceHeight}`,
      );
      setProgress({ current: i + 1, total: totalSlices, phase: "Capturing" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const canvas = await html2canvas(element, {
          height: sliceHeight,
          width: elementWidth,
          ignoreElements: shouldIgnoreForPdf,
          x: 0,
          y: yOffset,
          scrollX: 0,
          scrollY: -yOffset,
          backgroundColor: "#ffffff",
          scale: 1.5,
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
            // Same clone logic as card capture
            doc
              .querySelectorAll(
                'iframe,video,canvas,[data-pdf-hide="true"],[data-pdf-hide]',
              )
              .forEach((n: Element) => n.parentNode?.removeChild(n));

            doc.querySelectorAll("img").forEach((img: HTMLImageElement) => {
              if (!img.getAttribute("crossorigin"))
                img.setAttribute("crossorigin", "anonymous");
              if (!img.getAttribute("referrerpolicy"))
                img.setAttribute("referrerpolicy", "no-referrer");
            });
          },
        });

        canvases.push(canvas);
      } catch (err) {
        console.error(
          `❌ html2canvas failed on slice ${i + 1}/${totalSlices}:`,
          err,
        );
        throw err;
      }
    }

    return canvases;
  };

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    setProgress({ current: 0, total: 0, phase: "Preparing..." });

    try {
      console.info("Starting PDF export");

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const element = targetRef.current;
      console.info("Target element found, preparing for capture");

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      prepareImagesForCors(element);
      await preflightAssets();
      await new Promise((resolve) => setTimeout(resolve, 100));
      controlAnimations(true);

      console.info("Starting capture");
      const canvases = await captureCardsAsPdf(
        element,
        html2canvas,
        clientName,
      );
      if (!canvases || canvases.length === 0) {
        throw new Error("No content captured");
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availableWidth = pdfWidth - 2 * margin;
      const availableHeight = pdfHeight - 2 * margin;

      console.info(`Captured ${canvases.length} item(s); composing PDF`);
      setProgress({
        current: canvases.length,
        total: canvases.length,
        phase: "Composing PDF",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First canvas is header, rest are cards (1 per page if using card mode)
      canvases.forEach((canvas, idx) => {
        if (idx > 1) pdf.addPage();

        const imgData = canvas.toDataURL("image/png", 1.0);
        const aspect = canvas.height / canvas.width;
        let w = availableWidth;
        let h = w * aspect;

        if (h > availableHeight) {
          h = availableHeight;
          w = h / aspect;
        }

        const xOffset = margin + (availableWidth - w) / 2;
        const yOffset = idx === 0 ? margin : margin + 20;

        pdf.addImage(imgData, "PNG", xOffset, yOffset, w, h);

        if (idx > 0) {
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(`Page ${idx}`, pdfWidth / 2, pdfHeight - 5, {
            align: "center",
          });
        }
      });

      controlAnimations(false);

      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName =
        fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;

      console.info("Saving PDF");
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      if (isEmbedded()) {
        const handledByParent = await askParentToDownload(url, downloadName);
        if (!handledByParent) {
          triggerDirectDownload(url, downloadName);
        }
      } else {
        triggerDirectDownload(url, downloadName);
      }

      URL.revokeObjectURL(url);
      console.info("PDF export completed successfully");
    } catch (error) {
      const msg =
        error instanceof Error && error.message ? error.message : String(error);
      console.error("PDF export failed:", msg);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, phase: "" });
    }
  };

  const progressPercentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        onClick={handleExport}
        disabled={isGenerating}
        aria-label={
          isGenerating
            ? `${progress.phase} ${Math.round(progressPercentage)}%`
            : "Export dashboard as PDF"
        }
        title={
          isGenerating
            ? `${progress.phase} ${Math.round(progressPercentage)}%`
            : "Export PDF"
        }
        data-testid="button-export-pdf"
      >
        {isGenerating ? (
          <div className="relative w-4 h-4">
            {progress.total > 0 ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(#000 ${progressPercentage * 3.6}deg, transparent 0deg)`,
                    mask: "radial-gradient(circle, transparent 60%, black 60%)",
                    WebkitMask:
                      "radial-gradient(circle, transparent 60%, black 60%)",
                  }}
                />
              </>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        ) : (
          <FileDown className="h-4 w-4" />
        )}
      </Button>

      {isGenerating && progress.phase && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap pointer-events-none z-10">
          {progress.phase}{" "}
          {progress.total > 0 && `${Math.round(progressPercentage)}%`}
        </div>
      )}
    </div>
  );
}
