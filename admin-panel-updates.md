# Admin Panel Updates for Evidence Extraction

## 1. POSITIONING TAB

### Prompt Template:
```
INPUT (hero fields already extracted from HTML):
{
  "h1": "{h1}",
  "subhead": "{subheading}",
  "first_paragraph": "{firstParagraph}",
  "joined_hero_500": "{content}"
}

TASK
Decide whether the hero clearly communicates positioning. Evaluate only the INPUT. Do NOT infer from company name, logo, or your prior knowledge.

NORMALIZE BEFORE CHECKING
- Trim, collapse whitespace, remove ™ and ®, strip leading/trailing punctuation.
- Ignore common CTAs/navigation words: ["get started","learn more","contact","pricing","sign in","log in","book a demo"].

CRITERIA (strict, with evidence extraction)
1) audience_named (TRUE if the target is explicit)
   - Look for explicit audience markers like "for", "to help", or noun phrases naming a role/industry/size:
     e.g., "for CFOs", "for B2B marketers", "for hospitals", "for SMBs/enterprises", "for developers/IT teams".
   - Vague words like "teams", "businesses", "companies" are FALSE unless qualified (e.g., "biotech companies").
   - Extract the exact text identifying the audience (or null if none found).

2) outcome_present (TRUE if a concrete benefit or result is stated)
   - Presence of an outcome with a benefit verb (increase, reduce, save, accelerate, improve, grow, convert, secure)
     and an object (revenue, cost, risk, time, leads, performance, uptime, compliance). Numbers strengthen but aren't required.
   - Pure features ("AI-powered dashboard") without a benefit are FALSE.
   - Extract the exact text describing the outcome/benefit (or null if none found).

3) capability_clear (TRUE if what the company does is explicit)
   - A recognizable product/service/category + domain, e.g., "analytics platform", "payments API", "cybersecurity software",
     "web design agency", "logistics marketplace", "compliance consulting".
   - Generic "solutions"/"platform" alone without domain or function is FALSE.
   - Extract the exact text describing the capability (or null if none found).

4) brevity_check (TRUE if the main headline is concise)
   - Count words in h1 only (fallback to subhead if h1 empty). Tokenize by whitespace; treat hyphenated terms as one word.
   - TRUE if count ≤ 22.
   - Include the word count and the text that was counted.

EDGE CASES
- If h1, subhead, and first_paragraph are empty or generic ("Welcome", "Home"), set all four booleans FALSE, all evidence fields null, and confidence low.
- If audience/outcome/capability appear only in boilerplate legal text or cookie notices, treat as NOT present.
- If h1 missing but subhead clearly states audience/outcome/capability, those criteria may still be TRUE.

CONFIDENCE (0–1)
- Start with (# of TRUE criteria)/4.
- Subtract 0.15 if any TRUE relied on weak/vague phrasing ("innovative solutions", "future-ready platform").
- Subtract 0.15 if h1 is missing and you relied on subhead/paragraph for most signals.
- Clamp to [0,1]. Round to two decimals.

OUTPUT
Return JSON ONLY with these keys in this order:
{
  "audience_named": <boolean>,
  "audience_evidence": <string or null>,
  "outcome_present": <boolean>,
  "outcome_evidence": <string or null>,
  "capability_clear": <boolean>,
  "capability_evidence": <string or null>,
  "brevity_check": <boolean>,
  "brevity_evidence": <string with format "X words: [text]" or null>,
  "confidence": <number>
}
```

### Expected Response Schema (JSON):
```json
{
  "audience_named": "boolean",
  "audience_evidence": "string|null",
  "outcome_present": "boolean",
  "outcome_evidence": "string|null",
  "capability_clear": "boolean",
  "capability_evidence": "string|null",
  "brevity_check": "boolean",
  "brevity_evidence": "string|null",
  "confidence": "number"
}
```

## 2. BRAND STORY TAB

### Prompt Template:
```
Analyze content for brand story elements. Return JSON only:
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
}
```

### Expected Response Schema (JSON):
```json
{
  "pov_present": "boolean",
  "pov_evidence": "string|null",
  "mechanism_named": "boolean",
  "mechanism_evidence": "string|null",
  "outcomes_recent": "boolean",
  "outcomes_evidence": "string|null",
  "case_complete": "boolean",
  "case_evidence": "string|null",
  "confidence": "number"
}
```

## 3. CTAs TAB

### Prompt Template:
```
Compare CTA button text with destination page content for message consistency.

CTA Text: "{cta_label}"
Destination Content: "{destination_content}"

Analyze:
1. Does the CTA text match what's on the destination page?
2. Extract the specific content from the destination that relates to the CTA promise
3. Identify any mismatch between promise and delivery

Return JSON with evidence:
{
  "matches": boolean,
  "match_evidence": "exact text from destination that fulfills CTA promise or null",
  "mismatch_details": "explanation of any discrepancy or null",
  "confidence": 0-1,
  "reasoning": "detailed explanation of match/mismatch"
}
```

### Expected Response Schema (JSON):
```json
{
  "matches": "boolean",
  "match_evidence": "string|null",
  "mismatch_details": "string|null",
  "confidence": "number",
  "reasoning": "string"
}
```

## HOW TO UPDATE:

1. Go to Admin Panel → Effectiveness Scoring Prompts
2. For each tab (Positioning, Brand Story, CTAs):
   - Copy the respective Prompt Template from above
   - Paste into "Prompt Template" field
   - Copy the respective Schema
   - Paste into "Expected Response Schema (JSON)" field
   - Click "Preview" to test
   - Click "Save Template"

## WHAT CHANGES:

The UI will now show:
- **Passed Checks**: Green badge + quoted evidence text
- **Failed Checks**: Red badge + "Not found in content"
- Evidence appears in italics next to each check
- Makes scoring transparent and actionable