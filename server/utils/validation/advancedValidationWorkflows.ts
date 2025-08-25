import { IStorage } from "../../storage";
import logger from "../logging/logger";
import { CompanyType, ISemrushValidator } from "../company/validation";
import { ValidationResult, GlobalValidationOrchestrator } from "./globalValidationOrchestrator";



export interface ValidationWorkflowResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  workflowMetadata?: {
    workflowName: string;
    executionTime: number;
    stepsExecuted: string[];
    skipReasons?: string[];
  };
}

export class AdvancedValidationWorkflows {
  private orchestrator: GlobalValidationOrchestrator;

  constructor(private storage: IStorage, private semrushValidator: ISemrushValidator) {
    this.orchestrator = new GlobalValidationOrchestrator(storage, semrushValidator);
  }


  async validateCompetitorPortfolioConflicts(
    competitorDomain: string,
    clientId: string,
    excludeCompetitorId?: string
  ): Promise<ValidationWorkflowResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = [];

    try {
      stepsExecuted.push('fetch_portfolio_companies');
      const portfolioCompanies = await this.storage.getCdPortfolioCompanies();
      
      stepsExecuted.push('check_domain_conflicts');
      const normalizedCompetitorDomain = this.normalizeDomain(competitorDomain);
      
      const conflictingPortfolioCompany = portfolioCompanies.find(pc => {
        const portfolioDomain = this.normalizeDomain(pc.websiteUrl || '');
        return portfolioDomain === normalizedCompetitorDomain;
      });

      if (conflictingPortfolioCompany) {
        return {
          isValid: false,
          error: `Domain ${competitorDomain} is already used by portfolio company "${conflictingPortfolioCompany.name}". Competitors cannot use the same domain as portfolio companies.`,
          workflowMetadata: {
            workflowName: 'competitor_portfolio_conflict_check',
            executionTime: Date.now() - startTime,
            stepsExecuted
          }
        };
      }

      stepsExecuted.push('check_competitor_conflicts');
      const clientCompetitors = await this.storage.getCompetitorsByClient(clientId);
      
      const conflictingCompetitor = clientCompetitors.find(comp => {
        if (excludeCompetitorId && comp.id === excludeCompetitorId) {
          return false;
        }
        const existingDomain = this.normalizeDomain(comp.domain || '');
        return existingDomain === normalizedCompetitorDomain;
      });

      if (conflictingCompetitor) {
        return {
          isValid: false,
          error: `Domain ${competitorDomain} is already used by competitor "${conflictingCompetitor.label}". Each competitor must have a unique domain.`,
          workflowMetadata: {
            workflowName: 'competitor_portfolio_conflict_check',
            executionTime: Date.now() - startTime,
            stepsExecuted
          }
        };
      }

      logger.info('Competitor-portfolio conflict validation passed', {
        competitorDomain,
        clientId,
        portfolioCompaniesChecked: portfolioCompanies.length,
        competitorsChecked: clientCompetitors.length
      });

      return {
        isValid: true,
        warnings: ['Domain conflict validation passed'],
        workflowMetadata: {
          workflowName: 'competitor_portfolio_conflict_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };

    } catch (error) {
      logger.error('Competitor-portfolio conflict validation failed', {
        competitorDomain,
        clientId,
        error: (error as Error).message
      });

      return {
        isValid: false,
        error: `Conflict validation failed: ${(error as Error).message}`,
        workflowMetadata: {
          workflowName: 'competitor_portfolio_conflict_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };
    }
  }


  async validateBenchmarkDiversity(
    newBusinessSize: string,
    newIndustryVertical: string,
    excludeCompanyId?: string
  ): Promise<ValidationWorkflowResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = [];

    try {
      stepsExecuted.push('fetch_benchmark_companies');
      const benchmarkCompanies = await this.storage.getBenchmarkCompanies();
      
      const otherBenchmarkCompanies = excludeCompanyId 
        ? benchmarkCompanies.filter(bc => bc.id !== excludeCompanyId)
        : benchmarkCompanies;

      stepsExecuted.push('analyze_diversity');
      const businessSizeCounts = new Map<string, number>();
      const industryVerticalCounts = new Map<string, number>();

      otherBenchmarkCompanies.forEach(company => {
        if (company.businessSize) {
          businessSizeCounts.set(
            company.businessSize, 
            (businessSizeCounts.get(company.businessSize) || 0) + 1
          );
        }
        if (company.industryVertical) {
          industryVerticalCounts.set(
            company.industryVertical,
            (industryVerticalCounts.get(company.industryVertical) || 0) + 1
          );
        }
      });

      stepsExecuted.push('check_diversity_thresholds');
      const warnings: string[] = [];

      const currentBusinessSizeCount = businessSizeCounts.get(newBusinessSize) || 0;
      const totalCompanies = otherBenchmarkCompanies.length + 1;
      
      if (currentBusinessSizeCount >= Math.ceil(totalCompanies * 0.6)) {
        warnings.push(`Business size "${newBusinessSize}" will represent over 60% of benchmark companies. Consider adding more diversity.`);
      }

      const currentIndustryCount = industryVerticalCounts.get(newIndustryVertical) || 0;
      
      if (currentIndustryCount >= Math.ceil(totalCompanies * 0.5)) {
        warnings.push(`Industry vertical "${newIndustryVertical}" will represent over 50% of benchmark companies. Consider adding more diversity.`);
      }

      logger.info('Benchmark diversity validation completed', {
        newBusinessSize,
        newIndustryVertical,
        totalBenchmarkCompanies: totalCompanies,
        businessSizeDistribution: Object.fromEntries(businessSizeCounts),
        industryVerticalDistribution: Object.fromEntries(industryVerticalCounts),
        warningsCount: warnings.length
      });

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        workflowMetadata: {
          workflowName: 'benchmark_diversity_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };

    } catch (error) {
      logger.error('Benchmark diversity validation failed', {
        newBusinessSize,
        newIndustryVertical,
        error: (error as Error).message
      });

      return {
        isValid: false,
        error: `Diversity validation failed: ${(error as Error).message}`,
        workflowMetadata: {
          workflowName: 'benchmark_diversity_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };
    }
  }


  async validateClientUniqueness(
    clientData: {
      name?: string;
      domain?: string;
      ga4PropertyId?: string;
    },
    excludeClientId?: string
  ): Promise<ValidationWorkflowResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = [];

    try {
      stepsExecuted.push('fetch_all_clients');
      const allClients = await this.storage.getClients();
      
      const otherClients = excludeClientId 
        ? allClients.filter(c => c.id !== excludeClientId)
        : allClients;

      if (clientData.name) {
        stepsExecuted.push('check_name_uniqueness');
        const conflictingClient = otherClients.find(c => 
          c.name.toLowerCase() === clientData.name!.toLowerCase()
        );
        
        if (conflictingClient) {
          return {
            isValid: false,
            error: `Client name "${clientData.name}" is already in use. Please choose a different name.`,
            workflowMetadata: {
              workflowName: 'client_uniqueness_check',
              executionTime: Date.now() - startTime,
              stepsExecuted
            }
          };
        }
      }

      if (clientData.domain) {
        stepsExecuted.push('check_domain_uniqueness');
        const normalizedDomain = this.normalizeDomain(clientData.domain);
        
        const conflictingClient = otherClients.find(c => 
          this.normalizeDomain(c.websiteUrl || '') === normalizedDomain
        );
        
        if (conflictingClient) {
          return {
            isValid: false,
            error: `Domain "${clientData.domain}" is already used by client "${conflictingClient.name}". Each client must have a unique domain.`,
            workflowMetadata: {
              workflowName: 'client_uniqueness_check',
              executionTime: Date.now() - startTime,
              stepsExecuted
            }
          };
        }
      }

      if (clientData.ga4PropertyId) {
        stepsExecuted.push('check_ga4_property_uniqueness');
        const conflictingClient = otherClients.find(c => 
          c.ga4PropertyId === clientData.ga4PropertyId
        );
        
        if (conflictingClient) {
          return {
            isValid: false,
            error: `GA4 Property ID "${clientData.ga4PropertyId}" is already used by client "${conflictingClient.name}". Each client must have a unique GA4 Property ID.`,
            workflowMetadata: {
              workflowName: 'client_uniqueness_check',
              executionTime: Date.now() - startTime,
              stepsExecuted
            }
          };
        }
      }

      logger.info('Client uniqueness validation passed', {
        clientName: clientData.name,
        clientDomain: clientData.domain,
        ga4PropertyId: clientData.ga4PropertyId,
        clientsChecked: otherClients.length
      });

      return {
        isValid: true,
        warnings: ['Client uniqueness validation passed'],
        workflowMetadata: {
          workflowName: 'client_uniqueness_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };

    } catch (error) {
      logger.error('Client uniqueness validation failed', {
        clientData,
        error: (error as Error).message
      });

      return {
        isValid: false,
        error: `Client uniqueness validation failed: ${(error as Error).message}`,
        workflowMetadata: {
          workflowName: 'client_uniqueness_check',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };
    }
  }


  async validatePortfolioCompanyWorkflow(
    portfolioData: {
      name?: string;
      websiteUrl?: string;
      businessSize?: string;
      industryVertical?: string;
    },
    excludeCompanyId?: string
  ): Promise<ValidationWorkflowResult> {
    const startTime = Date.now();
    const stepsExecuted: string[] = [];
    const warnings: string[] = [];

    try {
      if (portfolioData.businessSize && portfolioData.industryVertical) {
        stepsExecuted.push('validate_filter_combination');
        const { FilterValidator } = await import("./filterValidation");
        const filterValidator = new FilterValidator(this.storage);
        
        const filterValidation = await filterValidator.validateEntity({
          businessSize: portfolioData.businessSize,
          industryVertical: portfolioData.industryVertical
        });

        if (!filterValidation.isValid) {
          return {
            isValid: false,
            error: filterValidation.error,
            workflowMetadata: {
              workflowName: 'portfolio_company_comprehensive_validation',
              executionTime: Date.now() - startTime,
              stepsExecuted
            }
          };
        }
      }

      if (portfolioData.websiteUrl) {
        stepsExecuted.push('check_competitor_conflicts');
        const allClients = await this.storage.getClients();
        const normalizedDomain = this.normalizeDomain(portfolioData.websiteUrl);
        
        for (const client of allClients) {
          const competitors = await this.storage.getCompetitorsByClient(client.id);
          const conflictingCompetitor = competitors.find(comp =>
            this.normalizeDomain(comp.domain || '') === normalizedDomain
          );
          
          if (conflictingCompetitor) {
            return {
              isValid: false,
              error: `Domain ${portfolioData.websiteUrl} is already used as a competitor "${conflictingCompetitor.label}" for client "${client.name}". Portfolio companies cannot use competitor domains.`,
              workflowMetadata: {
                workflowName: 'portfolio_company_comprehensive_validation',
                executionTime: Date.now() - startTime,
                stepsExecuted
              }
            };
          }
        }
      }

      if (portfolioData.name || portfolioData.websiteUrl) {
        stepsExecuted.push('check_portfolio_duplicates');
        const allPortfolioCompanies = await this.storage.getCdPortfolioCompanies();
        const otherCompanies = excludeCompanyId 
          ? allPortfolioCompanies.filter(pc => pc.id !== excludeCompanyId)
          : allPortfolioCompanies;

        if (portfolioData.name) {
          const conflictingCompany = otherCompanies.find(pc =>
            pc.name.toLowerCase() === portfolioData.name!.toLowerCase()
          );
          
          if (conflictingCompany) {
            return {
              isValid: false,
              error: `Portfolio company name "${portfolioData.name}" is already in use. Please choose a different name.`,
              workflowMetadata: {
                workflowName: 'portfolio_company_comprehensive_validation',
                executionTime: Date.now() - startTime,
                stepsExecuted
              }
            };
          }
        }

        if (portfolioData.websiteUrl) {
          const normalizedDomain = this.normalizeDomain(portfolioData.websiteUrl);
          const conflictingCompany = otherCompanies.find(pc =>
            this.normalizeDomain(pc.websiteUrl || '') === normalizedDomain
          );
          
          if (conflictingCompany) {
            return {
              isValid: false,
              error: `Portfolio company domain "${portfolioData.websiteUrl}" is already in use by "${conflictingCompany.name}".`,
              workflowMetadata: {
                workflowName: 'portfolio_company_comprehensive_validation',
                executionTime: Date.now() - startTime,
                stepsExecuted
              }
            };
          }
        }
      }

      logger.info('Portfolio company comprehensive validation passed', {
        portfolioData,
        stepsExecuted,
        warningsCount: warnings.length
      });

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : ['Comprehensive validation passed'],
        workflowMetadata: {
          workflowName: 'portfolio_company_comprehensive_validation',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };

    } catch (error) {
      logger.error('Portfolio company comprehensive validation failed', {
        portfolioData,
        error: (error as Error).message
      });

      return {
        isValid: false,
        error: `Comprehensive validation failed: ${(error as Error).message}`,
        workflowMetadata: {
          workflowName: 'portfolio_company_comprehensive_validation',
          executionTime: Date.now() - startTime,
          stepsExecuted
        }
      };
    }
  }

  private normalizeDomain(domain: string): string {
    if (!domain) return '';
    
    let normalized = domain.toLowerCase().trim();
    
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    normalized = normalized.replace(/\/$/, '');
    normalized = normalized.split('/')[0];
    
    return normalized;
  }
}



export async function validateCompetitorPortfolioConflicts(
  storage: IStorage,
  competitorDomain: string,
  clientId: string,
  excludeCompetitorId?: string
): Promise<ValidationWorkflowResult> {
  const workflows = new AdvancedValidationWorkflows(storage, null as any); // TODO: Pass proper semrushValidator
  return await workflows.validateCompetitorPortfolioConflicts(competitorDomain, clientId, excludeCompetitorId);
}

export async function validateBenchmarkDiversity(
  storage: IStorage,
  businessSize: string,
  industryVertical: string,
  excludeCompanyId?: string
): Promise<ValidationWorkflowResult> {
  const workflows = new AdvancedValidationWorkflows(storage, null as any); // TODO: Pass proper semrushValidator
  return await workflows.validateBenchmarkDiversity(businessSize, industryVertical, excludeCompanyId);
}

export async function validateClientUniqueness(
  storage: IStorage,
  clientData: { name?: string; domain?: string; ga4PropertyId?: string },
  excludeClientId?: string
): Promise<ValidationWorkflowResult> {
  const workflows = new AdvancedValidationWorkflows(storage, null as any); // TODO: Pass proper semrushValidator
  return await workflows.validateClientUniqueness(clientData, excludeClientId);
}