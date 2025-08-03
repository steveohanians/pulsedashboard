/**
 * GA4 Mock Service for Testing
 * Simulates GA4 API calls with realistic data for testing purposes
 */

import logger from '../utils/logger';

export interface MockGA4Data {
  sessions: number;
  bounceRate: number;
  averageSessionDuration: number;
  screenPageViewsPerSession: number;
  sessionsPerUser: number;
  channelData: Array<{
    channel: string;
    sessions: number;
  }>;
}

export class GA4MockService {
  
  /**
   * Simulate fetching GA4 data for a property
   */
  async fetchGA4Data(propertyId: string, dateRange: { startDate: string; endDate: string }): Promise<MockGA4Data> {
    logger.info(`Mock GA4: Fetching data for property ${propertyId}`, { dateRange });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate realistic mock data
    const sessions = Math.floor(Math.random() * 20000) + 10000; // 10k-30k sessions
    
    const mockData: MockGA4Data = {
      sessions,
      bounceRate: 0.35 + Math.random() * 0.3, // 35-65% bounce rate
      averageSessionDuration: 120 + Math.random() * 180, // 2-5 minutes
      screenPageViewsPerSession: 2 + Math.random() * 2, // 2-4 pages
      sessionsPerUser: 1.2 + Math.random() * 0.3, // 1.2-1.5 sessions
      channelData: [
        { channel: 'Organic Search', sessions: Math.floor(sessions * (0.45 + Math.random() * 0.1)) },
        { channel: 'Direct', sessions: Math.floor(sessions * (0.15 + Math.random() * 0.1)) },
        { channel: 'Social Media', sessions: Math.floor(sessions * (0.15 + Math.random() * 0.1)) },
        { channel: 'Paid Search', sessions: Math.floor(sessions * (0.05 + Math.random() * 0.05)) },
        { channel: 'Email', sessions: Math.floor(sessions * (0.08 + Math.random() * 0.05)) },
        { channel: 'Referral', sessions: Math.floor(sessions * (0.05 + Math.random() * 0.05)) },
      ]
    };
    
    // Ensure channel data adds up to total sessions
    const totalChannelSessions = mockData.channelData.reduce((sum, channel) => sum + channel.sessions, 0);
    const difference = sessions - totalChannelSessions;
    if (difference > 0) {
      mockData.channelData[0].sessions += difference; // Add difference to organic search
    }
    
    logger.info(`Mock GA4: Generated data for property ${propertyId}`, {
      sessions: mockData.sessions,
      bounceRate: Math.round(mockData.bounceRate * 100) + '%',
      avgSessionDuration: Math.round(mockData.averageSessionDuration) + 's'
    });
    
    return mockData;
  }
  
  /**
   * Test connection to GA4 property
   */
  async testConnection(propertyId: string): Promise<{ success: boolean; message: string }> {
    logger.info(`Mock GA4: Testing connection to property ${propertyId}`);
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock validation - simple property ID format check
    if (!propertyId || propertyId.length < 8) {
      return {
        success: false,
        message: 'Invalid GA4 Property ID format'
      };
    }
    
    return {
      success: true,
      message: 'Successfully connected to GA4 property'
    };
  }
}

export const ga4MockService = new GA4MockService();