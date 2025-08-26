/**
 * Website Effectiveness Scoring Types
 * 
 * Type definitions for the 8-criteria website scoring system
 */

export interface CriterionResult {
  criterion: string;
  score: number; // 0-10
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

export interface ScoringContext {
  websiteUrl: string;
  html: string;
  screenshot?: string;
  webVitals?: {
    lcp: number;
    cls: number;
    fid: number;
  };
}

export interface EffectivenessResult {
  overallScore: number;
  criterionResults: CriterionResult[];
  screenshotUrl?: string;
  webVitals?: {
    lcp: number;
    cls: number;
    fid: number;
  };
}

export interface ScoringConfig {
  buzzwords: string[];
  thresholds: {
    recent_months: number;
    hero_words: number;
    cta_dominance: number;
    proof_distance_px: number;
    lcp_limit: number;
    cls_limit: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  openai: {
    model: string;
    temperature: number;
  };
}

export interface OpenAIClassifier {
  name: string;
  prompt: string;
  schema: Record<string, any>;
}

// Default configuration
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  buzzwords: [
    "transformative", "revolutionary", "AI-driven", "cutting-edge", 
    "innovative", "next-generation", "groundbreaking", "disruptive"
  ],
  thresholds: {
    recent_months: 24,
    hero_words: 22,
    cta_dominance: 1.15,
    proof_distance_px: 600,
    lcp_limit: 3.0,
    cls_limit: 0.1
  },
  viewport: {
    width: 1440,
    height: 900
  },
  openai: {
    model: "gpt-4",
    temperature: 0.1
  }
};

// OpenAI Classifiers
export const OPENAI_CLASSIFIERS: Record<string, OpenAIClassifier> = {
  HERO: {
    name: "Hero Content Analysis",
    prompt: `Analyze the hero section copy for these criteria. Return JSON only:
    - audience_named: Is the target audience clearly identified?
    - outcome_present: Is a specific outcome or benefit mentioned?
    - capability_clear: Is what the company does clearly stated?
    - brevity_check: Is the message concise (under 22 words for main headline)?
    
    Hero content: {content}
    
    Return JSON: {"audience_named": boolean, "outcome_present": boolean, "capability_clear": boolean, "brevity_check": boolean, "confidence": 0-1}`,
    schema: {
      audience_named: "boolean",
      outcome_present: "boolean", 
      capability_clear: "boolean",
      brevity_check: "boolean",
      confidence: "number"
    }
  },
  
  STORY: {
    name: "Brand Story Analysis", 
    prompt: `Analyze content for brand story elements. Return JSON only:
    - pov_present: Is there a clear point of view or unique perspective?
    - mechanism_named: Is the specific method/approach mentioned?
    - outcomes_recent: Are there outcomes from the last 24 months mentioned?
    - case_complete: Are there complete case studies or success stories?
    
    Content: {content}
    
    Return JSON: {"pov_present": boolean, "mechanism_named": boolean, "outcomes_recent": boolean, "case_complete": boolean, "confidence": 0-1}`,
    schema: {
      pov_present: "boolean",
      mechanism_named: "boolean",
      outcomes_recent: "boolean", 
      case_complete: "boolean",
      confidence: "number"
    }
  },
  
  CTA_MATCH: {
    name: "CTA Message Match",
    prompt: `Compare CTA button text with destination page content for message consistency.
    
    CTA Text: "{cta_label}"
    Destination Content: "{destination_content}"
    
    Return JSON: {"matches": boolean, "confidence": 0-1, "reasoning": "explanation"}`,
    schema: {
      matches: "boolean",
      confidence: "number",
      reasoning: "string"
    }
  }
};