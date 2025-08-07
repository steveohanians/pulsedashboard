import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';

// Lazy load heavy PDF libraries only when needed
const PDFExport = lazy(() => import('./pdf-export-component'));

interface LazyPDFExportProps {
  onExport: () => void;
  disabled?: boolean;
}

/**
 * Lazy-loaded PDF export component that defers loading of heavy PDF libraries
 * until the component is actually rendered, improving initial bundle size.
 * 
 * @param onExport - Callback function to execute when export is triggered
 * @param disabled - Whether the export button should be disabled
 */
export function LazyPDFExport({ onExport, disabled }: LazyPDFExportProps) {
  return (
    <Suspense fallback={<Button disabled>Loading export...</Button>}>
      <PDFExport onExport={onExport} disabled={disabled} />
    </Suspense>
  );
}