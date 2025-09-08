/**
 * Direct Effectiveness Run Trigger
 * 
 * Triggers and monitors a real effectiveness analysis using the actual system
 */

import { effectivenessService } from './server/services/EffectivenessService.js';
import { storage } from './server/storage.js';
import logger from './server/utils/logging/logger.js';

interface ProgressUpdate {
  runId: string;
  status: string;
  progress: number;
  progressDetail: string;
  timestamp: string;
}

class EffectivenessRunTrigger {
  private progressUpdates: ProgressUpdate[] = [];

  async triggerAndMonitorRun(clientId: string): Promise<void> {
    console.log(`🚀 EFFECTIVENESS RUN - LIVE SYSTEM TEST`);
    console.log(`========================================`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log();

    try {
      // Step 1: Verify client exists
      console.log(`📋 STEP 1: CLIENT VERIFICATION`);
      console.log(`──────────────────────────────`);
      
      const client = await storage.getClient(clientId);
      if (!client) {
        console.log(`❌ Client not found: ${clientId}`);
        return;
      }
      
      console.log(`✅ Client found: ${client.companyName}`);
      console.log(`   Website: ${client.websiteUrl}`);
      console.log();

      // Step 2: Start analysis
      console.log(`🚀 STEP 2: START ANALYSIS`);
      console.log(`─────────────────────────`);
      
      const startTime = Date.now();
      const { runId } = await effectivenessService.startAnalysis(clientId, true);
      const startDuration = Date.now() - startTime;
      
      console.log(`✅ Analysis started successfully (${startDuration}ms)`);
      console.log(`   Run ID: ${runId}`);
      console.log();

      // Step 3: Monitor progress
      console.log(`📊 STEP 3: REAL-TIME MONITORING`);
      console.log(`──────────────────────────────`);
      
      await this.monitorProgress(runId);

      // Step 4: Final results
      console.log();
      console.log(`📈 STEP 4: FINAL RESULTS`);
      console.log(`────────────────────────`);
      
      const finalResults = await effectivenessService.getLatestResults(clientId);
      this.displayFinalResults(finalResults);

    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Effectiveness run trigger failed', { error });
    }
  }

  private async monitorProgress(runId: string): Promise<void> {
    const maxDuration = 5 * 60 * 1000; // 5 minutes max
    const startTime = Date.now();
    let lastStatus = '';
    let lastProgress = -1;

    while (Date.now() - startTime < maxDuration) {
      const progress = await effectivenessService.getProgress(runId);
      
      if (!progress) {
        console.log(`⚠️  No progress data for run ${runId}`);
        break;
      }

      // Only log when status or progress changes significantly
      if (progress.status !== lastStatus || Math.abs(progress.progress - lastProgress) >= 5) {
        const timestamp = new Date().toLocaleTimeString();
        const statusEmoji = this.getStatusEmoji(progress.status);
        
        console.log(`${statusEmoji} ${timestamp} | ${progress.status.toUpperCase()} | ${progress.progress}% | ${progress.progressDetail}`);
        
        this.progressUpdates.push({
          runId,
          status: progress.status,
          progress: progress.progress,
          progressDetail: progress.progressDetail,
          timestamp: new Date().toISOString()
        });

        lastStatus = progress.status;
        lastProgress = progress.progress;
      }

      // Check if completed or failed
      if (['completed', 'failed'].includes(progress.status)) {
        break;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'pending': '⏳',
      'initializing': '🔄',
      'scraping': '📸',
      'analyzing': '🔍',
      'tier1_analyzing': '📝',
      'tier1_complete': '✅',
      'tier2_analyzing': '🤖',
      'tier2_complete': '✅',
      'tier3_analyzing': '🌐',
      'completed': '🎉',
      'failed': '❌'
    };
    return emojiMap[status] || '📊';
  }

  private displayFinalResults(results: any): void {
    if (!results || !results.run) {
      console.log(`❌ No results available`);
      return;
    }

    const { run } = results;
    console.log(`✅ Analysis Status: ${run.status?.toUpperCase() || 'UNKNOWN'}`);
    console.log(`📊 Overall Score: ${run.overallScore || 'N/A'}`);
    
    if (results.run.criterionScores && results.run.criterionScores.length > 0) {
      console.log(`📋 Criteria Results (${results.run.criterionScores.length} total):`);
      
      // Group by tier
      const tiers: Record<number, any[]> = {};
      results.run.criterionScores.forEach((score: any) => {
        const tier = score.tier || 1;
        if (!tiers[tier]) tiers[tier] = [];
        tiers[tier].push(score);
      });

      Object.entries(tiers).forEach(([tierNum, scores]) => {
        console.log(`   🔸 Tier ${tierNum}:`);
        scores.forEach(score => {
          const passStatus = score.passes ? '✅' : '❌';
          console.log(`     ${passStatus} ${score.criterion}: ${score.score}/10`);
        });
      });
    } else {
      console.log(`⚠️  No criterion scores available`);
    }

    if (results.client) {
      console.log(`🏢 Client: ${results.client.companyName}`);
      console.log(`🌐 Website: ${results.client.websiteUrl}`);
    }

    // Progress summary
    console.log();
    console.log(`📊 PROGRESS SUMMARY`);
    console.log(`──────────────────`);
    console.log(`Total Progress Updates: ${this.progressUpdates.length}`);
    
    if (this.progressUpdates.length > 0) {
      const firstUpdate = this.progressUpdates[0];
      const lastUpdate = this.progressUpdates[this.progressUpdates.length - 1];
      const duration = new Date(lastUpdate.timestamp).getTime() - new Date(firstUpdate.timestamp).getTime();
      
      console.log(`Duration: ${Math.round(duration / 1000)}s`);
      console.log(`Status Flow: ${firstUpdate.status} → ${lastUpdate.status}`);
      console.log(`Progress: ${firstUpdate.progress}% → ${lastUpdate.progress}%`);
    }
  }
}

// Main execution
async function main() {
  const clientId = process.argv[2] || 'demo-client-id';
  const trigger = new EffectivenessRunTrigger();
  await trigger.triggerAndMonitorRun(clientId);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EffectivenessRunTrigger };