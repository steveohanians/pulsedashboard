
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Files and directories related to effectiveness audit
const effectivenessFiles = [
  // Core effectiveness service files
  'server/services/effectiveness/',
  
  // Effectiveness routes
  'server/routes/effectivenessRoutes.ts',
  
  // Frontend effectiveness components
  'client/src/components/effectiveness-card.tsx',
  'client/src/components/effectiveness-ai-insights.tsx',
  'client/src/components/evidence-drawer.tsx',
  'client/src/components/effectiveness-prompt-template-form.tsx',
  
  // Charts related to effectiveness
  'client/src/components/charts/effectiveness-radar-chart.tsx',
  
  // Database schema for effectiveness
  'shared/schema.ts',
  
  // Migrations for effectiveness
  'migrations/add_competitor_effectiveness_support.sql',
  'migrations/add_insights_to_effectiveness_runs.sql',
  'migrations/add_progress_to_effectiveness_runs.sql',
  'migrations/add_progressive_scoring.sql',
  'migrations/add_screenshot_metadata.sql',
  'migrations/add_fullpage_screenshot_columns.sql',
  
  // Test files for effectiveness
  'server/utils/testCompleteSystem.ts',
  'server/utils/testProgressTracking.ts',
  'server/utils/testScreenshotFallbacks.ts',
  'server/utils/testBrowserManagement.ts',
  'server/utils/testIntegratedFixes.ts',
  'server/utils/verifyCompleteSystem.ts',
  'server/utils/verifyFixes.ts',
  'server/utils/testAIFallback.ts',
  'server/utils/testHtmlFallback.ts',
  'server/utils/fullSystemDiagnostic.ts',
  'server/utils/diagnoseCompletionIssues.ts',
  'server/utils/cleanupStaleRuns.ts',
  
  // Debug and test scripts
  'debug_scores.ts',
  'test_effectiveness_bugs.ts',
  'test_enhanced_scoring.ts',
  'test_final_verification.ts',
  'test_fixes_verification.ts',
  'test_full_system.ts',
  'test_fullpage_competitors.ts',
  'test_multi_competitor.ts',
  'test_progress_messages.ts',
  'test_screenshot_fix.ts',
  'test_timeout_fix.ts',
  'test_clay_fullpage.ts',
  'test_detailed_verification.ts',
  'test_direct_clay_fallback.ts',
  'test_final_fullpage_verification.ts',
  'quick_validation.ts',
  
  // Storage related to effectiveness
  'server/storage.ts',
  
  // Database utilities
  'server/utils/databaseUtils.ts',
  
  // Core server files
  'server/index.ts',
  'server/routes.ts',
  'server/config.ts',
  'server/db.ts',
  
  // Package files for dependencies
  'package.json',
  'package-lock.json',
  
  // Configuration files
  'tsconfig.json',
  'drizzle.config.ts',
  
  // Documentation
  'ENHANCED_SCORING_DEPLOYMENT.md',
  'FINAL_AUDIT_REPORT.md',
  'IDENTIFIED_BUGS.md',
];

const outputPath = 'effectiveness-audit-complete.zip';

console.log('🚀 Building effectiveness audit zip file...');

// Create a file to write archive data to
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`✅ Archive created successfully!`);
  console.log(`📦 Total bytes: ${archive.pointer()}`);
  console.log(`📄 File: ${outputPath}`);
  console.log(`\n🎯 This archive contains all effectiveness audit logic, endpoints, and code.`);
});

// Good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(`⚠️  Warning: ${err.message}`);
  } else {
    throw err;
  }
});

// Good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files and directories
let addedFiles = 0;
let skippedFiles = 0;

effectivenessFiles.forEach(filePath => {
  const fullPath = path.resolve(filePath);
  
  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Add entire directory
        archive.directory(fullPath, path.basename(filePath));
        console.log(`📁 Added directory: ${filePath}`);
        addedFiles++;
      } else if (stats.isFile()) {
        // Add individual file
        archive.file(fullPath, { name: filePath });
        console.log(`📄 Added file: ${filePath}`);
        addedFiles++;
      }
    } else {
      console.log(`⚠️  Skipped (not found): ${filePath}`);
      skippedFiles++;
    }
  } catch (error) {
    console.log(`❌ Error processing ${filePath}: ${error.message}`);
    skippedFiles++;
  }
});

// Add a README file to the archive
const readmeContent = `# Effectiveness Audit System

This archive contains all the files related to running an effectiveness audit in the Pulse Dashboard system.

## Contents:

### Core Services
- \`server/services/effectiveness/\` - Main effectiveness scoring logic
- \`server/routes/effectivenessRoutes.ts\` - API endpoints for effectiveness

### Frontend Components
- \`client/src/components/effectiveness-*.tsx\` - UI components for effectiveness display
- \`client/src/components/charts/effectiveness-radar-chart.tsx\` - Visualization components

### Database
- \`shared/schema.ts\` - Database schema definitions
- \`migrations/\` - Database migration files for effectiveness features
- \`server/storage.ts\` - Database access layer

### Testing & Debugging
- \`test_*.ts\` - Various test and debugging scripts
- \`server/utils/test*.ts\` - Server-side testing utilities

### Configuration
- \`package.json\` - Dependencies and scripts
- \`tsconfig.json\` - TypeScript configuration
- \`drizzle.config.ts\` - Database ORM configuration

## Key Endpoints:
- \`POST /api/effectiveness/run/:clientId\` - Start effectiveness audit
- \`GET /api/effectiveness/latest/:clientId\` - Get latest results
- \`POST /api/effectiveness/insights/:clientId/:runId\` - Generate AI insights

## How to Run:
1. Ensure all dependencies are installed: \`npm install\`
2. Set up database with migrations
3. Configure environment variables (OpenAI API key, etc.)
4. Start server: \`npm run dev\`

Generated on: ${new Date().toISOString()}
Total files included: ${addedFiles}
Files skipped: ${skippedFiles}
`;

archive.append(readmeContent, { name: 'README.md' });

// Finalize the archive (ie we are done appending files but streams have to finish yet)
archive.finalize();

console.log(`\n📊 Summary:`);
console.log(`   Files added: ${addedFiles}`);
console.log(`   Files skipped: ${skippedFiles}`);
console.log(`   Output: ${outputPath}`);
