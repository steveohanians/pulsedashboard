import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';

// Lazy load heavy PDF libraries only when needed
const PDFExport = lazy(() => import('./pdf-export-component'));

interface LazyPDFExportProps {
  onExport: () => void;
  disabled?: boolean;
}

export function LazyPDFExport({ onExport, disabled }: LazyPDFExportProps) {
  return (
    <Suspense fallback={<Button disabled>Loading export...</Button>}>
      <PDFExport onExport={onExport} disabled={disabled} />
    </Suspense>
  );
}