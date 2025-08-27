/**
 * ValidationService
 * 
 * Comprehensive validation for effectiveness insights and related data.
 * Provides schema validation, business rule validation, and sanitization.
 */

import logger from '../../utils/logging/logger';
import { EffectivenessPromptBuilder } from './promptBuilder';
import type { CriterionResult } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitized?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface InsightsValidationOptions {
  requireMinRecommendations?: number;
  maxRecommendationLength?: number;
  validateBusinessLogic?: boolean;
  sanitizeHtml?: boolean;
}

/**
 * Comprehensive validation service for effectiveness data
 */
export class ValidationService {
  private readonly defaultOptions: Required<InsightsValidationOptions> = {
    requireMinRecommendations: 3,
    maxRecommendationLength: 200,
    validateBusinessLogic: true,
    sanitizeHtml: true
  };

  /**
   * Validates insights response structure and content
   */
  validateInsightsResponse(
    insights: any, 
    options: InsightsValidationOptions = {}
  ): ValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(insights, errors);
    
    // Content validation
    this.validateInsightContent(insights.insight, errors, warnings, opts);
    this.validateRecommendations(insights.recommendations, errors, warnings, opts);
    this.validateConfidence(insights.confidence, errors, warnings);
    this.validateKeyPattern(insights.key_pattern, errors);

    // Business logic validation
    if (opts.validateBusinessLogic) {
      this.validateBusinessLogic(insights, errors, warnings);
    }

    // Sanitization if requested
    let sanitized;
    if (opts.sanitizeHtml) {
      sanitized = this.sanitizeInsights(insights);
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      ...(sanitized && { sanitized })
    };

    // Log validation results
    if (errors.length > 0) {
      logger.warn('Insights validation failed', {
        errorCount: errors.length,
        warningCount: warnings.length,
        errors: errors.map(e => ({ field: e.field, code: e.code }))
      });
    } else if (warnings.length > 0) {
      logger.info('Insights validation passed with warnings', {
        warningCount: warnings.length,
        warnings: warnings.map(w => ({ field: w.field, code: w.code }))
      });
    }

