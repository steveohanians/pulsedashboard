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
      console.info('IFRAME BUG DIAGNOSTIC: Starting systematic test');
      
      // Dynamic import of PDF libraries
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      
      const element = targetRef.current;
      console.info('Target element found, testing with minimal content first');
      
      // STEP 1: Test html2canvas with completely isolated simple element
      console.info('STEP 1: Testing html2canvas with isolated test element');
      const testDiv = document.createElement('div');
      testDiv.style.width = '200px';
      testDiv.style.height = '100px';
      testDiv.style.backgroundColor = '#f0f0f0';
      testDiv.style.position = 'absolute';
      testDiv.style.top = '-9999px';
      testDiv.style.left = '-9999px';
      testDiv.innerHTML = '<p>Test</p>';
      document.body.appendChild(testDiv);
      
      try {
        const testCanvas = await html2canvas(testDiv, {
          backgroundColor: "#ffffff",
          width: 200,
          height: 100
        });
        console.info('✅ STEP 1 SUCCESS: Basic html2canvas works, proceeding to main element');
        document.body.removeChild(testDiv);
      } catch (testError) {
        console.error('❌ STEP 1 FAILED: html2canvas broken at basic level:', testError);
        document.body.removeChild(testDiv);
        throw new Error('html2canvas fundamentally broken - cannot proceed');
      }
      
      // STEP 2: Try main element with bare minimum options
      console.info('STEP 2: Testing main element with minimal options');
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff"
        });
        
        console.info('✅ STEP 2 SUCCESS: Main element captured with minimal options!');
        
        // Continue with PDF creation
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgData = canvas.toDataURL('image/png');
        const imgAspectRatio = canvas.height / canvas.width;
        
        let imgWidth = pdfWidth;
        let imgHeight = pdfWidth * imgAspectRatio;
        
        if (imgHeight > pdfHeight) {
          imgHeight = pdfHeight;
          imgWidth = pdfHeight / imgAspectRatio;
        }
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const today = new Date();
        const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
        
        pdf.save(downloadName);
        console.info('🎉 PDF EXPORT SUCCESSFUL with minimal options!');
        
      } catch (mainError) {
        console.error('❌ STEP 2 FAILED: Main element failed with minimal options');
        console.error('Error details:', mainError);
        
        // STEP 3: Try with even more minimal setup
        if (mainError instanceof Error && mainError.message.includes('iframe')) {
          console.info('STEP 3: Iframe error detected, trying element isolation');
          
          // Clone element and strip potentially problematic content
          const clonedElement = element.cloneNode(true) as HTMLElement;
          clonedElement.style.position = 'absolute';
          clonedElement.style.top = '-9999px';
          clonedElement.style.left = '-9999px';
          document.body.appendChild(clonedElement);
          
          // Remove all potentially problematic elements
          const problematic = clonedElement.querySelectorAll('iframe, embed, object, canvas, video, audio');
          problematic.forEach(el => el.remove());
          
          try {
            const isolatedCanvas = await html2canvas(clonedElement, {
              backgroundColor: "#ffffff"
            });
            
            console.info('✅ STEP 3 SUCCESS: Isolated element worked!');
            document.body.removeChild(clonedElement);
            
            // Complete PDF generation with isolated canvas
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgData = isolatedCanvas.toDataURL('image/png');
            const imgAspectRatio = isolatedCanvas.height / isolatedCanvas.width;
            
            let imgWidth = pdfWidth;
            let imgHeight = pdfWidth * imgAspectRatio;
            
            if (imgHeight > pdfHeight) {
              imgHeight = pdfHeight;
              imgWidth = pdfHeight / imgAspectRatio;
            }
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            const today = new Date();
            const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
            const downloadName = fileName || `Pulse-Dashboard-${clientLabel || "Export"}-${stamp}.pdf`;
            
            pdf.save(downloadName);
            console.info('🎉 PDF EXPORT SUCCESSFUL with isolated element!');
            
          } catch (isolatedError) {
            console.error('❌ STEP 3 FAILED: Even isolated element failed');
            document.body.removeChild(clonedElement);
            
            // Final fallback: Server-side PDF generation
            console.info('FINAL STEP: Attempting server-side PDF generation');
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
              
              console.info('✅ FINAL STEP SUCCESS: Server-side PDF generated');
            } else {
              console.error('❌ ALL STEPS FAILED: Neither client-side nor server-side worked');
              throw new Error('All PDF generation methods failed');
            }
          }
        } else {
          throw mainError;
        }
      }

    } catch (error) {
      console.error('🚨 COMPLETE PDF EXPORT FAILURE:', error);
      console.error('This indicates a fundamental issue with html2canvas 1.4.1 in this environment');
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