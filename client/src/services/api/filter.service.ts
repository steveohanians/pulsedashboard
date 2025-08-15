import { BaseService } from './base.service';

/**
 * Filter service
 * Handles filter options management operations
 */
export class FilterService extends BaseService {
  constructor() {
    super('/api/admin/filter-options');
  }

  /**
   * Create a new filter option
   */
  async create(data: {
    type: 'business_size' | 'industry_vertical';
    value: string;
    sortOrder?: number;
  }): Promise<any> {
    return super.create(data);
  }

  /**
   * Update filter option
   */
  async update(id: string, data: {
    value?: string;
    sortOrder?: number;
  }): Promise<any> {
    return super.update(id, data);
  }
}