    return result;
  }

  /**
   * Validates criterion scores data
   */
  validateCriterionScores(criterionScores: any[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!Array.isArray(criterionScores)) {
      errors.push({
        field: 'criterionScores',
        message: 'Criterion scores must be an array',
        code: 'INVALID_TYPE',
        severity: 'critical'
      });
      return { isValid: false, errors, warnings };
    }

    if (criterionScores.length === 0) {
      errors.push({
        field: 'criterionScores',
        message: 'At least one criterion score is required',
        code: 'EMPTY_ARRAY',
        severity: 'critical'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate each criterion score
    criterionScores.forEach((criterion, index) => {
      this.validateCriterionScore(criterion, index, errors, warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates effectiveness run data
   */
  validateEffectivenessRun(runData: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredFields = ['clientId', 'overallScore', 'status'];
    requiredFields.forEach(field => {
      if (!runData[field]) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD',
          severity: 'critical'
        });
      }
    });

    // Validate overall score
    if (runData.overallScore !== undefined) {
      const score = parseFloat(runData.overallScore);
      if (isNaN(score) || score < 0 || score > 10) {
        errors.push({
          field: 'overallScore',
          message: 'Overall score must be a number between 0 and 10',
          code: 'INVALID_SCORE_RANGE',
          severity: 'error'
        });
      }
    }

    // Validate status
    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (runData.status && !validStatuses.includes(runData.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates basic insights structure
   */
  private validateBasicStructure(insights: any, errors: ValidationError[]): void {
    if (!insights || typeof insights !== 'object') {
      errors.push({
        field: 'root',
        message: 'Insights must be a valid object',
        code: 'INVALID_TYPE',
        severity: 'critical'
      });
      return;
    }

    const requiredFields = ['insight', 'recommendations', 'confidence', 'key_pattern'];
    requiredFields.forEach(field => {
      if (!(field in insights)) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD',
          severity: 'critical'
        });
      }
    });
  }

  /**
   * Validates insight content
   */
  private validateInsightContent(
    insight: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[],
    options: Required<InsightsValidationOptions>
  ): void {
    if (!insight) return;

    if (typeof insight !== 'string') {
      errors.push({
        field: 'insight',
        message: 'Insight must be a string',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    // Length validation
    if (insight.length < 50) {
      warnings.push({
        field: 'insight',
        message: 'Insight seems too short for actionable analysis',
        code: 'SHORT_CONTENT',
        suggestion: 'Provide more detailed analysis of the data patterns'
      });
    }

    if (insight.length > 1000) {
      warnings.push({
        field: 'insight',
        message: 'Insight is very long and may be hard to digest',
        code: 'LONG_CONTENT',
        suggestion: 'Consider condensing to key points'
      });
    }

    // Content quality checks
    this.validateInsightQuality(insight, warnings);
  }

  /**
   * Validates recommendations array
   */
  private validateRecommendations(
    recommendations: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    options: Required<InsightsValidationOptions>
  ): void {
    if (!recommendations) return;

    if (!Array.isArray(recommendations)) {
      errors.push({
        field: 'recommendations',
        message: 'Recommendations must be an array',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    // Minimum recommendations check
    if (recommendations.length < options.requireMinRecommendations) {
      errors.push({
        field: 'recommendations',
        message: `At least ${options.requireMinRecommendations} recommendations required`,
        code: 'INSUFFICIENT_RECOMMENDATIONS',
        severity: 'error'
      });
    }

    // Maximum recommendations check
    if (recommendations.length > 6) {
      warnings.push({
        field: 'recommendations',
        message: 'Too many recommendations may overwhelm users',
        code: 'TOO_MANY_RECOMMENDATIONS',
        suggestion: 'Focus on the most impactful 3-4 recommendations'
      });
    }

    // Validate each recommendation
    recommendations.forEach((rec: any, index: number) => {
      this.validateRecommendation(rec, index, errors, warnings, options);
    });

    // Check for duplicates
    this.validateRecommendationDuplicates(recommendations, warnings);
  }

  /**
   * Validates individual recommendation
   */
  private validateRecommendation(
    recommendation: any,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    options: Required<InsightsValidationOptions>
  ): void {
    const fieldName = `recommendations[${index}]`;

    if (typeof recommendation !== 'string') {
      errors.push({
        field: fieldName,
        message: 'Each recommendation must be a string',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    // Length validation
    if (recommendation.length < 10) {
      warnings.push({
        field: fieldName,
        message: 'Recommendation seems too brief',
        code: 'SHORT_RECOMMENDATION',
        suggestion: 'Provide more specific guidance'
      });
    }

    if (recommendation.length > options.maxRecommendationLength) {
      warnings.push({
        field: fieldName,
        message: 'Recommendation is too long',
        code: 'LONG_RECOMMENDATION',
        suggestion: 'Keep recommendations concise and actionable'
      });
    }

    // Content quality validation
    this.validateRecommendationQuality(recommendation, fieldName, warnings);
  }

  /**
   * Validates confidence score
   */
  private validateConfidence(
    confidence: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (confidence === undefined) return;

    if (typeof confidence !== 'number') {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be a number',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    if (confidence < 0 || confidence > 1) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be between 0 and 1',
        code: 'INVALID_RANGE',
        severity: 'error'
      });
    }

    // Reasonable confidence warnings
    if (confidence < 0.3) {
      warnings.push({
        field: 'confidence',
        message: 'Very low confidence in insights',
        code: 'LOW_CONFIDENCE',
        suggestion: 'Consider providing more conservative recommendations'
      });
    }
  }

  /**
   * Validates key pattern
   */
  private validateKeyPattern(
    keyPattern: any,
    errors: ValidationError[]
  ): void {
    if (!keyPattern) return;

    if (typeof keyPattern !== 'string') {
      errors.push({
        field: 'key_pattern',
        message: 'Key pattern must be a string',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    if (!EffectivenessPromptBuilder.validateKeyPattern(keyPattern)) {
      errors.push({
        field: 'key_pattern',
        message: `Invalid key pattern: ${keyPattern}`,
        code: 'INVALID_PATTERN',
        severity: 'error'
      });
    }
  }

  /**
   * Validates individual criterion score
   */
  private validateCriterionScore(
    criterion: any,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const fieldName = `criterionScores[${index}]`;

    if (!criterion || typeof criterion !== 'object') {
      errors.push({
        field: fieldName,
        message: 'Each criterion must be an object',
        code: 'INVALID_TYPE',
        severity: 'error'
      });
      return;
    }

    // Required fields
    const requiredFields = ['criterion', 'score'];
    requiredFields.forEach(field => {
      if (!(field in criterion)) {
        errors.push({
          field: `${fieldName}.${field}`,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD',
          severity: 'error'
        });
      }
    });

    // Score validation
    if (typeof criterion.score === 'number') {
      if (criterion.score < 0 || criterion.score > 10) {
        errors.push({
          field: `${fieldName}.score`,
          message: 'Score must be between 0 and 10',
          code: 'INVALID_SCORE_RANGE',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validates business logic rules
   */
  private validateBusinessLogic(
    insights: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check if recommendations align with key pattern
    const keyPattern = insights.key_pattern;
    const recommendations = insights.recommendations || [];

    if (keyPattern === 'strong_foundation' && recommendations.length > 3) {
      warnings.push({
        field: 'recommendations',
        message: 'Strong foundation sites may not need many changes',
        code: 'PATTERN_MISMATCH',
        suggestion: 'Focus on optimization rather than major changes'
      });
    }

    if (keyPattern === 'technical_issues') {
      const hasTechnicalRecs = recommendations.some((rec: string) => 
        rec.toLowerCase().includes('load') ||
        rec.toLowerCase().includes('performance') ||
        rec.toLowerCase().includes('speed')
      );

      if (!hasTechnicalRecs) {
        warnings.push({
          field: 'recommendations',
          message: 'Technical issues pattern should include performance recommendations',
          code: 'MISSING_TECHNICAL_RECS',
          suggestion: 'Add performance-related recommendations'
        });
      }
    }
  }

  /**
   * Validates insight content quality
   */
  private validateInsightQuality(insight: string, warnings: ValidationWarning[]): void {
    // Check for generic phrases
    const genericPhrases = [
      'improve user experience',
      'optimize your website',
      'enhance performance',
      'better conversions'
    ];

    const hasGenericContent = genericPhrases.some(phrase => 
      insight.toLowerCase().includes(phrase)
    );

    if (hasGenericContent) {
      warnings.push({
        field: 'insight',
        message: 'Insight contains generic language',
        code: 'GENERIC_CONTENT',
        suggestion: 'Use more specific, data-driven language'
      });
    }

    // Check for data references
    const hasDataReferences = /\d+(\.\d+)?\/10|\d+%|score|performance|criteria/.test(insight.toLowerCase());
    
    if (!hasDataReferences) {
      warnings.push({
        field: 'insight',
        message: 'Insight should reference specific data points',
        code: 'NO_DATA_REFERENCES',
        suggestion: 'Include specific scores or metrics from the analysis'
      });
    }
  }

  /**
   * Validates recommendation quality
   */
  private validateRecommendationQuality(
    recommendation: string,
    fieldName: string,
    warnings: ValidationWarning[]
  ): void {
    // Check for actionable language
    const actionWords = [
      'add', 'remove', 'improve', 'optimize', 'create', 'update',
      'implement', 'reduce', 'increase', 'enhance', 'fix'
    ];

    const hasActionWord = actionWords.some(word => 
      recommendation.toLowerCase().startsWith(word)
    );

    if (!hasActionWord) {
      warnings.push({
        field: fieldName,
        message: 'Recommendation should start with an action word',
        code: 'NO_ACTION_WORD',
        suggestion: 'Start with a clear action verb'
      });
    }

    // Check for vague language
    const vagueTerms = ['better', 'more', 'good', 'nice', 'great'];
    const hasVagueTerms = vagueTerms.some(term => 
      recommendation.toLowerCase().includes(term)
    );

    if (hasVagueTerms) {
      warnings.push({
        field: fieldName,
        message: 'Recommendation contains vague language',
        code: 'VAGUE_LANGUAGE',
        suggestion: 'Use specific, measurable language'
      });
    }
  }

  /**
   * Checks for duplicate recommendations
   */
  private validateRecommendationDuplicates(
    recommendations: string[],
    warnings: ValidationWarning[]
  ): void {
    const seen = new Set();
    const duplicates = [];

    for (const rec of recommendations) {
      const normalized = rec.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push(rec);
      } else {
        seen.add(normalized);
      }
    }

    if (duplicates.length > 0) {
      warnings.push({
        field: 'recommendations',
        message: 'Duplicate recommendations found',
        code: 'DUPLICATE_RECOMMENDATIONS',
        suggestion: 'Ensure all recommendations are unique'
      });
    }
  }

  /**
   * Sanitizes insights content
   */
  private sanitizeInsights(insights: any): any {
    const sanitized = JSON.parse(JSON.stringify(insights));

    // Basic HTML sanitization (remove tags)
    if (sanitized.insight) {
      sanitized.insight = this.stripHtml(sanitized.insight);
    }

    if (Array.isArray(sanitized.recommendations)) {
      sanitized.recommendations = sanitized.recommendations.map((rec: string) => 
        this.stripHtml(rec)
      );
    }

    return sanitized;
  }

  /**
   * Strips HTML tags from text
   */
  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
  }
}