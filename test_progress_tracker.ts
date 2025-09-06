import { createProgressTracker } from './server/services/effectiveness/progressTracker';

console.log('🧪 Testing progressTracker integration...\n');

const tracker = createProgressTracker();

console.log('1. Initial state:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);
console.log('   Phase:', tracker.getState().currentPhase);

tracker.startClient('Test Client');
console.log('\n2. After startClient:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);
console.log('   Phase:', tracker.getState().currentPhase);

// Simulate completing 8 criteria (should trigger client completion)
for (let i = 0; i < 8; i++) {
  tracker.completeCriterion(`criterion_${i+1}`, true);
  if (i === 3 || i === 7) {
    console.log(`\n3.${i === 3 ? 'a' : 'b'} After ${i+1} criteria:`);
    console.log('   Message:', tracker.getProgressString());
    console.log('   Percentage:', tracker.getState().overallPercent);
    console.log('   Client Complete:', tracker.getState().clientComplete);
  }
}

tracker.setCompetitorCount(2);
tracker.startCompetitor('Competitor 1', 0);
console.log('\n4. Competitor 1 started:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);
console.log('   Phase:', tracker.getState().currentPhase);

tracker.completeCompetitor();
tracker.startCompetitor('Competitor 2', 1);
console.log('\n5. Competitor 2 started:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);

tracker.completeCompetitor();
tracker.startInsights();
console.log('\n6. Insights started:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);
console.log('   Phase:', tracker.getState().currentPhase);

tracker.complete();
console.log('\n7. Complete:');
console.log('   Message:', tracker.getProgressString());
console.log('   Percentage:', tracker.getState().overallPercent);