import { Router } from 'express';
import { z } from 'zod';
import { sovService } from '../services/sov/sovService';
import { requireAuth, requireAdmin } from '../middleware/auth';
import logger from '../utils/logging/logger';

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

    // Add user context with proper type conversion
    const analysisInput = {
      ...validatedInput,
      userId: req.user?.id ? parseInt(req.user.id) : undefined,
      clientId: req.user?.clientId ? parseInt(req.user.clientId) : undefined
    };

    // Perform analysis
    const result = await sovService.analyzeShareOfVoice(analysisInput);

    logger.info('SoV analysis completed successfully', {
      brand: validatedInput.brand.name,
      totalQuestions: result.summary.totalQuestions,
      overallSoV: result.metrics.overallSoV
    });

    res.status(200).json({
      success: true,
      data: result
    });

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

export default router;