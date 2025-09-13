import { Router } from 'express';
import { semrushService } from '../services/semrush/semrushService';
import logger from '../utils/logging/logger';

const router = Router();

/**
 * Test endpoint to demonstrate SEMrush API rate limiting
 */
router.get('/test-rate-limiting', async (req, res) => {
  try {
    const requestCount = parseInt(req.query.requests as string) || 10;
    
    if (requestCount > 20) {
      return res.status(400).json({
        error: 'Maximum 20 requests allowed for testing'
      });
    }

    logger.info('Rate limiting test requested', { requestCount });
    
    const result = await semrushService.testRateLimiting(requestCount);
    
    res.json({
      success: true,
      test: {
        requestCount,
        totalTimeMs: result.requestTimes[result.requestTimes.length - 1],
        averageRatePerSecond: parseFloat(result.averageRate.toFixed(2)),
        targetRatePerSecond: 8,
        withinRateLimit: result.averageRate <= 8.5,
        requestTimings: result.requestTimes,
        rateLimiterStatus: result.rateLimiterStatus
      },
      message: result.averageRate <= 8.5 
        ? 'Rate limiting is working correctly' 
        : 'Rate limiting may need adjustment'
    });

  } catch (error) {
    logger.error('Rate limiting test failed', { error: (error as Error).message });
    res.status(500).json({
      error: 'Rate limiting test failed',
      message: (error as Error).message
    });
  }
});

/**
 * Get current rate limiter status
 */
router.get('/rate-limiter-status', (req, res) => {
  try {
    const status = semrushService.getRateLimiterStatus();
    
    res.json({
      success: true,
      rateLimiter: {
        ...status,
        healthStatus: status.tokensAvailable > 0 ? 'healthy' : 'depleted',
        recommendedAction: status.utilizationPercentage > 80 
          ? 'Consider slowing down requests' 
          : 'Normal operation'
      }
    });

  } catch (error) {
    logger.error('Failed to get rate limiter status', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to get rate limiter status',
      message: (error as Error).message
    });
  }
});

export default router;