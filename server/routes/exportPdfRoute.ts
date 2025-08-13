import { Router, Request, Response } from 'express';
// import puppeteer from 'puppeteer';
import { z } from 'zod';
import logger from '../utils/logging/logger';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Input validation schema
const exportPdfSchema = z.object({
  html: z.string().max(4 * 1024 * 1024), // 4MB limit
  title: z.string().optional(),
  page: z.object({
    format: z.enum(['A4', 'Letter']).optional(),
    landscape: z.boolean().optional(),
  }).optional(),
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

    const { html, title = 'Pulse-Dashboard', page: pageOptions = {} } = parseResult.data;

    // Check body size
    const bodySize = Buffer.byteLength(html, 'utf8');
    if (bodySize > 4 * 1024 * 1024) {
      return res.status(413).json({
        ok: false,
        error: 'Export too large. Please reduce the content size.'
      });
    }

    concurrentExports++;

    // Sanitize HTML
    const sanitizedHtml = sanitizeHtml(html);

    // Add base href for relative URLs
    const baseHref = `${req.protocol}://${req.get('host')}/`;
    const htmlWithBase = sanitizedHtml.replace(
      '<head>',
      `<head>\n    <base href="${baseHref}">`
    );

    // Temporary fallback - return the original client-side approach until Puppeteer is installed
    const renderTime = Date.now() - startTime;
    
    logger.info('PDF export requested (fallback mode)', {
      userId: req.user?.id,
      clientId: req.user?.clientId,
      htmlSizeBytes: bodySize,
      renderTimeMs: renderTime,
      title,
      note: 'Puppeteer not available, returning 501'
    });

    // Return not implemented for now
    return res.status(501).json({
      ok: false,
      error: 'Server-side PDF generation not yet available. Please use client-side export.',
      fallback: true
    });

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