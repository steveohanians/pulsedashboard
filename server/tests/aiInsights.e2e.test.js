/**
 * End-to-end tests for AI Insights surgical fixes validation
 * Tests server-computed hasContext, DELETE response format, and period handling
 */

const request = require('supertest');
const { expect } = require('@jest/globals');

describe('AI Insights Surgical Fixes', () => {
  const app = require('../index.js'); // Adjust path as needed
  const testClientId = 'test-client-surgical';
  const canonicalPeriod = '2025-07';

  beforeEach(async () => {
    // Clean up test data
    await request(app)
      .delete(`/api/debug/clear-insights/${testClientId}`)
      .expect(200);
  });

  test('Badge Truth: GET returns server-computed hasContext', async () => {
    // Create insight with context in aiInsights.contextText
    await request(app)
      .post('/api/debug/create-test-insights')
      .send({
        clientId: testClientId,
        period: canonicalPeriod,
        insights: [{
          metricName: 'Test Metric',
          contextText: 'User provided context',
          insightText: 'Test insight',
          recommendationText: 'Test recommendation'
        }]
      })
      .expect(200);

    // GET should return hasContext: true
    const response = await request(app)
      .get(`/api/ai-insights/${testClientId}?period=${canonicalPeriod}`)
      .expect(200);

    expect(response.body.insights).toHaveLength(1);
    expect(response.body.insights[0].hasContext).toBe(true);
    expect(response.body.insights[0].metricName).toBe('Test Metric');
  });

  test('DELETE returns exact response format with counts', async () => {
    // Create test insight
    await request(app)
      .post('/api/debug/create-test-insights')
      .send({
        clientId: testClientId,
        period: canonicalPeriod,
        insights: [{ metricName: 'Delete Test', insightText: 'To be deleted' }]
      })
      .expect(200);

    // DELETE specific metric
    const deleteResponse = await request(app)
      .delete(`/api/ai-insights/${testClientId}/Delete%20Test?period=${canonicalPeriod}`)
      .expect(200);

    // Verify exact response format
    expect(deleteResponse.body).toEqual({
      ok: true,
      deleted: {
        insights: expect.any(Number),
        contexts: expect.any(Number)
      }
    });

    // Verify insight is gone
    const getResponse = await request(app)
      .get(`/api/ai-insights/${testClientId}?period=${canonicalPeriod}`)
      .expect(200);

    const deletedInsight = getResponse.body.insights.find(i => i.metricName === 'Delete Test');
    expect(deletedInsight).toBeUndefined();
  });

  test('Canonical period handling works consistently', async () => {
    // Test both canonical and legacy period formats
    const legacyResponse = await request(app)
      .get(`/api/ai-insights/${testClientId}?period=Last%20Month`)
      .expect(200);

    const canonicalResponse = await request(app)
      .get(`/api/ai-insights/${testClientId}?period=${canonicalPeriod}`)
      .expect(200);

    // Both should work and return consistent structure
    expect(legacyResponse.body).toHaveProperty('status');
    expect(canonicalResponse.body).toHaveProperty('status');
  });

  afterAll(() => {
    // Clean up
    request(app).delete(`/api/debug/clear-insights/${testClientId}`);
  });
});