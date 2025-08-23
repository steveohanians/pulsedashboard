import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import logger from '../utils/logging/logger';

/**
 * Activity tracking middleware for monitoring user activity
 */
export class ActivityTracker {
  /**
   * Track page views for dashboard endpoint calls
   */
  static trackPageView = async (req: Request, res: Response, next: NextFunction) => {
    next(); // Continue with the request first
    
    // Track activity asynchronously after response
    if (req.user?.id) {
      try {
        const user = await storage.getUser(req.user.id);
        if (user) {
          await storage.updateUser(req.user.id, {
            pageViews: (user.pageViews || 0) + 1
          });
          logger.info('Page view tracked', { 
            userId: req.user.id, 
            endpoint: req.originalUrl,
            newCount: (user.pageViews || 0) + 1
          });
        }
      } catch (error) {
        logger.warn('Failed to track page view', { 
          userId: req.user.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  };

  /**
   * Track AI insights usage
   */
  static trackAIInsight = async (req: Request, res: Response, next: NextFunction) => {
    next(); // Continue with the request first
    
    // Track activity asynchronously after response
    if (req.user?.id) {
      try {
        const user = await storage.getUser(req.user.id);
        if (user) {
          await storage.updateUser(req.user.id, {
            aiInsightsCount: (user.aiInsightsCount || 0) + 1
          });
          logger.info('AI insight usage tracked', { 
            userId: req.user.id, 
            endpoint: req.originalUrl,
            newCount: (user.aiInsightsCount || 0) + 1
          });
        }
      } catch (error) {
        logger.warn('Failed to track AI insight usage', { 
          userId: req.user.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  };

  /**
   * Track Share of Voice generations
   */
  static trackSoVGeneration = async (req: Request, res: Response, next: NextFunction) => {
    next(); // Continue with the request first
    
    // Track activity asynchronously after response
    if (req.user?.id) {
      try {
        const user = await storage.getUser(req.user.id);
        if (user) {
          await storage.updateUser(req.user.id, {
            brandSovCount: (user.brandSovCount || 0) + 1
          });
          logger.info('SoV generation tracked', { 
            userId: req.user.id, 
            endpoint: req.originalUrl,
            newCount: (user.brandSovCount || 0) + 1
          });
        }
      } catch (error) {
        logger.warn('Failed to track SoV generation', { 
          userId: req.user.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  };
}