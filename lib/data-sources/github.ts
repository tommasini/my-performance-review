import { Octokit } from '@octokit/rest';
import { parseISO, isAfter, isBefore } from 'date-fns';
import { DataSourceConfig, ContributionData, PullRequest, Issue, Review, Commit } from '@/app/types';
import { DataSourceAdapter, DateRange, ValidationResult, ProgressCallback, FetchOptions } from './types';

export class GitHubAdapter implements DataSourceAdapter {
  readonly name = 'github' as const;

  validateConfig(config: DataSourceConfig): ValidationResult {
    if (!config.username) {
      return { valid: false, error: 'GitHub username is required' };
    }
    return { valid: true };
  }

  async fetchContributions(
    config: DataSourceConfig,
    dateRange: DateRange,
    onProgress?: ProgressCallback,
    options?: FetchOptions
  ): Promise<ContributionData> {
    const mode = options?.mode ?? 'history';

    if (mode === 'activity') {
      return this.fetchActivity(config, dateRange, onProgress);
    }
    return this.fetchHistory(config, dateRange, onProgress);
  }

  // ---------------------------------------------------------------------------
  // activity mode — standup: "what did I do in this window?"
  // Searches for PRs merged, open PRs recently pushed to, and issues touched.
  // ---------------------------------------------------------------------------

  private async fetchActivity(
    config: DataSourceConfig,
    dateRange: DateRange,
    onProgress?: ProgressCallback
  ): Promise<ContributionData> {
    const octokit = new Octokit({ auth: config.token || undefined });
    const { username, organization } = config;

    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);

    const orgFilter = organization ? `org:${organization}` : '';
    let effectiveOrgFilter = orgFilter;

    const contributions: ContributionData = {
      pullRequests: [],
      issues: [],
      reviews: [],
      commits: [],
      tickets: [],
    };

    const reposWithActivity = new Set<string>();
    const seenPRKeys = new Set<string>();

    // Helper: run one GitHub search query with 422-org-fallback and pagination
    const searchPages = async (
      buildQuery: (orgF: string) => string,
      on422ClearOrg: boolean = true
    ): Promise<Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data']['items']> => {
      const allItems: typeof items = [];
      let page = 1;
      let hasMore = true;
      let items: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data']['items'] = [];

