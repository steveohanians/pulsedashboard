import { Router } from 'express';
import { z } from 'zod';
import { sovService } from '../services/sov/sovService';
import { requireAuth, requireAdmin } from '../middleware/auth';
import logger from '../utils/logging/logger';
import { randomUUID } from 'crypto';

const router = Router();

// Input validation schemas
const BrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  url: z.string().url('Valid URL is required')
});

const SovAnalysisSchema = z.object({
  brand: BrandSchema,
  competitors: z.array(BrandSchema).min(1, 'At least one competitor is required'),
  vertical: z.string().min(1, 'Vertical is required'),
  clientId: z.number().optional(),
  userId: z.number().optional()
});

/**
 * POST /api/sov/analyze
 * Analyze Share of Voice for a brand against competitors
 */
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    // Validate input
    const validatedInput = SovAnalysisSchema.parse(req.body);
    
    logger.info('SoV analysis request received', {
      brand: validatedInput.brand.name,
      competitorCount: validatedInput.competitors.length,
      vertical: validatedInput.vertical,
      userId: req.user?.id
    });

    // Generate unique analysis ID for progress tracking
    const analysisId = randomUUID();

    // Add user context with proper type conversion
    const analysisInput = {
      ...validatedInput,
      userId: req.user?.id ? parseInt(req.user.id) : undefined,
      clientId: req.user?.clientId ? parseInt(req.user.clientId) : undefined
    };

    // Return immediately with analysis ID, then start analysis asynchronously
    res.status(202).json({
      success: true,
      analysisId,
      message: 'Analysis started. Connect to progress stream for updates.'
    });

    // Start analysis in background
    setImmediate(async () => {
      try {
        const result = await sovService.analyzeShareOfVoice(analysisInput, analysisId);
        // Store result temporarily for retrieval
        (global as any).analysisResults = (global as any).analysisResults || {};
        (global as any).analysisResults[analysisId] = result;
      } catch (error) {
        logger.error('Background SoV analysis failed', { error, analysisId });
        // Emit error through progress system
        sovService.emit('progress', {
          analysisId,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          step: -1,
          timestamp: new Date().toISOString()
        });
      }
    });

    // This code is now handled in the background async section above

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('SoV analysis validation failed', { 
        errors: error.errors,
        userId: req.user?.id 
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    logger.error('SoV analysis failed', { 
      error: (error as Error).message,
      userId: req.user?.id,
      brand: req.body?.brand?.name
    });

    res.status(500).json({
      success: false,
      error: 'Share of Voice analysis failed',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    });
  }
});

/**
 * GET /api/sov/test
 * Test endpoint to verify SoV service is working (admin only)
 */
router.get('/test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const testInput = {
      brand: { name: "Notion", url: "notion.so" },
      competitors: [
        { name: "Obsidian", url: "obsidian.md" },
        { name: "Roam Research", url: "roamresearch.com" }
      ],
      vertical: "Knowledge Management",
      userId: req.user?.id ? parseInt(req.user.id) : undefined,
      clientId: req.user?.clientId ? parseInt(req.user.clientId) : undefined
    };

    logger.info('SoV test analysis started', { userId: req.user?.id });

    const result = await sovService.analyzeShareOfVoice(testInput);

    res.status(200).json({
      success: true,
      message: 'SoV service test completed successfully',
      data: {
        summary: result.summary,
        metricsPreview: {
          overallSoV: result.metrics.overallSoV,
          totalQuestions: result.summary.totalQuestions
        }
      }
    });

  } catch (error) {
    logger.error('SoV test failed', { 
      error: (error as Error).message,
      userId: req.user?.id 
    });

    res.status(500).json({
      success: false,
      error: 'SoV test failed',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    });
  }
});

/**
 * GET /api/sov/health
 * Health check for SoV service
 */
router.get('/health', async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.status(200).json({
      success: true,
      status: 'healthy',
      checks: {
        openaiConfigured: hasApiKey,
        serviceAvailable: true
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/sov/progress/:analysisId
 * Server-Sent Events endpoint for real-time progress updates
 */
router.get('/progress/:analysisId', requireAuth, (req, res) => {
  const { analysisId } = req.params;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  logger.info('SSE progress stream started', { analysisId, userId: req.user?.id });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Progress stream connected',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Listen for progress events from the SoV service
  const progressHandler = (progressData: any) => {
    if (progressData.analysisId === analysisId) {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        ...progressData
      })}\n\n`);
      
      // Send results when analysis is complete
      if (progressData.status === 'complete') {
        const results = (global as any).analysisResults?.[analysisId];
        if (results) {
          res.write(`data: ${JSON.stringify({
            type: 'results',
            data: results,
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          // Clean up stored results
          delete (global as any).analysisResults[analysisId];
        }
        
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({
            type: 'end',
            message: 'Analysis finished',
            timestamp: new Date().toISOString()
          })}\n\n`);
          res.end();
        }, 1000);
      }
      
      // Handle errors
      if (progressData.status === 'error') {
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({
            type: 'end',
            message: 'Analysis failed',
            timestamp: new Date().toISOString()
          })}\n\n`);
          res.end();
        }, 1000);
      }
    }
  };

  sovService.on('progress', progressHandler);

  // Clean up on client disconnect
  req.on('close', () => {
    logger.info('SSE progress stream closed', { analysisId, userId: req.user?.id });
    sovService.removeListener('progress', progressHandler);
  });

  // Timeout after 10 minutes
  setTimeout(() => {
    logger.info('SSE progress stream timeout', { analysisId, userId: req.user?.id });
    sovService.removeListener('progress', progressHandler);
    res.end();
  }, 600000);
});

export default router;