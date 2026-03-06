import { DataSourceConfig, ContributionData, PullRequest, Issue, Review, Commit } from '@/app/types';
import { DataSourceAdapter, DateRange, ValidationResult, ProgressCallback } from './types';

interface BitbucketPR {
  id: number;
  title: string;
  state: string;
  links: { html: { href: string } };
  created_on: string;
  updated_on: string;
  merge_commit?: { hash: string };
  source: { repository: { full_name: string } };
  destination: { repository: { full_name: string } };
}

interface BitbucketIssue {
  id: number;
  title: string;
  state: string;
  links: { html: { href: string } };
  created_on: string;
  content: { raw: string };
}

interface BitbucketComment {
  id: number;
  content: { raw: string };
  created_on: string;
  user: { account_id: string; display_name: string; nickname: string };
  links: { html: { href: string } };
}

interface BitbucketCommit {
  hash: string;
  message: string;
  date: string;
  links: { html: { href: string } };
  author: { user?: { account_id: string; nickname: string } };
}

interface BitbucketRepo {
  slug: string;
  full_name: string;
  links: { html: { href: string } };
}

interface BitbucketPaginatedResponse<T> {
  values: T[];
  next?: string;
  size: number;
}

export class BitbucketAdapter implements DataSourceAdapter {
  readonly name = 'bitbucket' as const;

  validateConfig(config: DataSourceConfig): ValidationResult {
    if (!config.username) {
      return { valid: false, error: 'Bitbucket username is required' };
    }
    if (!config.organization) {
      return { valid: false, error: 'Bitbucket workspace is required' };
    }
    if (!config.token) {
      return { valid: false, error: 'Bitbucket App Password is required' };
    }
    return { valid: true };
  }

