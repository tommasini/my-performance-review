import { DataSourceType } from '@/app/types';
import { DataSourceAdapter, AdapterRegistry } from './types';
import { createGitHubAdapter } from './github';
import { createGitLabAdapter } from './gitlab';
import { createBitbucketAdapter } from './bitbucket';
import { createJiraAdapter } from './jira';

export * from './types';
export { GitHubAdapter, createGitHubAdapter } from './github';
export { GitLabAdapter, createGitLabAdapter } from './gitlab';
export { BitbucketAdapter, createBitbucketAdapter } from './bitbucket';
export { JiraAdapter, createJiraAdapter } from './jira';

/**
 * Registry of all available data source adapters
 */
export const adapterRegistry: AdapterRegistry = {
  github: createGitHubAdapter,
  gitlab: createGitLabAdapter,
  bitbucket: createBitbucketAdapter,
  jira: createJiraAdapter,
};

/**
 * Get an adapter instance for a specific data source type
 */
export function getAdapter(type: DataSourceType): DataSourceAdapter {
  const factory = adapterRegistry[type];
  if (!factory) {
    throw new Error(`Unknown data source type: ${type}`);
  }
  return factory();
}

/**
 * Get all available adapter types
 */
export function getAvailableAdapters(): DataSourceType[] {
  return Object.keys(adapterRegistry) as DataSourceType[];
}







