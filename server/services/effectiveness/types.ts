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
    prompt: `Analyze website effectiveness data and generate actionable insights for {clientName} in the {industryVertical} industry ({businessSize} business).

Website URL: {websiteUrl}
Overall Score: {overallScore}/10

Criterion Performance:
{criteriaData}

Evidence Summary:
{evidenceSummary}

ANALYSIS FRAMEWORK:
Provide a structured analysis that identifies interconnected issues and focuses on ROI potential. Avoid generic advice like "improve user experience" or "update content regularly."

INSTRUCTIONS:
1. **Primary Issue Identification**: What is the main effectiveness problem based on the data?
2. **Root Cause Analysis**: Why does this problem exist? (technical, strategic, content, or UX factors)
3. **Business Impact Assessment**: How does this affect {clientName}'s {industryVertical} business goals?
4. **Industry Context**: Consider {industryVertical} industry standards and competitive landscape

AVOID:
- Generic recommendations like "improve SEO" or "add more content"
- One-size-fits-all advice that could apply to any website
- Suggestions without clear connection to the evidence provided
- Technical jargon without business context

FOCUS ON:
- Interconnected issues that compound effectiveness problems
- Industry-specific competitive advantages for {industryVertical} companies
- Resource allocation and ROI considerations for {businessSize} businesses
- Evidence-based actions tied directly to the score gaps identified

FORMAT RESPONSE AS JSON:
{
  "primary_issue": "Main effectiveness problem identified from the data",
  "root_cause": "Why this problem exists based on evidence",
  "business_impact": "How this affects {clientName}'s {industryVertical} business goals and competitive position",
  "key_insight": "Synthesized analysis connecting the dots between issues",
  "quick_wins": [
    {
      "action": "Specific actionable step",
      "priority": "High|Medium|Low",
      "effort": "Low|Medium|High", 
      "expected_impact": "Specific measurable outcome",
      "rationale": "Evidence-based reasoning tied to criteria scores",
      "timeline": "Immediate|2-4 weeks|1-3 months"
    }
  ],
  "strategic_initiatives": [
    {
      "action": "Larger strategic change",
      "priority": "High|Medium|Low",
      "effort": "Medium|High",
      "expected_impact": "Long-term business outcome",
      "rationale": "Evidence-based reasoning tied to criteria scores", 
      "timeline": "3-6 months|6+ months",
      "roi_potential": "High|Medium|Low"
    }
  ],
  "interconnected_benefits": "How implementing multiple recommendations creates compound effectiveness gains",
  "industry_considerations": "Specific factors relevant to {industryVertical} industry and {businessSize} business constraints",
  "confidence": 0.0-1.0
}

Generate insights that would specifically help a {industryVertical} {businessSize} business improve their competitive position through website effectiveness.`,
    schema: {
      primary_issue: "string",
      root_cause: "string", 
      business_impact: "string",
      key_insight: "string",
      quick_wins: "array",
      strategic_initiatives: "array",
      interconnected_benefits: "string",
      industry_considerations: "string",
      confidence: "number"
    }
  }
};