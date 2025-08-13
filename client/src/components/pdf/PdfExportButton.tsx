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

  // Inline computed styles for print fidelity
  function inlineStyles(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode as HTMLElement | null;
    while (node) {
      const style = window.getComputedStyle(node);
      const cssText = Array.from(style).map(k => `${k}:${style.getPropertyValue(k)};`).join('');
      node.setAttribute('style', cssText);
      node = walker.nextNode() as HTMLElement | null;
    }
  }

  // Canvas → img fallback (for charts)
  function canvasesToImages(root: HTMLElement) {
    root.querySelectorAll('canvas').forEach(c => {
      try {
        const img = document.createElement('img');
        img.src = (c as HTMLCanvasElement).toDataURL('image/png');
        img.width = (c as HTMLCanvasElement).width;
        img.height = (c as HTMLCanvasElement).height;
        c.replaceWith(img);
      } catch {}
    });
  }

  const handleExport = async () => {
    if (!targetRef.current || isGenerating) return;
    setIsGenerating(true);
    
    try {
      // Try server-side export first
      const dashboardRoot = targetRef.current;
      const cloned = dashboardRoot.cloneNode(true) as HTMLElement;
      
      // Convert canvas elements to images
      canvasesToImages(cloned);
      
      // Inline computed styles
      inlineStyles(cloned);

      // Generate HTML document for server
      const htmlDoc = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Pulse Dashboard</title>
    <link rel="stylesheet" href="/global.css"/>
    <style>
      @page { size: Letter; margin: 0.4in; }
      /* Avoid page breaks in cards */
      .card, .metric-insight-box { break-inside: avoid; }
    </style>
  </head>
  <body class="bg-white">
    ${cloned.outerHTML}
  </body>
</html>`;

      // Try server-side PDF generation
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          html: htmlDoc, 
          title: `Pulse-${clientLabel || 'Dashboard'}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`
        })
      });

      if (response.ok) {
        // Server-side success
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Pulse-${clientLabel || 'Dashboard'}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback to client-side generation
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      
      const element = targetRef.current;
      if (!element) {
        console.error('Target element not found for PDF generation');
        throw new Error("Unable to find target element");
      }
      
      console.info('Starting client-side PDF generation');
      
      // Wait for fonts and images to load completely
      if (document.fonts?.ready) { 
        await document.fonts.ready; 
      }
      const imgs = Array.from(element.querySelectorAll('img'));
      await Promise.all(imgs.map(img => img.decode?.().catch(() => {})));
      
      element.classList.add("pdf-capture");
      
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();

      // Render in chunks to avoid memory issues
      const sliceHeightPx = 1400;
      const totalHeight = element.scrollHeight;
      let y = 0;
      let firstPage = true;

      while (y < totalHeight) {
        const slice = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: Math.min(2, window.devicePixelRatio || 1),
          useCORS: true,
          allowTaint: true,
          logging: false,
          removeContainer: true,
          y,
          height: sliceHeightPx,
          windowWidth: element.scrollWidth,
          windowHeight: sliceHeightPx,
          ignoreElements: (element) => {
            return element.hasAttribute('data-pdf-hide');
          },
          onclone: (clonedDoc, clonedElement) => {
            // Remove elements marked for hiding in PDF
            clonedDoc.querySelectorAll('[data-pdf-hide="true"]').forEach(n => n.remove());
            // Ensure all styles are properly applied
            return clonedElement;
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
      
      pdf.save(downloadName);

    } catch (err) {
      console.warn('PDF export failed:', err);
      
    } finally {
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