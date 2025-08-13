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
      console.info('Starting server-side PDF generation (html2canvas proven broken in this environment)');
      
      const element = targetRef.current;
      
      // Collect all styles to ensure visual accuracy in server-side rendering
      const allStyles = Array.from(document.styleSheets).map(sheet => {
        try {
          return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
        } catch (e) {
          // CORS protected stylesheets - get computed styles instead
          return '';
        }
      }).join('\n');

      // Get all computed styles for critical elements
      const computedStyles = window.getComputedStyle(element);
      const elementStyles = Array.from(computedStyles).map(prop => 
        `${prop}: ${computedStyles.getPropertyValue(prop)}`
      ).join('; ');

      // Prepare data for server-side rendering
      const elementData = {
        html: element.outerHTML,
        width: element.scrollWidth,
        height: element.scrollHeight,
        clientLabel: clientLabel || 'Demo Company',
        styles: allStyles,
        elementStyles: elementStyles,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      };

      console.info('Sending dashboard data to server for PDF generation', {
        htmlLength: elementData.html.length,
        stylesLength: elementData.styles.length,
        dimensions: `${elementData.width}x${elementData.height}`
      });

      const response = await fetch('/api/export/pdf', {
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
        
        // Generate filename
        const today = new Date();
        const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
        
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.info('✅ Server-side PDF generation successful');
      } else {
        const errorText = await response.text();
        console.error('❌ Server-side PDF generation failed:', response.status, errorText);
        
        // Show user-friendly error message
        alert(`PDF generation failed: ${response.status === 501 ? 'Server-side PDF not available' : 'Server error'}`);
      }

    } catch (error) {
      console.error('❌ PDF export request failed:', error);
      alert('PDF export failed. Please try again.');
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