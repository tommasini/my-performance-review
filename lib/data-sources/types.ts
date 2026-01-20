import { DataSourceType, DataSourceConfig, ContributionData } from '@/app/types';

export interface DateRange {
  start: string;
  end: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FetchProgress {
  stage: 'pullRequests' | 'issues' | 'reviews' | 'commits' | 'tickets';
  current: number;
  total?: number;
}

export type ProgressCallback = (progress: FetchProgress) => void;

/**
 * Base interface for all data source adapters.
 * Each adapter (GitHub, GitLab, Bitbucket, Jira) implements this interface.
 */
export interface DataSourceAdapter {
  /**
   * The type of data source this adapter handles
   */
  readonly name: DataSourceType;

  /**
   * Fetch contributions from the data source
   * @param config - Configuration including username, organization, token, etc.
   * @param dateRange - Start and end dates for the query
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to contribution data
   */
  fetchContributions(
    config: DataSourceConfig,
    dateRange: DateRange,
    onProgress?: ProgressCallback
  ): Promise<ContributionData>;

  /**
   * Validate the configuration before fetching
   * @param config - Configuration to validate
   * @returns Validation result with error message if invalid
   */
  validateConfig(config: DataSourceConfig): ValidationResult;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = () => DataSourceAdapter;

/**
 * Registry of all available adapters
 */
export type AdapterRegistry = Record<DataSourceType, AdapterFactory>;







