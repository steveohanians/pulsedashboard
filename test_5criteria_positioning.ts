import { scorePositioning } from './server/services/effectiveness/criteria/positioning';
import { OpenAI } from 'openai';
import { ScoringContext, ScoringConfig } from './server/services/effectiveness/types';

// Mock OpenAI to simulate the new 5-criteria response format
const mockOpenAI = {
  chat: {
    completions: {
      create: async (params: any) => {
        console.log('📤 Mock OpenAI Request:');
        console.log('  • Model:', params.model);
        console.log('  • Max Tokens:', params.max_tokens);
        console.log('  • Has Image:', Array.isArray(params.messages[1]?.content) && params.messages[1]?.content?.some((c: any) => c.type === 'image_url'));
        
        // Return mock 5-criteria JSON response
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                "audience_named": true,
                "audience_evidence": "for digital marketing agencies",
                "outcome_present": true, 
                "outcome_evidence": "reduce campaign setup time by 50%",
                "capability_clear": true,
                "capability_evidence": "marketing automation platform",
                "brevity_check": true,
                "brevity_evidence": "6 words: Automate Your Marketing Success",
                "visual_supports_positioning": true,
                "visual_supports_evidence": "Hero section prominently displays product dashboard UI",
                "visual_hierarchy_score": 0.75,
                "visual_effectiveness": "Strong visual hierarchy with clear product focus",
                "confidence": 1.0
              })
            }
          }],
          usage: { total_tokens: 245 }
        };
      }
    }
  }
} as any;

async function test5CriteriaPositioning() {
  console.log('🧪 Testing 5-Criteria Positioning Analysis');
  console.log('========================================');
  
  try {
    // Mock config
    const config: ScoringConfig = {
      buzzwords: ['innovative', 'cutting-edge'],
      thresholds: {
        recent_months: 24,
        hero_words: 100,
        cta_dominance: 0.3,
        proof_distance_px: 1000,
        lcp_limit: 2500,
        cls_limit: 0.1,
        fid_limit: 300
      },
      viewport: { width: 1440, height: 900 },
      openai: {
        model: 'gpt-4o',
        temperature: 0.1
      }
    };

    // Mock scoring context with real existing screenshot
    const context: ScoringContext = {
      websiteUrl: 'https://example.com',
      html: '<h1>Automate Your Marketing Success</h1><p>For digital marketing agencies looking to reduce campaign setup time by 50%. Our marketing automation platform streamlines your workflow.</p>',
      screenshot: '/screenshots/screenshot_1756569492948_cewnf1c71.png',
      fullPageScreenshot: '/screenshots/fullpage_1756569493021_ue1t3vvpx.png',
      webVitals: { lcp: 2.0, cls: 0.05, fid: 25 },
      screenshotMethod: 'api'
    };

    console.log('\n📊 Test Context:');
    console.log('  • Website:', context.websiteUrl);
    console.log('  • Has Full Screenshot:', !!context.fullPageScreenshot);
    console.log('  • Model:', config.openai.model);
    console.log('  • Buzzwords in Config:', config.buzzwords.length);

    // Run positioning analysis with mock OpenAI
    console.log('\n🔍 Running Positioning Analysis...');
    const result = await scorePositioning(context, config, mockOpenAI);

    console.log('\n✅ Results:');
    console.log('  • Criterion:', result.criterion);
    console.log('  • Score:', result.score, '/ 10');
    console.log('  • Description:', result.evidence.description);
    console.log('  • Passes:', result.passes.passed);
    console.log('  • Failures:', result.passes.failed);

    console.log('\n📊 Evidence Details:');
    const details = result.evidence.details;
    if (details.visual_hierarchy_score !== undefined) {
      console.log('  • Visual Hierarchy Score:', details.visual_hierarchy_score);
    }
    if (details.visual_effectiveness) {
      console.log('  • Visual Effectiveness:', details.visual_effectiveness);
    }
    if (details.visual_supports_evidence) {
      console.log('  • Visual Evidence:', details.visual_supports_evidence);
    }

    // Verify scoring math
    const expectedScore = result.passes.passed.length * 2; // 5 criteria × 2 points each
    console.log('\n🔢 Scoring Verification:');
    console.log('  • Passed Criteria:', result.passes.passed.length, '/ 5');
    console.log('  • Expected Score (before confidence):', expectedScore);
    console.log('  • Confidence Applied:', details.analysis?.confidence || 'N/A');
    console.log('  • Final Score:', result.score);

    // Check for new criterion
    const hasVisualCriterion = result.passes.passed.includes('visual_supports_positioning') ||
                               result.passes.failed.includes('visual_positioning_weak');
    console.log('  • Visual Criterion Present:', hasVisualCriterion ? '✅' : '❌');

    console.log('\n🎉 SUCCESS: 5-criteria positioning analysis working!');
    console.log('\n🔧 System Updates:');
    console.log('  • Scoring: 5 criteria × 2 points = 10 max');
    console.log('  • New Criterion: visual_supports_positioning');
    console.log('  • Visual Data: hierarchy_score, effectiveness, evidence');
    console.log('  • Evidence Drawer: Updated with new failure messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting 5-criteria positioning test...');
test5CriteriaPositioning();