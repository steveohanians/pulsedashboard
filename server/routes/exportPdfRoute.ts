import { Router, Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logging/logger';
import { requireAuth } from '../middleware/auth';
import { generatePDF } from '../pdf';

const router = Router();

// Input validation schema for dashboard PDF export
const exportPdfSchema = z.object({
  html: z.string().max(4 * 1024 * 1024), // 4MB limit
  width: z.number().optional(),
  height: z.number().optional(),
  clientLabel: z.string().optional(),
  styles: z.string().optional(),
  elementStyles: z.string().optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  devicePixelRatio: z.number().optional(),
});

// Sanitize HTML to remove scripts and event handlers
function sanitizeHtml(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove inline event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
  
  return sanitized;
}

// Track concurrent exports for production rate limiting
let concurrentExports = 0;
const MAX_CONCURRENT_EXPORTS = 2;

router.post('/pdf', requireAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Rate limiting for production
    if (process.env.NODE_ENV === 'production' && concurrentExports >= MAX_CONCURRENT_EXPORTS) {
      return res.status(429).json({
        ok: false,
        error: 'Too many concurrent exports. Please try again in a moment.'
      }).header('Retry-After', '5');
    }

    // Validate input
    const parseResult = exportPdfSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request data',
        details: parseResult.error.errors
      });
    }

    const dashboardData = parseResult.data;

    // Check body size
    const bodySize = Buffer.byteLength(dashboardData.html, 'utf8');
    if (bodySize > 4 * 1024 * 1024) {
      return res.status(413).json({
        ok: false,
        error: 'Export too large. Please reduce the content size.'
      });
    }

    concurrentExports++;

    // Sanitize HTML
    const sanitizedHtml = sanitizeHtml(dashboardData.html);

    // Prepare data for PDF generation
    const pdfData = {
      ...dashboardData,
      html: sanitizedHtml
    };

    logger.info('Generating PDF from dashboard data', {
      userId: req.user?.id,
      clientId: req.user?.clientId,
      htmlSizeBytes: bodySize,
      clientLabel: pdfData.clientLabel,
      dimensions: pdfData.width && pdfData.height ? `${pdfData.width}x${pdfData.height}` : 'unknown'
    });

    // Generate PDF using our enhanced PDF generator
    const pdfBuffer = await generatePDF(pdfData);
    const renderTime = Date.now() - startTime;

    logger.info('PDF generated successfully', {
      userId: req.user?.id,
      clientId: req.user?.clientId,
      renderTimeMs: renderTime,
      pdfSizeBytes: pdfBuffer.length
    });

    // Set proper headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Pulse-Dashboard-${pdfData.clientLabel || 'Export'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the PDF buffer
    return res.send(pdfBuffer);

  } catch (error) {
    const renderTime = Date.now() - startTime;
    
    logger.error('PDF export failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      clientId: req.user?.clientId,
      renderTimeMs: renderTime
    });

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: 'PDF generation failed. Please try again.'
      });
    }

  } finally {
    concurrentExports--;
  }
});

export default router;