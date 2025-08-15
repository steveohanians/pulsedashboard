import { BaseService } from './base.service';

/**
 * Competitor service
 * Handles competitor management operations
 */
export class CompetitorService extends BaseService {
  constructor() {
    super('/api/competitors');
  }

  /**
   * Create a new competitor
   */
  async create(data: {
    domain: string;
    label?: string;
    clientId: string;
  }): Promise<any> {
    return super.create(data);
  }

  /**
   * Update competitor
   */
  async update(id: string, data: {
    domain?: string;
    label?: string;
    status?: string;
  }): Promise<any> {
    return super.update(id, data);
  }
}