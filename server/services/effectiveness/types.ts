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
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0.1
  }
};

// OpenAI Classifiers
export const OPENAI_CLASSIFIERS: Record<string, OpenAIClassifier> = {
  HERO: {
    name: "Hero Content Analysis",
    prompt: `Analyze the hero section copy for these criteria. Return JSON only:
    - audience_named: Is the target audience clearly identified? Include the actual audience mentioned.
    - outcome_present: Is a specific outcome or benefit mentioned? Include the outcome text.
    - capability_clear: Is what the company does clearly stated? Include the capability description.
    - brevity_check: Is the message concise (under 22 words for main headline)? Include word count.
    
    Hero content: {content}
    
    Return JSON with both boolean checks and evidence:
    {
      "audience_named": boolean,
      "audience_evidence": "exact text identifying audience or null",
      "outcome_present": boolean,
      "outcome_evidence": "exact text describing outcome or null",
      "capability_clear": boolean,
      "capability_evidence": "exact text describing capability or null",
      "brevity_check": boolean,
      "brevity_evidence": "word count and headline text or null",
      "confidence": 0-1
    }`,
    schema: {
      audience_named: "boolean",
      audience_evidence: "string|null",
      outcome_present: "boolean",
      outcome_evidence: "string|null",
      capability_clear: "boolean",
      capability_evidence: "string|null",
      brevity_check: "boolean",
      brevity_evidence: "string|null",
      confidence: "number"
    }
  },
  
  STORY: {
    name: "Brand Story Analysis", 
    prompt: `Analyze content for brand story elements. Return JSON only:
    - pov_present: Is there a clear point of view or unique perspective? Include the POV text.
    - mechanism_named: Is the specific method/approach mentioned? Include the mechanism description.
    - outcomes_recent: Are there outcomes from the last 24 months mentioned? Include the outcome examples.
    - case_complete: Are there complete case studies or success stories? Include case study reference.
    
    Content: {content}
    
    Return JSON with both boolean checks and evidence:
    {
      "pov_present": boolean,
      "pov_evidence": "exact text showing POV or null",
      "mechanism_named": boolean,
      "mechanism_evidence": "exact text describing mechanism or null",
      "outcomes_recent": boolean,
      "outcomes_evidence": "exact text of recent outcomes or null",
      "case_complete": boolean,
      "case_evidence": "case study description or null",
      "confidence": 0-1
    }`,
    schema: {
      pov_present: "boolean",
      pov_evidence: "string|null",
      mechanism_named: "boolean",
      mechanism_evidence: "string|null",
      outcomes_recent: "boolean",
      outcomes_evidence: "string|null",
      case_complete: "boolean",
      case_evidence: "string|null",
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
  },
  
  INSIGHTS: {
    name: "Effectiveness Insights Generation",
    prompt: `Analyze website effectiveness data and generate personalized insights for {clientName}.

Website URL: {websiteUrl}
Overall Score: {overallScore}/10

Criterion Performance:
{criteriaData}

Evidence Summary:
{evidenceSummary}

Generate a personalized key insight that:
1. Identifies the main pattern in the data (what's working vs what's not)
2. Explains WHY this pattern exists based on the specific evidence
3. Provides 3-4 specific, actionable recommendations based on actual gaps found
4. Uses the client's actual website context and business focus

Format your response as:
Key Insight for {clientName}:
[Your analysis of the main pattern and why it exists]

This suggests an opportunity to:
1. [Specific action based on actual evidence]
2. [Specific action based on actual evidence] 
3. [Specific action based on actual evidence]
4. [Optional fourth action if warranted]

Focus on authentic insights from real data, not generic advice.`,
    schema: {
      insight: "string",
      recommendations: "array",
      confidence: "number",
      key_pattern: "string"
    }
  }
};