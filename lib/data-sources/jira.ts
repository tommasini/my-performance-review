import { DataSourceConfig, ContributionData, Ticket } from '@/app/types';
import { DataSourceAdapter, DateRange, ValidationResult, ProgressCallback } from './types';

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    created: string;
    resolutiondate: string | null;
    assignee?: { accountId: string; displayName: string; emailAddress?: string };
    reporter?: { accountId: string; displayName: string; emailAddress?: string };
    project: { key: string; name: string };
    comment?: {
      comments: JiraComment[];
      total: number;
    };
  };
}

interface JiraComment {
  id: string;
  body: string | { content: Array<{ content: Array<{ text: string }> }> };
  created: string;
  author: { accountId: string; displayName: string; emailAddress?: string };
}

interface JiraWorklog {
  id: string;
  timeSpent: string;
  timeSpentSeconds: number;
  started: string;
  comment?: string | { content: Array<{ content: Array<{ text: string }> }> };
  author: { accountId: string; displayName: string };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export class JiraAdapter implements DataSourceAdapter {
  readonly name = 'jira' as const;

  validateConfig(config: DataSourceConfig): ValidationResult {
    if (!config.username) {
      return { valid: false, error: 'Jira email address is required' };
    }
    if (!config.token) {
      return { valid: false, error: 'Jira API token is required' };
    }
    if (!config.baseUrl) {
      return { valid: false, error: 'Jira instance URL is required (e.g., https://yourcompany.atlassian.net)' };
    }
    return { valid: true };
  }

  private getAuthHeader(config: DataSourceConfig): string {
    // Jira Cloud uses Basic Auth with email:api_token
    const credentials = Buffer.from(`${config.username}:${config.token}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchApi<T>(
    config: DataSourceConfig,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${config.baseUrl}/rest/api/3${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': this.getAuthHeader(config),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async searchIssues(
    config: DataSourceConfig,
    jql: string,
    fields: string[] = ['summary', 'status', 'issuetype', 'created', 'resolutiondate', 'assignee', 'reporter', 'project'],
    maxResults = 100
  ): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;

    while (true) {
      const response = await this.fetchApi<JiraSearchResponse>(
        config,
        '/search',
        {
          jql,
          fields: fields.join(','),
          startAt: startAt.toString(),
          maxResults: Math.min(maxResults - allIssues.length, 100).toString(),
        }
      );

      allIssues.push(...response.issues);

      if (allIssues.length >= response.total || allIssues.length >= maxResults) {
        break;
      }
      startAt = allIssues.length;
    }

    return allIssues;
  }

  private extractTextFromADF(content: string | { content: Array<{ content: Array<{ text: string }> }> }): string {
    // Jira uses Atlassian Document Format (ADF) for rich text
    if (typeof content === 'string') {
      return content;
    }
    
    try {
      const texts: string[] = [];
      for (const block of content.content || []) {
        for (const inline of block.content || []) {
          if (inline.text) {
            texts.push(inline.text);
          }
        }
      }
      return texts.join(' ');
    } catch {
      return '';
    }
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
    const projectFilter = organization ? ` AND project = "${organization}"` : '';

    // Get current user's account ID
    let currentUserAccountId: string | null = null;
    try {
      const myself = await this.fetchApi<JiraUser>(config, '/myself');
      currentUserAccountId = myself.accountId;
    } catch (error) {
      console.error('Error fetching Jira user info:', error);
      // Try to continue using email matching
    }

    // Format dates for JQL (Jira uses yyyy-MM-dd format)
    const startDateJQL = dateRange.start;
    const endDateJQL = dateRange.end;

    // 1. Fetch tickets ASSIGNED to user
    onProgress?.({ stage: 'tickets', current: 0 });
    try {
      const assignedJQL = currentUserAccountId
        ? `assignee = "${currentUserAccountId}" AND created >= "${startDateJQL}" AND created <= "${endDateJQL}"${projectFilter} ORDER BY created DESC`
        : `assignee = currentUser() AND created >= "${startDateJQL}" AND created <= "${endDateJQL}"${projectFilter} ORDER BY created DESC`;

      const assignedIssues = await this.searchIssues(config, assignedJQL);
      
      for (const issue of assignedIssues) {
        const ticket: Ticket = {
          key: issue.key,
          title: issue.fields.summary,
          status: issue.fields.status.name,
          url: `${config.baseUrl}/browse/${issue.key}`,
          createdAt: issue.fields.created,
          resolvedAt: issue.fields.resolutiondate || undefined,
          type: issue.fields.issuetype.name,
          source: 'jira',
        };
        contributions.tickets.push(ticket);
        onProgress?.({ stage: 'tickets', current: contributions.tickets.length });
      }
    } catch (error) {
      console.error('Error fetching assigned Jira issues:', error);
    }

    // 2. Fetch tickets CREATED/REPORTED by user
    try {
      const reportedJQL = currentUserAccountId
        ? `reporter = "${currentUserAccountId}" AND created >= "${startDateJQL}" AND created <= "${endDateJQL}"${projectFilter} ORDER BY created DESC`
        : `reporter = currentUser() AND created >= "${startDateJQL}" AND created <= "${endDateJQL}"${projectFilter} ORDER BY created DESC`;

      const reportedIssues = await this.searchIssues(config, reportedJQL);
      
      for (const issue of reportedIssues) {
        // Check if we already have this ticket (might be both assigned and reported)
        if (!contributions.tickets.some(t => t.key === issue.key)) {
          const ticket: Ticket = {
            key: issue.key,
            title: `[Reported] ${issue.fields.summary}`,
            status: issue.fields.status.name,
            url: `${config.baseUrl}/browse/${issue.key}`,
            createdAt: issue.fields.created,
            resolvedAt: issue.fields.resolutiondate || undefined,
            type: issue.fields.issuetype.name,
            source: 'jira',
          };
          contributions.tickets.push(ticket);
          onProgress?.({ stage: 'tickets', current: contributions.tickets.length });
        }
      }
    } catch (error) {
      console.error('Error fetching reported Jira issues:', error);
    }

    // 3. Fetch tickets where user has commented
    try {
      // Get recently updated issues to check for user comments
      const updatedJQL = `updated >= "${startDateJQL}" AND updated <= "${endDateJQL}"${projectFilter} ORDER BY updated DESC`;
      const updatedIssues = await this.searchIssues(
        config,
        updatedJQL,
        ['summary', 'status', 'issuetype', 'created', 'resolutiondate', 'project', 'comment'],
        200
      );

      for (const issue of updatedIssues) {
        // Check if user has commented on this issue
        if (issue.fields.comment?.comments) {
          const userComments = issue.fields.comment.comments.filter(comment => {
            const commentDate = new Date(comment.created);
            const inRange = commentDate >= new Date(dateRange.start) && commentDate <= new Date(dateRange.end);
            
            if (currentUserAccountId) {
              return comment.author.accountId === currentUserAccountId && inRange;
            }
            // Fallback to email matching
            return comment.author.emailAddress?.toLowerCase() === username.toLowerCase() && inRange;
          });

          if (userComments.length > 0 && !contributions.tickets.some(t => t.key === issue.key)) {
            const ticket: Ticket = {
              key: issue.key,
              title: `[Commented] ${issue.fields.summary}`,
              status: issue.fields.status.name,
              url: `${config.baseUrl}/browse/${issue.key}`,
              createdAt: issue.fields.created,
              resolvedAt: issue.fields.resolutiondate || undefined,
              type: `${issue.fields.issuetype.name} (${userComments.length} comments)`,
              source: 'jira',
            };
            contributions.tickets.push(ticket);
            onProgress?.({ stage: 'tickets', current: contributions.tickets.length });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Jira comments:', error);
    }

    // 4. Fetch worklogs (time tracking)
    try {
      // Get issues with worklogs by the user
      const worklogJQL = `worklogAuthor = currentUser() AND worklogDate >= "${startDateJQL}" AND worklogDate <= "${endDateJQL}"${projectFilter}`;
      const worklogIssues = await this.searchIssues(config, worklogJQL, ['summary', 'status', 'issuetype', 'created', 'resolutiondate', 'project'], 100);

      for (const issue of worklogIssues) {
        // Fetch worklogs for this issue
        try {
          const worklogs = await this.fetchApi<{ worklogs: JiraWorklog[] }>(
            config,
            `/issue/${issue.key}/worklog`
          );

          const userWorklogs = worklogs.worklogs.filter(wl => {
            const worklogDate = new Date(wl.started);
            const inRange = worklogDate >= new Date(dateRange.start) && worklogDate <= new Date(dateRange.end);
            
            if (currentUserAccountId) {
              return wl.author.accountId === currentUserAccountId && inRange;
            }
            return inRange;
          });

          if (userWorklogs.length > 0 && !contributions.tickets.some(t => t.key === issue.key)) {
            const totalTimeSpent = userWorklogs.reduce((sum, wl) => sum + wl.timeSpentSeconds, 0);
            const hours = Math.round(totalTimeSpent / 3600 * 10) / 10;

            const ticket: Ticket = {
              key: issue.key,
              title: `[Worked ${hours}h] ${issue.fields.summary}`,
              status: issue.fields.status.name,
              url: `${config.baseUrl}/browse/${issue.key}`,
              createdAt: issue.fields.created,
              resolvedAt: issue.fields.resolutiondate || undefined,
              type: issue.fields.issuetype.name,
              source: 'jira',
            };
            contributions.tickets.push(ticket);
            onProgress?.({ stage: 'tickets', current: contributions.tickets.length });
          }
        } catch {
          // Skip if can't fetch worklogs
        }
      }
    } catch (error) {
      console.error('Error fetching Jira worklogs:', error);
    }

    return contributions;
  }
}

export const createJiraAdapter = (): DataSourceAdapter => new JiraAdapter();







