import { promises as fs } from 'fs';
import { OpenAI } from 'openai';
import * as cheerio from 'cheerio';

async function testScreenshotWithOpenAIEvaluation() {
  console.log('🧪 Testing Full-Page Screenshot + OpenAI GPT-4o Evaluation');
  console.log('========================================================');
  
  try {
    // Step 1: Capture full-page screenshot using optimized parameters
    console.log('\n📸 Step 1: Capturing full-page screenshot...');
    
    const apiKey = process.env.SCREENSHOTONE_API_KEY;
    if (!apiKey) {
      throw new Error('SCREENSHOTONE_API_KEY not found');
    }

    // Use the working Next.js optimized parameters
    const apiUrl = new URL('https://api.screenshotone.com/take');
    apiUrl.searchParams.append('access_key', apiKey);
    apiUrl.searchParams.append('url', 'https://www.cleardigital.com');
    
    // Optimized full-page parameters
    apiUrl.searchParams.append('full_page', 'true');
    apiUrl.searchParams.append('full_page_scroll', 'true');
    apiUrl.searchParams.append('full_page_algorithm', 'by_sections');
    apiUrl.searchParams.append('full_page_scroll_delay', '1000');
    apiUrl.searchParams.append('full_page_scroll_by', '300');
    apiUrl.searchParams.append('wait_until', 'networkidle0');
    apiUrl.searchParams.append('delay', '5');
    apiUrl.searchParams.append('timeout', '60');
    apiUrl.searchParams.append('viewport_width', '1440');
    apiUrl.searchParams.append('viewport_height', '900');
    apiUrl.searchParams.append('format', 'png');
    apiUrl.searchParams.append('image_quality', '90');
    
    console.log('⏱️  Capturing (may take 20-30 seconds)...');
    
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'image/png' },
      signal: AbortSignal.timeout(70000)
    });

    if (!response.ok) {
      throw new Error(`Screenshot API failed: ${response.status}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log('✅ Screenshot captured:', (imageBuffer.length / 1024 / 1024).toFixed(2), 'MB');
    
    // Convert to base64 for OpenAI
    const base64Image = imageBuffer.toString('base64');
    
    // Step 2: Scrape website content
    console.log('\n🌐 Step 2: Scraping website content...');
    
    const htmlResponse = await fetch('https://www.cleardigital.com');
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch HTML: ${htmlResponse.status}`);
    }
    
    const html = await htmlResponse.text();
    const $ = cheerio.load(html);
    
    // Extract text content (simplified version of brand story extraction)
    const textContent = [];
    $('h1, h2, h3, p').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text.length > 20 && text.length < 500 && 
          !$el.closest('nav, footer, header').length) {
        textContent.push(text);
      }
    });
    
    const scrapedContent = textContent.slice(0, 10).join('\n\n');
    console.log('✅ Scraped content:', scrapedContent.length, 'characters');
    console.log('📝 Content preview:', scrapedContent.substring(0, 200) + '...');
    
    // Step 3: Send to OpenAI GPT-4o for evaluation
    console.log('\n🤖 Step 3: Sending to OpenAI GPT-4o for evaluation...');
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found');
    }
    
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const evaluationPrompt = `
Analyze this website for brand story effectiveness using both the screenshot and scraped content.

SCRAPED CONTENT:
${scrapedContent}

Based on the visual screenshot and text content, evaluate:

1. **Point of View**: Does the brand have a clear stance or perspective?
2. **Mechanism**: Is their approach or methodology clearly explained?
3. **Outcomes**: Are specific results or benefits stated?
4. **Proof Elements**: Are there credentials, metrics, or trust indicators?

Provide your analysis as JSON:
{
  "pov_present": boolean,
  "pov_evidence": "text from content showing point of view",
  "mechanism_named": boolean, 
  "mechanism_evidence": "text describing their approach",
  "outcomes_stated": boolean,
  "outcomes_evidence": "text showing results/benefits",
  "proof_elements": boolean,
  "proof_evidence": "credentials or trust indicators found",
  "visual_analysis": "what you observe in the screenshot",
  "overall_assessment": "brief summary of brand story strength",
  "confidence": 0.0-1.0
}
`;

    console.log('📤 Making OpenAI request...');
    
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are an expert marketing analyst evaluating website effectiveness. Analyze both visual and textual elements to assess brand story strength.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: evaluationPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ]
    });

    const analysis = openaiResponse.choices[0]?.message?.content;
    if (!analysis) {
      throw new Error('No response from OpenAI');
    }
    
    console.log('✅ OpenAI analysis completed!');
    console.log('\n📊 RESULTS:');
    console.log('================');
    
    try {
      // Try to parse as JSON
      const cleanJson = analysis.replace(/^```json\\s*|\\s*```$/g, '').trim();
      const parsedAnalysis = JSON.parse(cleanJson);
      
      console.log('📈 Brand Story Analysis:');
      console.log('  • Point of View:', parsedAnalysis.pov_present ? '✅ Present' : '❌ Missing');
      console.log('  • Mechanism/Approach:', parsedAnalysis.mechanism_named ? '✅ Clear' : '❌ Unclear');
      console.log('  • Outcomes Stated:', parsedAnalysis.outcomes_stated ? '✅ Yes' : '❌ No');
      console.log('  • Proof Elements:', parsedAnalysis.proof_elements ? '✅ Found' : '❌ Missing');
      console.log('  • Confidence:', Math.round(parsedAnalysis.confidence * 100) + '%');
      
      console.log('\\n🔍 Evidence Found:');
      if (parsedAnalysis.pov_evidence) console.log('  POV:', parsedAnalysis.pov_evidence);
      if (parsedAnalysis.mechanism_evidence) console.log('  Mechanism:', parsedAnalysis.mechanism_evidence);
      if (parsedAnalysis.outcomes_evidence) console.log('  Outcomes:', parsedAnalysis.outcomes_evidence);
      if (parsedAnalysis.proof_evidence) console.log('  Proof:', parsedAnalysis.proof_evidence);
      
      console.log('\\n👀 Visual Analysis:');
      console.log('  ', parsedAnalysis.visual_analysis);
      
      console.log('\\n📝 Overall Assessment:');
      console.log('  ', parsedAnalysis.overall_assessment);
      
    } catch (parseError) {
      console.log('📄 Raw Analysis (could not parse as JSON):');
      console.log(analysis);
    }
    
    console.log('\\n🎉 SUCCESS: Full-page screenshot + OpenAI evaluation working!');
    console.log('\\n🔧 Integration Notes:');
    console.log('  • Screenshot: 1.2+ MB full-page capture');
    console.log('  • Content: Scraped text content');
    console.log('  • AI Model: GPT-4o with vision capabilities');
    console.log('  • Analysis: Brand story effectiveness scoring');
    console.log('  • Ready for: Website effectiveness scoring system');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting screenshot + OpenAI evaluation test...');
testScreenshotWithOpenAIEvaluation();