      while (hasMore) {
        const q = buildQuery(effectiveOrgFilter).replace(/\s+/g, ' ').trim();
        let results: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data'];
        try {
          results = (await octokit.search.issuesAndPullRequests({ q, per_page: 100, page })).data;
        } catch (err: unknown) {
          const httpErr = err as { status?: number };
          if (httpErr.status === 422 && effectiveOrgFilter && on422ClearOrg) {
            console.warn(`[github/activity] 422 with org filter — retrying without org.`);
            effectiveOrgFilter = '';
            const fallbackQ = buildQuery('').replace(/\s+/g, ' ').trim();
            results = (await octokit.search.issuesAndPullRequests({ q: fallbackQ, per_page: 100, page })).data;
          } else {
            throw err;
          }
        }
        items = results.items;
        allItems.push(...items);
        hasMore = items.length === 100 && page * 100 < results.total_count;
        page++;
        if (page > 10) break;
      }
      return allItems;
    };

    // Helper: enrich and store a PR search result item
    const enrichAndStorePR = async (pr: { repository_url: string; number: number; html_url: string }) => {
      const repoMatch = pr.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
      if (!repoMatch) return;
      const owner = repoMatch[1];
      const repoName = repoMatch[2];
      const fullRepoName = `${owner}/${repoName}`;
      const dedupKey = `${fullRepoName}:${pr.number}`;
      if (seenPRKeys.has(dedupKey)) return;
      seenPRKeys.add(dedupKey);
      reposWithActivity.add(fullRepoName);

      try {
        const { data: fullPR } = await octokit.pulls.get({ owner, repo: repoName, pull_number: pr.number });
        contributions.pullRequests.push({
          title: fullPR.title,
          number: fullPR.number,
          state: fullPR.state === 'closed' && fullPR.merged_at ? 'merged' : fullPR.state,
          url: fullPR.html_url,
          createdAt: fullPR.created_at,
          mergedAt: fullPR.merged_at,
          repo: organization ? repoName : fullRepoName,
          additions: fullPR.additions,
          deletions: fullPR.deletions,
          changedFiles: fullPR.changed_files,
          source: 'github',
        });
        onProgress?.({ stage: 'pullRequests', current: contributions.pullRequests.length });
      } catch (error) {
        console.error(`[github/activity] Error fetching PR details for ${fullRepoName}#${pr.number}:`, error);
      }
    };

    // ── 1. PRs merged in the date range (completed work — most important) ──
    onProgress?.({ stage: 'pullRequests', current: 0 });
    try {
      const merged = await searchPages(
        (org) => `type:pr author:${username} ${org} merged:${dateRange.start}..${dateRange.end}`
      );
      for (const pr of merged) await enrichAndStorePR(pr);
    } catch (error) {
      console.error('[github/activity] Error searching merged PRs:', error);
    }

    // ── 2. Open PRs with recent activity (in-progress work) ──
    try {
      const openUpdated = await searchPages(
        (org) => `type:pr author:${username} ${org} is:open updated:${dateRange.start}..${dateRange.end}`
      );
      for (const pr of openUpdated) await enrichAndStorePR(pr);
    } catch (error) {
      console.error('[github/activity] Error searching open updated PRs:', error);
    }

    // ── 3. Issues touched in the date range ──
    onProgress?.({ stage: 'issues', current: 0 });
    try {
      const seenIssueKeys = new Set<string>();
      const issueItems = await searchPages(
        (org) => `type:issue author:${username} ${org} updated:${dateRange.start}..${dateRange.end}`
      );
      for (const issue of issueItems) {
        const repoMatch = issue.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
        if (!repoMatch) continue;
        const owner = repoMatch[1];
        const repoName = repoMatch[2];
        const fullRepoName = `${owner}/${repoName}`;
        const dedupKey = `${fullRepoName}:${issue.number}`;
        if (seenIssueKeys.has(dedupKey)) continue;
        seenIssueKeys.add(dedupKey);
        reposWithActivity.add(fullRepoName);
        contributions.issues.push({
          title: issue.title,
          number: issue.number,
          state: issue.state,
          url: issue.html_url,
          createdAt: issue.created_at,
          repo: organization ? repoName : fullRepoName,
          comments: issue.comments,
          source: 'github',
        });
        onProgress?.({ stage: 'issues', current: contributions.issues.length });
      }
    } catch (error) {
      console.error('[github/activity] Error searching issues:', error);
    }

    // ── 4. PR reviews submitted in the date range ──
    onProgress?.({ stage: 'reviews', current: 0 });
    try {
      const reviewedItems = await searchPages(
        (org) => `type:pr reviewed-by:${username} ${org} updated:${dateRange.start}..${dateRange.end}`
      );
      const reviewedPRs = new Map<string, { owner: string; repo: string; fullRepo: string; number: number; title: string; url: string }>();
      for (const prItem of reviewedItems) {
        const repoMatch = prItem.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
        if (!repoMatch) continue;
        const owner = repoMatch[1];
        const repoName = repoMatch[2];
        const fullRepoName = `${owner}/${repoName}`;
        const key = `${fullRepoName}:${prItem.number}`;
        if (!reviewedPRs.has(key)) {
          reviewedPRs.set(key, { owner, repo: repoName, fullRepo: fullRepoName, number: prItem.number, title: prItem.title, url: prItem.html_url });
        }
      }
      let reviewCount = 0;
      for (const prData of Array.from(reviewedPRs.values()).slice(0, 100)) {
        try {
          const { data: reviews } = await octokit.pulls.listReviews({ owner: prData.owner, repo: prData.repo, pull_number: prData.number });
          const userReviews = reviews.filter(r => r.user?.login.toLowerCase() === username.toLowerCase());
          for (const review of userReviews) {
            const reviewDate = parseISO(review.submitted_at || '');
            if (review.submitted_at && isAfter(reviewDate, start) && isBefore(reviewDate, end)) {
              contributions.reviews.push({
                state: review.state,
                body: review.body,
                url: review.html_url,
                createdAt: review.submitted_at,
                repo: organization ? prData.repo : prData.fullRepo,
                prNumber: prData.number,
                prTitle: prData.title,
                prUrl: prData.url,
                source: 'github',
              });
              reviewCount++;
              onProgress?.({ stage: 'reviews', current: reviewCount });
            }
          }
        } catch (error) {
          console.error(`[github/activity] Error fetching reviews for ${prData.fullRepo}#${prData.number}:`, error);
        }
      }
    } catch (error) {
      console.error('[github/activity] Error searching reviewed PRs:', error);
    }

    // ── 5. Commits in repos where we found PR/issue activity ──
    onProgress?.({ stage: 'commits', current: 0 });
    for (const fullRepoName of Array.from(reposWithActivity)) {
      const [owner, repoName] = fullRepoName.split('/');
      try {
        let commitPage = 1;
        let hasMore = true;
        while (hasMore) {
          const { data: commits } = await octokit.repos.listCommits({
            owner, repo: repoName, author: username,
            since: dateRange.start, until: dateRange.end,
            per_page: 100, page: commitPage,
          });
          for (const commit of commits) {
            contributions.commits.push({
              sha: commit.sha,
              message: commit.commit.message,
              url: commit.html_url,
              createdAt: commit.commit.author?.date,
              repo: organization ? repoName : fullRepoName,
              source: 'github',
            });
          }
          onProgress?.({ stage: 'commits', current: contributions.commits.length });
          hasMore = commits.length === 100;
          commitPage++;
          if (commitPage > 5) break;
        }
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === 403) {
          console.error(`[github/activity] Access denied for ${fullRepoName}`);
        } else {
          console.error(`[github/activity] Error fetching commits for ${fullRepoName}:`, error);
        }
      }
    }

    return contributions;
  }

  // ---------------------------------------------------------------------------
  // history mode — performance review: "what did I create/contribute over this period?"
  // Searches for items created in the date range for a comprehensive audit.
  // ---------------------------------------------------------------------------

  private async fetchHistory(
    config: DataSourceConfig,
    dateRange: DateRange,
    onProgress?: ProgressCallback
  ): Promise<ContributionData> {
    const octokit = new Octokit({ auth: config.token || undefined });
    const { username, organization } = config;

    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);

    const orgFilter = organization ? `org:${organization}` : '';
    let effectiveOrgFilter = orgFilter;

    const contributions: ContributionData = {
      pullRequests: [],
      issues: [],
      reviews: [],
      commits: [],
      tickets: [],
    };

    const reposWithActivity = new Set<string>();
    const seenPRKeys = new Set<string>();

    const searchPages = async (
      buildQuery: (orgF: string) => string
    ): Promise<Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data']['items']> => {
      const allItems: typeof items = [];
      let page = 1;
      let hasMore = true;
      let items: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data']['items'] = [];

      while (hasMore) {
        const q = buildQuery(effectiveOrgFilter).replace(/\s+/g, ' ').trim();
        let results: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data'];
        try {
          results = (await octokit.search.issuesAndPullRequests({ q, per_page: 100, page })).data;
        } catch (err: unknown) {
          const httpErr = err as { status?: number };
          if (httpErr.status === 422 && effectiveOrgFilter) {
            console.warn(`[github/history] 422 with org filter — retrying without org.`);
            effectiveOrgFilter = '';
            const fallbackQ = buildQuery('').replace(/\s+/g, ' ').trim();
            results = (await octokit.search.issuesAndPullRequests({ q: fallbackQ, per_page: 100, page })).data;
          } else {
            throw err;
          }
        }
        items = results.items;
        allItems.push(...items);
        hasMore = items.length === 100 && page * 100 < results.total_count;
        page++;
        if (page > 10) break;
      }
      return allItems;
    };

    const enrichAndStorePR = async (pr: { repository_url: string; number: number; html_url: string }) => {
      const repoMatch = pr.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
      if (!repoMatch) return;
      const owner = repoMatch[1];
      const repoName = repoMatch[2];
      const fullRepoName = `${owner}/${repoName}`;
      const dedupKey = `${fullRepoName}:${pr.number}`;
      if (seenPRKeys.has(dedupKey)) return;
      seenPRKeys.add(dedupKey);
      reposWithActivity.add(fullRepoName);

      try {
        const { data: fullPR } = await octokit.pulls.get({ owner, repo: repoName, pull_number: pr.number });
        contributions.pullRequests.push({
          title: fullPR.title,
          number: fullPR.number,
          state: fullPR.state === 'closed' && fullPR.merged_at ? 'merged' : fullPR.state,
          url: fullPR.html_url,
          createdAt: fullPR.created_at,
          mergedAt: fullPR.merged_at,
          repo: organization ? repoName : fullRepoName,
          additions: fullPR.additions,
          deletions: fullPR.deletions,
          changedFiles: fullPR.changed_files,
          source: 'github',
        });
        onProgress?.({ stage: 'pullRequests', current: contributions.pullRequests.length });
      } catch (error) {
        console.error(`[github/history] Error fetching PR details for ${fullRepoName}#${pr.number}:`, error);
      }
    };

    // ── 1. PRs created in the date range (main historical signal) ──
    onProgress?.({ stage: 'pullRequests', current: 0 });
    try {
      const created = await searchPages(
        (org) => `type:pr author:${username} ${org} created:${dateRange.start}..${dateRange.end}`
      );
      for (const pr of created) await enrichAndStorePR(pr);

      // Also catch PRs opened before the period but merged within it
      const merged = await searchPages(
        (org) => `type:pr author:${username} ${org} merged:${dateRange.start}..${dateRange.end}`
      );
      for (const pr of merged) await enrichAndStorePR(pr);
    } catch (error) {
      console.error('[github/history] Error searching PRs:', error);
    }

    // ── 2. Issues created in the date range ──
    onProgress?.({ stage: 'issues', current: 0 });
    try {
      const seenIssueKeys = new Set<string>();
      const issueItems = await searchPages(
        (org) => `type:issue author:${username} ${org} created:${dateRange.start}..${dateRange.end}`
      );
      for (const issue of issueItems) {
        const repoMatch = issue.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
        if (!repoMatch) continue;
        const owner = repoMatch[1];
        const repoName = repoMatch[2];
        const fullRepoName = `${owner}/${repoName}`;
        const dedupKey = `${fullRepoName}:${issue.number}`;
        if (seenIssueKeys.has(dedupKey)) continue;
        seenIssueKeys.add(dedupKey);
        reposWithActivity.add(fullRepoName);
        contributions.issues.push({
          title: issue.title,
          number: issue.number,
          state: issue.state,
          url: issue.html_url,
          createdAt: issue.created_at,
          repo: organization ? repoName : fullRepoName,
          comments: issue.comments,
          source: 'github',
        });
        onProgress?.({ stage: 'issues', current: contributions.issues.length });
      }
    } catch (error) {
      console.error('[github/history] Error searching issues:', error);
    }

    // ── 3. PR reviews submitted in the date range ──
    onProgress?.({ stage: 'reviews', current: 0 });
    try {
      const reviewedItems = await searchPages(
        (org) => `type:pr reviewed-by:${username} ${org} updated:${dateRange.start}..${dateRange.end}`
      );
      const reviewedPRs = new Map<string, { owner: string; repo: string; fullRepo: string; number: number; title: string; url: string }>();
      for (const prItem of reviewedItems) {
        const repoMatch = prItem.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
        if (!repoMatch) continue;
        const owner = repoMatch[1];
        const repoName = repoMatch[2];
        const fullRepoName = `${owner}/${repoName}`;
        const key = `${fullRepoName}:${prItem.number}`;
        if (!reviewedPRs.has(key)) {
          reviewedPRs.set(key, { owner, repo: repoName, fullRepo: fullRepoName, number: prItem.number, title: prItem.title, url: prItem.html_url });
        }
      }
      let reviewCount = 0;
      for (const prData of Array.from(reviewedPRs.values()).slice(0, 100)) {
        try {
          const { data: reviews } = await octokit.pulls.listReviews({ owner: prData.owner, repo: prData.repo, pull_number: prData.number });
          const userReviews = reviews.filter(r => r.user?.login.toLowerCase() === username.toLowerCase());
          for (const review of userReviews) {
            const reviewDate = parseISO(review.submitted_at || '');
            if (review.submitted_at && isAfter(reviewDate, start) && isBefore(reviewDate, end)) {
              contributions.reviews.push({
                state: review.state,
                body: review.body,
                url: review.html_url,
                createdAt: review.submitted_at,
                repo: organization ? prData.repo : prData.fullRepo,
                prNumber: prData.number,
                prTitle: prData.title,
                prUrl: prData.url,
                source: 'github',
              });
              reviewCount++;
              onProgress?.({ stage: 'reviews', current: reviewCount });
            }
          }
        } catch (error) {
          console.error(`[github/history] Error fetching reviews for ${prData.fullRepo}#${prData.number}:`, error);
        }
      }
    } catch (error) {
      console.error('[github/history] Error searching reviewed PRs:', error);
    }

    // ── 4. Commits in repos where we found activity ──
    onProgress?.({ stage: 'commits', current: 0 });
    for (const fullRepoName of Array.from(reposWithActivity)) {
      const [owner, repoName] = fullRepoName.split('/');
      try {
        let commitPage = 1;
        let hasMore = true;
        while (hasMore) {
          const { data: commits } = await octokit.repos.listCommits({
            owner, repo: repoName, author: username,
            since: dateRange.start, until: dateRange.end,
            per_page: 100, page: commitPage,
          });
          for (const commit of commits) {
            contributions.commits.push({
              sha: commit.sha,
              message: commit.commit.message,
              url: commit.html_url,
              createdAt: commit.commit.author?.date,
              repo: organization ? repoName : fullRepoName,
              source: 'github',
            });
          }
          onProgress?.({ stage: 'commits', current: contributions.commits.length });
          hasMore = commits.length === 100;
          commitPage++;
          if (commitPage > 5) break;
        }
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === 403) {
          console.error(`[github/history] Access denied for ${fullRepoName}`);
        } else {
          console.error(`[github/history] Error fetching commits for ${fullRepoName}:`, error);
        }
      }
    }

    return contributions;
  }
}

export const createGitHubAdapter = (): DataSourceAdapter => new GitHubAdapter();
