/**
 * Simple Effectiveness API Service
 * 
 * Direct fetch() calls matching the working test patterns.
 * No React Query complexity - just reliable API communication.
 * Based on proven working patterns from test_effectiveness_complete.ts
 */

import { errorHandler, AppError, NetworkError, AuthError } from '@/services/error/ErrorHandler';

// === INTERFACES (Matching UI Component Requirements) ===

interface CriterionScore {
  id: string;
  criterion: string;
  score: number;
  evidence: {
    description: string;
    details: Record<string, any>;
    reasoning: string;
  };
  passes: {
    passed: string[];
    failed: string[];
  };
}

interface EffectivenessRun {
  id: string;
  overallScore: number;
  status: 'pending' | 'initializing' | 'scraping' | 'analyzing' | 
          'tier1_analyzing' | 'tier1_complete' | 'tier2_analyzing' | 
          'tier2_complete' | 'tier3_analyzing' | 'completed' | 
          'failed' | 'generating_insights';
  progress?: string;
  progressDetail?: string | any;
  createdAt: string;
  criterionScores: CriterionScore[];
  screenshotUrl?: string;
  fullPageScreenshotUrl?: string;
  aiInsights?: any;
  insightsGeneratedAt?: string;
}

interface CompetitorEffectivenessData {
  competitor: {
    id: string;
    domain: string;
    label: string;
  };
  run: EffectivenessRun;
}

interface EffectivenessData {
  client: {
    id: string;
    name: string;
    websiteUrl: string;
  };
  run: EffectivenessRun | null;
  competitorEffectivenessData?: CompetitorEffectivenessData[];
  hasData: boolean;
}

interface EvidenceResponse {
  evidence: Array<{
    id: string;
    criterion: string;
    type: string;
    content: string;
    details: Record<string, any>;
    reasoning: string;
    passes: {
      passed: string[];
      failed: string[];
    };
  }>;
}

interface InsightsResponse {
  success: boolean;
  insights: {
    insight: string;
    recommendations: string[];
    confidence: number;
    key_pattern: string;
  };
  clientName: string;
  overallScore: number;
  runId: string;
  cached?: boolean;
}

// === API SERVICE CLASS ===

class EffectivenessApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/effectiveness';
  }

  /**
   * Make authenticated API request with proper error handling
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include auth cookies
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthError('Authentication required');
        }
        if (response.status === 403) {
          throw new AuthError('Access denied');
        }
        if (response.status === 404) {
          throw new AppError('Resource not found', 'NOT_FOUND');
        }
        if (response.status >= 500) {
          throw new NetworkError(`Server error: ${response.status}`);
        }
        throw new AppError(`Request failed: ${response.status}`, 'API_ERROR');
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Network/parsing errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network connection failed');
      }
      
      throw new AppError(
        error instanceof Error ? error.message : 'Unknown API error',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * GET /api/effectiveness/latest/:clientId
   * 
   * Primary data endpoint - matches working test pattern
   * Returns complete effectiveness data including competitors
   */
  async getLatestEffectiveness(clientId: string): Promise<EffectivenessData> {
    try {
      const data = await this.makeRequest<any>(`/latest/${clientId}`);
      
      // Sanitize and validate response
      const sanitizedData: EffectivenessData = {
        client: {
          id: data.client?.id || clientId,
          name: data.client?.name || 'Unknown Client',
          websiteUrl: data.client?.websiteUrl || data.client?.website || ''
        },
        run: data.run ? {
          id: data.run.id,
          overallScore: data.run.overallScore || 0,
          status: data.run.status || 'pending',
          progress: data.run.progress,
          progressDetail: data.run.progressDetail,
          createdAt: data.run.createdAt,
          criterionScores: data.run.criterionScores || [],
          screenshotUrl: data.run.screenshotUrl,
          fullPageScreenshotUrl: data.run.fullPageScreenshotUrl,
          aiInsights: data.run.aiInsights,
          insightsGeneratedAt: data.run.insightsGeneratedAt
        } : null,
        competitorEffectivenessData: this.transformCompetitorData(data.competitorEffectivenessData),
        hasData: !!data.run
      };

      return sanitizedData;

    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * POST /api/effectiveness/refresh/:clientId
   * 
   * Start new effectiveness analysis - matches test pattern
   */
  async startEffectivenessAnalysis(clientId: string, force = false): Promise<{ runId: string }> {
    try {
      const response = await this.makeRequest<{ runId: string }>(`/refresh/${clientId}`, {
        method: 'POST',
        body: JSON.stringify({ force })
      });

      return response;

    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * GET /api/effectiveness/:runId/evidence/:criterion
   * 
   * Get detailed evidence for specific criterion
   */
  async getEvidence(runId: string, criterion: string): Promise<EvidenceResponse> {
    try {
      const response = await this.makeRequest<EvidenceResponse>(`/${runId}/evidence/${criterion}`);
      return response;

    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * GET /api/effectiveness/:runId/evidence/all
   * 
   * Get all evidence for a run
   */
  async getAllEvidence(runId: string): Promise<EvidenceResponse> {
    try {
      const response = await this.makeRequest<EvidenceResponse>(`/${runId}/evidence/all`);
      return response;

    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * POST /api/effectiveness/:runId/insights
   * 
   * Generate AI insights for completed run
   */
  async generateInsights(clientId: string, runId: string): Promise<InsightsResponse> {
    try {
      const response = await this.makeRequest<InsightsResponse>(`/${runId}/insights`, {
        method: 'POST',
        body: JSON.stringify({ clientId })
      });

      return response;

    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * Transform competitor data to match UI requirements
   * 
   * Ensures consistent format for radar chart and evidence drawer
   */
  private transformCompetitorData(rawData: any[]): CompetitorEffectivenessData[] | undefined {
    if (!rawData || !Array.isArray(rawData)) {
      return undefined;
    }

    return rawData.map(item => ({
      competitor: {
        id: item.competitor?.id || item.competitorId || 'unknown',
        domain: item.competitor?.domain || item.competitor?.websiteUrl || 'unknown',
        label: item.competitor?.label || item.competitor?.name || item.competitor?.domain || 'Competitor'
      },
      run: {
        id: item.run?.id || 'unknown',
        overallScore: item.run?.overallScore || 0,
        status: item.run?.status || 'completed',
        progress: item.run?.progress,
        progressDetail: item.run?.progressDetail,
        createdAt: item.run?.createdAt || new Date().toISOString(),
        criterionScores: item.run?.criterionScores || [],
        screenshotUrl: item.run?.screenshotUrl,
        fullPageScreenshotUrl: item.run?.fullPageScreenshotUrl,
        aiInsights: item.run?.aiInsights,
        insightsGeneratedAt: item.run?.insightsGeneratedAt
      }
    }));
  }
}

// Export singleton instance
export const effectivenessApi = new EffectivenessApiService();
export default effectivenessApi;

// Export types for use in components
export type {
  EffectivenessData,
  EffectivenessRun,
  CriterionScore,
  CompetitorEffectivenessData,
  EvidenceResponse,
  InsightsResponse
};