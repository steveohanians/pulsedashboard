// Check recent logs for what prompt was used
import { promises as fs } from 'fs';

async function checkLogs() {
  try {
    // Try to find log files
    const files = await fs.readdir('/home/runner/workspace');
    const logFiles = files.filter(f => f.includes('.log'));
    console.log('Log files found:', logFiles);
  } catch (e) {
    console.log('No log files in workspace');
  }
  
  // The logs would be in memory/console, not files
  console.log('\nThe actual prompt being used is likely hardcoded.');
  console.log('Since getEffectivenessPrompt returns null for CTAs,');
  console.log('and the database has no prompts table,');
  console.log('the system must be using a fallback or inline prompt.');
}

checkLogs();
