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
      // Get current page HTML and styles for server-side processing
      const element = targetRef.current;
      const elemHtml = element.outerHTML;
      
      // Get all stylesheets content
      const styles: string[] = [];
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleEl) => {
        if (styleEl instanceof HTMLStyleElement) {
          styles.push(styleEl.innerHTML);
        } else if (styleEl instanceof HTMLLinkElement && styleEl.sheet) {
          try {
            const cssRules = Array.from(styleEl.sheet.cssRules);
            const cssText = cssRules.map(rule => rule.cssText).join('\n');
            styles.push(cssText);
          } catch (e) {
            // Skip external stylesheets that can't be accessed
          }
        }
      });

      // Send to server for PDF generation
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: elemHtml,
          styles: styles.join('\n'),
          clientLabel: clientLabel,
          fileName: fileName
        })
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "client"}-${stamp}.pdf`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("PDF generation failed:", err);
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