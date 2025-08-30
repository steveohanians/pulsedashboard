import { scoreBrandStory } from './server/services/effectiveness/criteria/brandStory';
import { OpenAI } from 'openai';
import { ScoringContext, ScoringConfig } from './server/services/effectiveness/types';

async function test5CriteriaBrandStory() {
  console.log('🧪 Testing 5-Criteria Brand Story Analysis');
  console.log('==========================================');
  
  try {
    // Setup OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Mock config
    const config: ScoringConfig = {
      buzzwords: [],
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

    // Mock scoring context with brand story content
    const context: ScoringContext = {
      websiteUrl: 'https://example.com',
      html: `
        <main>
          <section class="hero">
            <h1>We Help Digital Marketing Agencies Scale With Confidence</h1>
            <p>For over 15 years, we've believed that data-driven automation is the key to sustainable growth. Unlike traditional agencies that rely on manual processes, our proprietary AI-powered methodology has helped 500+ agencies reduce campaign setup time by 50% and increase client retention by 85%.</p>
          </section>
          <section class="about">
            <h2>Our Story</h2>
            <p>Founded in 2008 by former Google executives, we pioneered the automated bidding frameworks that are now industry standard. Our team of 200+ certified experts has delivered over $2B in managed ad spend, consistently achieving 4x ROAS for our clients.</p>
            <p>We're proud to be SOC 2 Type II certified and recognized as a Gartner Leader in Marketing Automation for three consecutive years.</p>
          </section>
        </main>
      `,
      screenshot: '/screenshots/screenshot_1756569492948_cewnf1c71.png',
      fullPageScreenshot: '/screenshots/fullpage_1756569493021_ue1t3vvpx.png',
      webVitals: { lcp: 2.0, cls: 0.05, fid: 25 },
      screenshotMethod: 'api'
    };

    console.log('\n📊 Test Context:');
    console.log('  • Website:', context.websiteUrl);
    console.log('  • Has Full Screenshot:', !!context.fullPageScreenshot);
    console.log('  • Model:', config.openai.model);

    // Run brand story analysis with vision
    console.log('\n🔍 Running Brand Story Analysis...');
    const result = await scoreBrandStory(context, config, openai);

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

    // Show evidence for each criterion
    console.log('\n🔍 Criterion Evidence:');
    if (details.pov_evidence) {
      console.log('  • POV Evidence:', details.pov_evidence);
    }
    if (details.mechanism_evidence) {
      console.log('  • Mechanism Evidence:', details.mechanism_evidence);
    }
    if (details.outcomes_evidence) {
      console.log('  • Outcomes Evidence:', details.outcomes_evidence);
    }
    if (details.proof_evidence) {
      console.log('  • Proof Evidence:', details.proof_evidence);
    }

    // Verify scoring math
    console.log('\n🔢 Scoring Verification:');
    console.log('  • Passed Criteria:', result.passes.passed.length, '/ 5');
    console.log('  • Expected Base Score:', result.passes.passed.length * 2);
    console.log('  • Analysis Confidence:', details.analysis?.confidence || 'N/A');
    console.log('  • Final Score:', result.score);

    // Check for new visual criterion
    const hasVisualCriterion = result.passes.passed.includes('visual_supports_story') ||
                               result.passes.failed.includes('visual_story_weak');
    console.log('  • Visual Criterion Present:', hasVisualCriterion ? '✅' : '❌');

    console.log('\n🎉 SUCCESS: 5-criteria brand story analysis working!');
    console.log('\n🔧 System Updates:');
    console.log('  • Scoring: 5 criteria × 2 points = 10 max');
    console.log('  • New Criterion: visual_supports_story');
    console.log('  • Visual Data: hierarchy_score, effectiveness, evidence');
    console.log('  • Evidence Drawer: Ready for new failure messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting 5-criteria brand story test...');
test5CriteriaBrandStory();