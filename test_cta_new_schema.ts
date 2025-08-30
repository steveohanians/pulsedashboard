import { scoreCTAs } from './server/services/effectiveness/criteria/ctas';
import { OpenAI } from 'openai';
import { ScoringContext, ScoringConfig } from './server/services/effectiveness/types';

async function testNewCTASchema() {
  console.log('🧪 Testing New CTA Schema Implementation');
  console.log('========================================');
  
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

    // Mock scoring context with comprehensive CTA content
    const context: ScoringContext = {
      websiteUrl: 'https://example.com',
      html: `
        <header>
          <nav>
            <a href="/signup" class="btn btn-primary">Get Started Free</a>
            <a href="/pricing" class="btn btn-outline">View Pricing</a>
          </nav>
        </header>
        <main>
          <section class="hero">
            <h1>Transform Your Business</h1>
            <p>Join 10,000+ companies using our platform</p>
            <a href="/trial" class="btn btn-primary btn-large">Start 14-Day Free Trial</a>
            <a href="/demo" class="btn btn-secondary">Book a Demo</a>
          </section>
          <section class="features">
            <h2>Key Features</h2>
            <p>Our comprehensive solution includes...</p>
            <a href="/learn-more" class="btn btn-link">Learn More</a>
          </section>
          <section class="testimonials">
            <h2>What Our Customers Say</h2>
            <p>Amazing results with this platform...</p>
            <a href="/contact" class="btn btn-outline">Contact Sales</a>
          </section>
        </main>
        <footer>
          <div class="footer-cta">
            <h3>Ready to Get Started?</h3>
            <a href="/signup" class="btn btn-primary">Sign Up Today</a>
          </div>
          <a href="/support">Support</a>
          <a href="/login">Sign In</a>
        </footer>
      `,
      screenshot: '/screenshots/screenshot_1756569492948_cewnf1c71.png',
      fullPageScreenshot: '/screenshots/fullpage_1756569493021_ue1t3vvpx.png',
      webVitals: { lcp: 2.0, cls: 0.05, fid: 25 },
      screenshotMethod: 'api'
    };

    console.log('\n📊 Test Context:');
    console.log('  • Website:', context.websiteUrl);
    console.log('  • HTML CTAs Found:', (context.html.match(/class="btn/g) || []).length);
    console.log('  • Model:', config.openai.model);

    // Run new CTA analysis with detailed schema
    console.log('\n🔍 Running New CTA Schema Analysis...');
    const result = await scoreCTAs(context, config, openai);

    console.log('\n✅ Analysis Results:');
    console.log('  • Criterion:', result.criterion);
    console.log('  • Score:', result.score, '/ 10');
    console.log('  • Description:', result.evidence.description);
    console.log('  • Passed Checks:', result.passes.passed);
    console.log('  • Failed Checks:', result.passes.failed);

    console.log('\n📋 New Schema Evidence Details:');
    const details = result.evidence.details;
    console.log('  • Analysis Object:', typeof details.analysis);
    
    if (details.analysis) {
      const analysis = details.analysis;
      console.log('  • CTA Present:', analysis.cta_present);
      console.log('  • Primary Examples:', analysis.cta_primary_examples);
      console.log('  • Secondary Examples:', analysis.cta_secondary_examples);
      console.log('  • Above Fold:', analysis.cta_above_fold);
      console.log('  • Page End:', analysis.cta_page_end);
      console.log('  • Block Closure:', analysis.cta_block_closure);
      console.log('  • Block Examples:', analysis.cta_block_examples);
      console.log('  • Strength Score:', analysis.cta_strength_score);
      console.log('  • CTA Groups Used:', analysis.primary_cta_groups_used);
      console.log('  • CTA Conflict:', analysis.cta_conflict);
      console.log('  • OCR Status:', analysis.ocr_status);
      console.log('  • Issues:', analysis.extraction_issues);
    }

    console.log('\n🔍 Evidence Text:');
    if (details.cta_evidence) {
      console.log('  • CTA Evidence:', details.cta_evidence);
    }
    if (details.cta_primary_examples) {
      console.log('  • Primary Examples:', details.cta_primary_examples);
    }
    if (details.cta_secondary_examples) {
      console.log('  • Secondary Examples:', details.cta_secondary_examples);
    }

    console.log('\n🔢 Scoring Verification:');
    console.log('  • Strength Score:', details.cta_strength_score);
    console.log('  • Converted to 10-scale:', (details.cta_strength_score || 0) * 10);
    console.log('  • Final Score:', result.score);
    
    console.log('\n🎉 SUCCESS: New CTA schema implementation working!');
    console.log('\n📈 Schema Transformation:');
    console.log('  • OLD: Simple 5-criteria boolean system');
    console.log('  • NEW: Detailed CTA-specific analysis with:');
    console.log('    - Primary/Secondary CTA classification');
    console.log('    - Position analysis (above-fold, page-end, block-closure)');
    console.log('    - Strength scoring (0.00-1.00 in 0.25 steps)');
    console.log('    - Conflict detection');
    console.log('    - OCR status tracking');
    console.log('    - Comprehensive evidence extraction');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.substring(0, 500) + '...');
    }
  }
}

// Run the test
console.log('🚀 Starting new CTA schema test...');
testNewCTASchema();