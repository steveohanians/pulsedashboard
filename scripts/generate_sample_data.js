// Comprehensive sample data generation for 15 months
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function generateSampleData() {
  console.log('🚀 Starting comprehensive sample data generation...');
  
  // Generate 15 months of periods (May 2024 - July 2025)
  const periods = [];
  const startDate = new Date('2024-05-01');
  for (let i = 0; i < 15; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  
  console.log(`📅 Generating data for periods: ${periods.join(', ')}`);
  
  // Define clients that need sample data
  const clients = ['demo-client-id', 'techcorp-id', 'retailplus-id', 'healthsys-id'];
  
  // Define metrics to generate
  const metrics = [
    { name: 'Bounce Rate', min: 35, max: 65 },
    { name: 'Session Duration', min: 120, max: 240 },
    { name: 'Pages per Session', min: 1.8, max: 3.2 },
    { name: 'Sessions per User', min: 1.0, max: 1.8 }
  ];
  
  // Define source types (excluding Client - GA4 handles that)
  const sourceTypes = ['Competitor', 'Industry_Avg', 'CD_Avg'];
  
  let totalRecords = 0;
  
  for (const clientId of clients) {
    console.log(`📊 Generating data for client: ${clientId}`);
    
    for (const period of periods) {
      // Only generate non-Client data (preserve GA4 Client data)
      for (const sourceType of sourceTypes) {
        for (const metric of metrics) {
          // Generate 2-4 records per metric/source combination for variety
          const recordCount = Math.floor(Math.random() * 3) + 2;
          
          for (let i = 0; i < recordCount; i++) {
            const value = (Math.random() * (metric.max - metric.min) + metric.min).toFixed(
              metric.name === 'Pages per Session' || metric.name === 'Sessions per User' ? 1 : 0
            );
            
            await sql`
              INSERT INTO metrics (id, client_id, metric_name, value, source_type, time_period, created_at)
              VALUES (gen_random_uuid(), ${clientId}, ${metric.name}, ${value}, ${sourceType}, ${period}, NOW())
              ON CONFLICT DO NOTHING
            `;
            totalRecords++;
          }
        }
      }
    }
  }
  
  console.log(`✅ Generated ${totalRecords} sample records across 15 months`);
  console.log('🔄 Sample data generation complete!');
}

generateSampleData().catch(console.error);