  private getAuthHeader(config: DataSourceConfig): string {
    // Bitbucket uses Basic Auth with username:app_password
    const credentials = Buffer.from(`${config.username}:${config.token}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchApi<T>(
    config: DataSourceConfig,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`https://api.bitbucket.org/2.0${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': this.getAuthHeader(config),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bitbucket API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async fetchAllPages<T>(
    config: DataSourceConfig,
    endpoint: string,
    params: Record<string, string> = {},
    maxPages = 10
  ): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = null;
    let page = 0;

    const url = new URL(`https://api.bitbucket.org/2.0${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    url.searchParams.append('pagelen', '50');

    while (page < maxPages) {
      const fetchUrl = nextUrl || url.toString();
      
      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': this.getAuthHeader(config),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) break;

      const data: BitbucketPaginatedResponse<T> = await response.json();
      results.push(...data.values);

      if (!data.next) break;
      nextUrl = data.next;
      page++;
    }

    return results;
  }

  async fetchContributions(
    config: DataSourceConfig,
    dateRange: DateRange,
    onProgress?: ProgressCallback,
    _options?: import('./types').FetchOptions
  ): Promise<ContributionData> {
    const contributions: ContributionData = {
      pullRequests: [],
      issues: [],
      reviews: [],
      commits: [],
      tickets: [],
    };

    const { username, organization } = config;
    const workspace = organization!;

    // Get repositories in workspace
    let repositories: BitbucketRepo[] = [];
    try {
      repositories = await this.fetchAllPages<BitbucketRepo>(
        config,
        `/repositories/${workspace}`,
        {},
        5
      );
    } catch (error) {
      console.error('Error fetching Bitbucket repositories:', error);
      return contributions;
    }

    // Fetch Pull Requests
    onProgress?.({ stage: 'pullRequests', current: 0 });
    for (const repo of repositories) {
      try {
        // Get PRs authored by user
        const prs = await this.fetchAllPages<BitbucketPR>(
          config,
          `/repositories/${repo.full_name}/pullrequests`,
          {
            state: 'MERGED,OPEN,DECLINED',
            q: `author.nickname="${username}" AND created_on>=${dateRange.start} AND created_on<=${dateRange.end}`,
          },
          3
        );

        for (const pr of prs) {
          const pullRequest: PullRequest = {
            title: pr.title,
            number: pr.id,
            state: pr.state.toLowerCase() === 'merged' ? 'merged' : pr.state.toLowerCase(),
            url: pr.links.html.href,
            createdAt: pr.created_on,
            mergedAt: pr.merge_commit ? pr.updated_on : null,
            repo: repo.full_name,
            source: 'bitbucket',
          };
          contributions.pullRequests.push(pullRequest);
          onProgress?.({ stage: 'pullRequests', current: contributions.pullRequests.length });
        }
      } catch (error) {
        console.error(`Error fetching PRs for ${repo.full_name}:`, error);
      }
    }

    // Fetch Issues (if issue tracker is enabled)
    onProgress?.({ stage: 'issues', current: 0 });
    for (const repo of repositories.slice(0, 10)) {
      try {
        const issues = await this.fetchAllPages<BitbucketIssue>(
          config,
          `/repositories/${repo.full_name}/issues`,
          {
            q: `reporter.nickname="${username}" AND created_on>=${dateRange.start} AND created_on<=${dateRange.end}`,
          },
          2
        );

        for (const issue of issues) {
          const issueData: Issue = {
            title: issue.title,
            number: issue.id,
            state: issue.state.toLowerCase() === 'closed' ? 'closed' : 'open',
            url: issue.links.html.href,
            createdAt: issue.created_on,
            repo: repo.full_name,
            comments: 0, // Would need additional API call to get comment count
            source: 'bitbucket',
          };
          contributions.issues.push(issueData);
          onProgress?.({ stage: 'issues', current: contributions.issues.length });
        }
      } catch {
        // Issue tracker might not be enabled for this repo, skip
      }
    }

    // Fetch Reviews (PR comments by user)
    onProgress?.({ stage: 'reviews', current: 0 });
    for (const repo of repositories.slice(0, 10)) {
      try {
        // Get recent PRs to check for reviews
        const recentPRs = await this.fetchAllPages<BitbucketPR>(
          config,
          `/repositories/${repo.full_name}/pullrequests`,
          {
            state: 'MERGED,OPEN',
            q: `updated_on>=${dateRange.start} AND updated_on<=${dateRange.end}`,
          },
          2
        );

        for (const pr of recentPRs.slice(0, 20)) {
          try {
            const comments = await this.fetchAllPages<BitbucketComment>(
              config,
              `/repositories/${repo.full_name}/pullrequests/${pr.id}/comments`,
              {},
              2
            );

            const userComments = comments.filter(
              c => c.user?.nickname?.toLowerCase() === username.toLowerCase() &&
                   new Date(c.created_on) >= new Date(dateRange.start) &&
                   new Date(c.created_on) <= new Date(dateRange.end)
            );

            for (const comment of userComments) {
              const review: Review = {
                state: 'COMMENTED',
                body: comment.content.raw,
                url: comment.links.html.href,
                createdAt: comment.created_on,
                repo: repo.full_name,
                prNumber: pr.id,
                prTitle: pr.title,
                prUrl: pr.links.html.href,
                source: 'bitbucket',
              };
              contributions.reviews.push(review);
              onProgress?.({ stage: 'reviews', current: contributions.reviews.length });
            }
          } catch {
            // Skip if can't fetch comments
          }
        }
      } catch (error) {
        console.error(`Error fetching reviews for ${repo.full_name}:`, error);
      }
    }

    // Fetch Commits
    onProgress?.({ stage: 'commits', current: 0 });
    for (const repo of repositories.slice(0, 15)) {
      try {
        // Bitbucket doesn't support filtering commits by author in the API directly
        // We need to fetch commits and filter client-side
        const commits = await this.fetchAllPages<BitbucketCommit>(
          config,
          `/repositories/${repo.full_name}/commits`,
          {},
          3
        );

        const userCommits = commits.filter(
          c => c.author?.user?.nickname?.toLowerCase() === username.toLowerCase() &&
               new Date(c.date) >= new Date(dateRange.start) &&
               new Date(c.date) <= new Date(dateRange.end)
        );

        for (const commit of userCommits) {
          const commitData: Commit = {
            sha: commit.hash,
            message: commit.message,
            url: commit.links.html.href,
            createdAt: commit.date,
            repo: repo.full_name,
            source: 'bitbucket',
          };
          contributions.commits.push(commitData);
          onProgress?.({ stage: 'commits', current: contributions.commits.length });
        }
      } catch (error) {
        console.error(`Error fetching commits for ${repo.full_name}:`, error);
      }
    }

    return contributions;
  }
}

export const createBitbucketAdapter = (): DataSourceAdapter => new BitbucketAdapter();







