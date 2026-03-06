import { DataSourceConfig, ContributionData, PullRequest, Issue, Review, Commit } from '@/app/types';
import { DataSourceAdapter, DateRange, ValidationResult, ProgressCallback } from './types';

interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  state: string;
  web_url: string;
  created_at: string;
  merged_at: string | null;
  source_branch: string;
  target_branch: string;
  project_id: number;
}

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  state: string;
  web_url: string;
  created_at: string;
  user_notes_count: number;
  project_id: number;
}

interface GitLabNote {
  id: number;
  body: string;
  created_at: string;
  author: { username: string };
  noteable_type: string;
  noteable_iid: number;
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  created_at: string;
  web_url: string;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
}

export class GitLabAdapter implements DataSourceAdapter {
  readonly name = 'gitlab' as const;

  validateConfig(config: DataSourceConfig): ValidationResult {
    if (!config.username) {
      return { valid: false, error: 'GitLab username is required' };
    }
    if (!config.token) {
      return { valid: false, error: 'GitLab Personal Access Token is required for API access' };
    }
    return { valid: true };
  }

  private getBaseUrl(config: DataSourceConfig): string {
    return config.baseUrl || 'https://gitlab.com';
  }

  private async fetchApi<T>(
    config: DataSourceConfig,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(config);
    const url = new URL(`${baseUrl}/api/v4${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'PRIVATE-TOKEN': config.token || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API error: ${response.status} - ${error}`);
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
    let page = 1;

    while (page <= maxPages) {
      const pageResults = await this.fetchApi<T[]>(config, endpoint, {
        ...params,
        page: page.toString(),
        per_page: '100',
      });

      results.push(...pageResults);

      if (pageResults.length < 100) break;
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
    const baseUrl = this.getBaseUrl(config);

    // Get user ID first
    let userId: number;
    try {
      const users = await this.fetchApi<Array<{ id: number; username: string }>>(
        config,
        '/users',
        { username }
      );
      if (users.length === 0) {
        throw new Error(`User ${username} not found on GitLab`);
      }
      userId = users[0].id;
    } catch (error) {
      console.error('Error fetching GitLab user:', error);
      throw error;
    }

    // Get projects (either from group or user's projects)
    let projects: GitLabProject[] = [];
    try {
      if (organization) {
        // Fetch group projects
        projects = await this.fetchAllPages<GitLabProject>(
          config,
          `/groups/${encodeURIComponent(organization)}/projects`,
          { with_shared: 'false', include_subgroups: 'true' }
        );
      } else {
        // Fetch user's projects
        projects = await this.fetchAllPages<GitLabProject>(
          config,
          `/users/${userId}/projects`
        );
      }
    } catch (error) {
      console.error('Error fetching GitLab projects:', error);
    }

    const projectMap = new Map<number, GitLabProject>();
    projects.forEach(p => projectMap.set(p.id, p));

    // Fetch Merge Requests (Pull Requests)
    onProgress?.({ stage: 'pullRequests', current: 0 });
    try {
      const scope = organization ? 'all' : 'all';
      const mrs = await this.fetchAllPages<GitLabMR>(
        config,
        '/merge_requests',
        {
          author_id: userId.toString(),
          scope,
          created_after: dateRange.start,
          created_before: dateRange.end,
          state: 'all',
        }
      );

      for (const mr of mrs) {
        const project = projectMap.get(mr.project_id);
        const repoName = project?.path_with_namespace || `project-${mr.project_id}`;

        // Get MR changes for additions/deletions
        let additions = 0;
        let deletions = 0;
        let changedFiles = 0;

        try {
          const changes = await this.fetchApi<{ changes: Array<{ diff: string }> }>(
            config,
            `/projects/${mr.project_id}/merge_requests/${mr.iid}/changes`
          );
          changedFiles = changes.changes?.length || 0;
          // Estimate additions/deletions from diff
          for (const change of changes.changes || []) {
            const lines = change.diff?.split('\n') || [];
            additions += lines.filter(l => l.startsWith('+')).length;
            deletions += lines.filter(l => l.startsWith('-')).length;
          }
        } catch {
          // Skip if can't fetch changes
        }

        const pullRequest: PullRequest = {
          title: mr.title,
          number: mr.iid,
          state: mr.state === 'merged' ? 'merged' : mr.state,
          url: mr.web_url,
          createdAt: mr.created_at,
          mergedAt: mr.merged_at,
          repo: repoName,
          additions,
          deletions,
          changedFiles,
          source: 'gitlab',
        };
        contributions.pullRequests.push(pullRequest);
        onProgress?.({ stage: 'pullRequests', current: contributions.pullRequests.length });
      }
    } catch (error) {
      console.error('Error fetching GitLab merge requests:', error);
    }

    // Fetch Issues
    onProgress?.({ stage: 'issues', current: 0 });
    try {
      const issues = await this.fetchAllPages<GitLabIssue>(
        config,
        '/issues',
        {
          author_id: userId.toString(),
          scope: 'all',
          created_after: dateRange.start,
          created_before: dateRange.end,
          state: 'all',
        }
      );

      for (const issue of issues) {
        const project = projectMap.get(issue.project_id);
        const repoName = project?.path_with_namespace || `project-${issue.project_id}`;

        const issueData: Issue = {
          title: issue.title,
          number: issue.iid,
          state: issue.state === 'closed' ? 'closed' : 'open',
          url: issue.web_url,
          createdAt: issue.created_at,
          repo: repoName,
          comments: issue.user_notes_count,
          source: 'gitlab',
        };
        contributions.issues.push(issueData);
        onProgress?.({ stage: 'issues', current: contributions.issues.length });
      }
    } catch (error) {
      console.error('Error fetching GitLab issues:', error);
    }

    // Fetch Reviews (MR notes/comments by user on others' MRs)
    onProgress?.({ stage: 'reviews', current: 0 });
    try {
      // Get MRs where user has commented (approximation - fetch recent MRs and check notes)
      const recentMRs = await this.fetchAllPages<GitLabMR>(
        config,
        '/merge_requests',
        {
          scope: 'all',
          updated_after: dateRange.start,
          updated_before: dateRange.end,
          state: 'all',
        },
        5 // Limit pages for reviews
      );

      for (const mr of recentMRs.slice(0, 50)) {
        try {
          const notes = await this.fetchApi<GitLabNote[]>(
            config,
            `/projects/${mr.project_id}/merge_requests/${mr.iid}/notes`
          );

          const userNotes = notes.filter(
            n => n.author.username.toLowerCase() === username.toLowerCase() &&
                 new Date(n.created_at) >= new Date(dateRange.start) &&
                 new Date(n.created_at) <= new Date(dateRange.end)
          );

          for (const note of userNotes) {
            const project = projectMap.get(mr.project_id);
            const repoName = project?.path_with_namespace || `project-${mr.project_id}`;

            // Determine review state based on note content
            let state = 'COMMENTED';
            const bodyLower = note.body.toLowerCase();
            if (bodyLower.includes('approved') || bodyLower.includes('lgtm')) {
              state = 'APPROVED';
            } else if (bodyLower.includes('changes requested') || bodyLower.includes('needs work')) {
              state = 'CHANGES_REQUESTED';
            }

            const review: Review = {
              state,
              body: note.body,
              url: `${mr.web_url}#note_${note.id}`,
              createdAt: note.created_at,
              repo: repoName,
              prNumber: mr.iid,
              prTitle: mr.title,
              prUrl: mr.web_url,
              source: 'gitlab',
            };
            contributions.reviews.push(review);
            onProgress?.({ stage: 'reviews', current: contributions.reviews.length });
          }
        } catch {
          // Skip if can't fetch notes
        }
      }
    } catch (error) {
      console.error('Error fetching GitLab reviews:', error);
    }

    // Fetch Commits
    onProgress?.({ stage: 'commits', current: 0 });
    for (const project of projects.slice(0, 20)) {
      try {
        const commits = await this.fetchAllPages<GitLabCommit>(
          config,
          `/projects/${project.id}/repository/commits`,
          {
            author: username,
            since: dateRange.start,
            until: dateRange.end,
          },
          3
        );

        for (const commit of commits) {
          const commitData: Commit = {
            sha: commit.id,
            message: commit.message,
            url: commit.web_url,
            createdAt: commit.created_at,
            repo: project.path_with_namespace,
            source: 'gitlab',
          };
          contributions.commits.push(commitData);
          onProgress?.({ stage: 'commits', current: contributions.commits.length });
        }
      } catch {
        // Skip if can't fetch commits for project
      }
    }

    return contributions;
  }
}

export const createGitLabAdapter = (): DataSourceAdapter => new GitLabAdapter();







