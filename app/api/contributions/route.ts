import { NextRequest, NextResponse } from 'next/server';
import { DataSourceConfig, ContributionData, ContributionStats, FetchedData, DataSourceType } from '@/app/types';
import { getAdapter, DateRange } from '@/lib/data-sources';

export const maxDuration = 300; // 5 minutes max

interface ContributionsRequestBody {
  dataSources: DataSourceConfig[];
  startDate: string;
  endDate: string;
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

  // Sort all arrays by date (newest first)
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

export async function POST(request: NextRequest) {
  try {
    const body: ContributionsRequestBody = await request.json();
    const { dataSources, startDate, endDate } = body;

    // Validate request
    if (!dataSources || !Array.isArray(dataSources) || dataSources.length === 0) {
      return NextResponse.json(
        { error: 'At least one data source is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const dateRange: DateRange = { start: startDate, end: endDate };
    const enabledSources = dataSources.filter(ds => ds.enabled);

    if (enabledSources.length === 0) {
      return NextResponse.json(
        { error: 'At least one enabled data source is required' },
        { status: 400 }
      );
    }

    // Validate all configs first
    const validationErrors: string[] = [];
    for (const source of enabledSources) {
      const adapter = getAdapter(source.type);
      const validation = adapter.validateConfig(source);
      if (!validation.valid) {
        validationErrors.push(`${source.type}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation errors', details: validationErrors },
        { status: 400 }
      );
    }

    // Fetch from all sources in parallel
    const fetchPromises = enabledSources.map(async (source) => {
      const adapter = getAdapter(source.type);
      try {
        console.log(`Fetching contributions from ${source.type}...`);
        const contributions = await adapter.fetchContributions(source, dateRange);
        console.log(`Fetched ${contributions.pullRequests.length} PRs, ${contributions.issues.length} issues, ${contributions.reviews.length} reviews, ${contributions.commits.length} commits, ${contributions.tickets.length} tickets from ${source.type}`);
        return { type: source.type, contributions, error: null };
      } catch (error) {
        console.error(`Error fetching from ${source.type}:`, error);
        return { 
          type: source.type, 
          contributions: { pullRequests: [], issues: [], reviews: [], commits: [], tickets: [] } as ContributionData,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const results = await Promise.all(fetchPromises);

    // Collect any errors
    const errors = results
      .filter(r => r.error)
      .map(r => ({ source: r.type, error: r.error }));

    // Merge all contributions
    const allContributions = results.map(r => r.contributions);
    const mergedContributions = mergeContributions(allContributions);

    // Calculate stats
    const stats = calculateStats(mergedContributions);

    // Build response
    const response: FetchedData & { errors?: Array<{ source: DataSourceType; error: string | null }> } = {
      contributions: mergedContributions,
      stats,
      dateRange: { start: startDate, end: endDate },
      sources: enabledSources.map(s => s.type),
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in contributions API:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch contributions',
        details: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// Health check / supported sources endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    supportedSources: ['github', 'gitlab', 'bitbucket', 'jira'],
    version: '2.0',
  });
}







