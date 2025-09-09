import { db } from './server/db';
import { storage } from './server/storage';

async function updateCTAPrompt() {
  console.log('\n=== Surgical CTA Prompt Update ===\n');
  
  try {
    // First, get the current prompt to preserve everything
    const currentPrompt = await storage.getEffectivenessPromptTemplate('ctas');
    
    if (!currentPrompt || !currentPrompt.promptTemplate) {
      console.log('❌ No CTA prompt found to update');
      process.exit(1);
    }
    
    console.log('✓ Current prompt retrieved');
    
    // Make surgical changes to the prompt template
    let updatedTemplate = currentPrompt.promptTemplate;
    
    // 1. Update above-the-fold definition from 250 to 1500 characters
    updatedTemplate = updatedTemplate.replace(
      'first 25% of lines OR first 250 characters of the full page text.',
      'first 35% of lines OR first 1500 characters of the full page text.'
    );
    console.log('✓ Updated above-the-fold character limit: 250 → 1500');
    
    // 2. Add navigation recognition rule after the POSITIONAL WINDOWS section
    const navigationRule = `
NAVIGATION RECOGNITION (special handling)
- CTAs found within navigation, header, menu, or nav elements are ALWAYS considered above-the-fold.
- If text includes phrases like "nav", "menu", "header" near a CTA, treat it as above-the-fold.
- If OCR shows blank/white areas at page top but text includes navigation-related CTAs, assume these are above-the-fold.
`;
    
    // Insert after POSITIONAL WINDOWS section
    updatedTemplate = updatedTemplate.replace(
      'DETECTION RULES',
      navigationRule + 'DETECTION RULES'
    );
    console.log('✓ Added navigation recognition rules');
    
    // 3. Enhance the IMAGE/OCR section to handle JavaScript navigation
    updatedTemplate = updatedTemplate.replace(
      '* If image present and ocr_status ≠ "ok", add "visual_cta_unassessed" to extraction_issues.',
      `* If image present and ocr_status ≠ "ok", add "visual_cta_unassessed" to extraction_issues.
  * If visual OCR is blank/degraded but text content contains CTAs in early positions (first 1500 chars), trust the text content for positional determination.`
    );
    console.log('✓ Enhanced visual/text reconciliation');
    
    // 4. Explicitly add "let's chat" to the contact group (if not already there)
    updatedTemplate = updatedTemplate.replace(
      '"let\'s talk", "lets talk"',
      '"let\'s talk", "lets talk", "let\'s chat", "lets chat"'
    );
    console.log('✓ Added "let\'s chat" variants to contact CTAs');
    
    // Now update ONLY the ctas prompt in the database
    const result = await db.execute(`
      UPDATE effectiveness_prompt_templates 
      SET 
        prompt_template = $1,
        updated_at = NOW()
      WHERE criterion = 'ctas'
      RETURNING criterion
    `, [updatedTemplate]);
    
    if (result.rows && result.rows.length > 0) {
      console.log('\n✅ Successfully updated CTA prompt in database');
      console.log('   - Only modified: ctas criterion');
      console.log('   - Changes applied:');
      console.log('     • Above-the-fold: 250 chars → 1500 chars');
      console.log('     • Added navigation recognition rules');
      console.log('     • Enhanced visual/text reconciliation');
      console.log('     • Added "let\'s chat" variants');
    } else {
      console.log('❌ No rows updated - prompt may not exist');
    }
    
  } catch (error) {
    console.error('❌ Error updating prompt:', error);
  }
  
  process.exit(0);
}

updateCTAPrompt();
