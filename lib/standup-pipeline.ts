import { DataSourceConfig, ContributionData, ContributionStats, StandupConfig, UserProfile } from '@/app/types';
import { getAdapter, DateRange } from '@/lib/data-sources';
import type { FetchOptions } from '@/lib/data-sources/types';
import { buildStandupPrompt } from '@/lib/prompt-builder';
import { generateAIResponse } from '@/lib/ai-providers';

export interface StandupPipelineParams {
  dataSources: DataSourceConfig[];
  startDate: string;
  endDate: string;
  standupConfig: StandupConfig;
  profile: UserProfile;
  userApiKey?: string;
}

function mergeContributions(results: ContributionData[]): ContributionData {
  const merged: ContributionData = {
    pullRequests: [],
    issues: [],
    reviews: [],
    commits: [],
    tickets: [],
  };

  for (const result of results) {
    merged.pullRequests.push(...result.pullRequests);
    merged.issues.push(...result.issues);
    merged.reviews.push(...result.reviews);
    merged.commits.push(...result.commits);
    merged.tickets.push(...result.tickets);
  }

  merged.pullRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  merged.issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  merged.reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  merged.commits.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  merged.tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged;
}

function calculateStats(contributions: ContributionData): ContributionStats {
  const allRepos = new Set<string>();

  contributions.pullRequests.forEach(pr => allRepos.add(`${pr.source}:${pr.repo}`));
  contributions.issues.forEach(i => allRepos.add(`${i.source}:${i.repo}`));
  contributions.reviews.forEach(r => allRepos.add(`${r.source}:${r.repo}`));
  contributions.commits.forEach(c => allRepos.add(`${c.source}:${c.repo}`));

  return {
    totalPRs: contributions.pullRequests.length,
    mergedPRs: contributions.pullRequests.filter(pr => pr.state === 'merged' || pr.mergedAt).length,
    openPRs: contributions.pullRequests.filter(pr => pr.state === 'open').length,
    closedPRs: contributions.pullRequests.filter(pr => pr.state === 'closed' && !pr.mergedAt).length,
    totalIssues: contributions.issues.length,
    openIssues: contributions.issues.filter(i => i.state === 'open').length,
    closedIssues: contributions.issues.filter(i => i.state === 'closed').length,
    totalReviews: contributions.reviews.length,
    approvedReviews: contributions.reviews.filter(r => r.state === 'APPROVED').length,
    totalCommits: contributions.commits.length,
    totalAdditions: contributions.pullRequests.reduce((sum, pr) => sum + (pr.additions || 0), 0),
    totalDeletions: contributions.pullRequests.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
    reposContributed: allRepos.size,
    totalTickets: contributions.tickets.length,
    resolvedTickets: contributions.tickets.filter(t => t.resolvedAt).length,
  };
}

/**
 * End-to-end standup pipeline: fetch contributions → build prompt → generate AI response.
 * Reused by both the web app's /api/ai route and the Slack bot's /api/slack route.
 * Returns the ready-to-paste standup message string.
 */
export async function runStandupPipeline(params: StandupPipelineParams): Promise<string> {
  const { dataSources, startDate, endDate, standupConfig, profile, userApiKey } = params;

  const dateRange: DateRange = { start: startDate, end: endDate };
  const enabledSources = dataSources.filter(ds => ds.enabled && ds.username);

  if (enabledSources.length === 0) {
    throw new Error('No enabled data sources with a username configured.');
  }

  const fetchOpts: FetchOptions = { mode: 'activity' };

  const fetchResults = await Promise.all(
    enabledSources.map(async (source) => {
      const adapter = getAdapter(source.type);
      try {
        console.log(`[standup-pipeline] Fetching activity from ${source.type}...`);
        const contributions = await adapter.fetchContributions(source, dateRange, undefined, fetchOpts);
        console.log(`[standup-pipeline] Got ${contributions.pullRequests.length} PRs, ${contributions.reviews.length} reviews from ${source.type}`);
        return contributions;
      } catch (error) {
        console.error(`[standup-pipeline] Error fetching from ${source.type}:`, error);
        return { pullRequests: [], issues: [], reviews: [], commits: [], tickets: [] } as ContributionData;
      }
    })
  );

  const contributions = mergeContributions(fetchResults);
  const stats = calculateStats(contributions);

  const prompt = buildStandupPrompt(standupConfig, contributions, stats, profile);
  const result = await generateAIResponse(prompt, userApiKey);

  return result.answer;
}
