/**
 * Versioned AI Insights Routes
 * 
 * Handles versioned insights to eliminate stale data when metrics change
 */

import { Request, Response } from 'express';
import logger from '../utils/logging/logger.js';
import { MetricVersionService, migrateInsightVersion } from '../services/metricVersioning.js';
import { z } from 'zod';

const RegenerateRequestSchema = z.object({
  timePeriod: z.string(),
  reason: z.string().optional()
});

export function createVersionedInsightsRoutes(storage: any, backgroundProcessor: any) {
  const versionService = new MetricVersionService(storage);

  /**
   * Get versioned AI insights for a client
   * Returns either:
   * - { status: 'available', insights: [...] } if latest version has insights
   * - { status: 'pending', latestVersion, lastCompleteVersion?, fallbackInsights? } if generating
   */
  async function getVersionedInsights(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const { timePeriod } = req.query;

      if (!clientId || !timePeriod) {
        return res.status(400).json({ 
          message: "Client ID and time period are required" 
        });
      }

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const insightStatus = await versionService.getInsightStatus(clientId, timePeriod as string);

      if (insightStatus.status === 'available') {
        // Get insights for the latest version
        const insights = await storage.getAIInsightsByVersion(
          clientId, 
          timePeriod as string, 
          insightStatus.latestVersion
        );

        // Migrate any legacy insights without versions
        const migratedInsights = insights.map(migrateInsightVersion);

        return res.json({
          status: 'available',
          insights: migratedInsights,
          version: insightStatus.latestVersion
        });
      }

      // Status is pending - provide fallback insights if available
      let fallbackInsights = null;
      if (insightStatus.lastCompleteVersion) {
        fallbackInsights = await storage.getAIInsightsByVersion(
          clientId,
          timePeriod as string,
          insightStatus.lastCompleteVersion
        );
        fallbackInsights = fallbackInsights.map(migrateInsightVersion);
      }

      // Enqueue background job for latest version
      const jobData = {
        clientId,
        timePeriod: timePeriod as string,
        version: insightStatus.latestVersion,
        forceRegenerate: false
      };

      if (backgroundProcessor) {
        backgroundProcessor.enqueue('AI_INSIGHT_VERSIONED', jobData, {
          priority: 'high',
          retryLimit: 3
        });
      }

      return res.json({
        status: 'pending',
        latestVersion: insightStatus.latestVersion,
        lastCompleteVersion: insightStatus.lastCompleteVersion,
        fallbackInsights,
        message: 'Insights are being generated for the latest metrics'
      });

    } catch (error) {
      logger.error('Error getting versioned insights:', { 
        error: error instanceof Error ? error.message : String(error),
        clientId: req.params.clientId,
        timePeriod: req.query.timePeriod
      });
      
      // Return 200 with pending status instead of 500 for better UX
      return res.json({ 
        status: 'pending',
        insights: [],
        message: 'Insights are being processed. Please try again in a few moments.'
      });
    }
  }

  /**
   * Force regeneration of insights for the latest version (Admin only)
   */
  async function forceRegenerateInsights(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const body = RegenerateRequestSchema.parse(req.body);

      // Admin only
      if (!req.user || req.user.role !== "Admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      logger.info('Admin forcing insight regeneration', {
        clientId,
        timePeriod: body.timePeriod,
        reason: body.reason,
        adminUserId: req.user.id
      });

      // Force regenerate for the latest version
      const latestVersion = await versionService.forceRegenerate(clientId, body.timePeriod);

      // Enqueue background job
      const jobData = {
        clientId,
        timePeriod: body.timePeriod,
        version: latestVersion,
        forceRegenerate: true,
        reason: body.reason
      };

      if (backgroundProcessor) {
        backgroundProcessor.enqueue('AI_INSIGHT_VERSIONED', jobData, {
          priority: 'urgent',
          retryLimit: 3
        });
      }

      return res.json({
        message: 'Insight regeneration started',
        version: latestVersion,
        estimatedTime: '30-60 seconds'
      });

    } catch (error) {
      logger.error('Error forcing insight regeneration:', { 
        error: error instanceof Error ? error.message : String(error),
        clientId: req.params.clientId
      });
      
      return res.status(500).json({ 
        message: "Failed to force regeneration" 
      });
    }
  }

  /**
   * Get version status for a client (useful for polling)
   */
  async function getVersionStatus(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const { timePeriod } = req.query;

      if (!clientId) {
        return res.status(400).json({ 
          message: "Client ID is required" 
        });
      }
      
      // Use default time period if not provided
      const effectiveTimePeriod = (timePeriod as string) || "Last Month";

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const status = await versionService.getInsightStatus(clientId, effectiveTimePeriod);
      
      return res.json(status);

    } catch (error) {
      logger.error('Error getting version status:', { 
        error: error instanceof Error ? error.message : String(error),
        clientId: req.params.clientId,
        timePeriod: req.query.timePeriod
      });
      
      return res.status(500).json({ 
        message: "Failed to get version status" 
      });
    }
  }

  return {
    getVersionedInsights,
    forceRegenerateInsights,
    getVersionStatus
  };
}

export default createVersionedInsightsRoutes;