import { Octokit } from '@octokit/rest';
import { parseISO, isAfter, isBefore } from 'date-fns';
import { DataSourceConfig, ContributionData, PullRequest, Issue, Review, Commit } from '@/app/types';
import { DataSourceAdapter, DateRange, ValidationResult, ProgressCallback } from './types';

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
    onProgress?: ProgressCallback
  ): Promise<ContributionData> {
    const octokit = new Octokit({
      auth: config.token || undefined,
    });

    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    const { username, organization } = config;

    const reposWithActivity = new Set<string>();
    const contributions: ContributionData = {
      pullRequests: [],
      issues: [],
      reviews: [],
      commits: [],
      tickets: [],
    };

    const orgFilter = organization ? `org:${organization}` : '';
    // May be cleared mid-fetch if the org is inaccessible (GitHub returns 422)
    let effectiveOrgFilter = orgFilter;

    // Search for Pull Requests
    onProgress?.({ stage: 'pullRequests', current: 0 });
    try {
      let prSearchPage = 1;
      let hasMorePRs = true;

      while (hasMorePRs) {
        const prQuery = `type:pr author:${username} ${effectiveOrgFilter} created:${dateRange.start}..${dateRange.end} is:pr`.replace(/\s+/g, ' ').trim();
        let prSearchResults: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data'];

        try {
          const res = await octokit.search.issuesAndPullRequests({ q: prQuery, per_page: 100, page: prSearchPage });
          prSearchResults = res.data;
        } catch (err: unknown) {
          const httpErr = err as { status?: number };
          if (httpErr.status === 422 && effectiveOrgFilter) {
            console.warn('GitHub PR search 422 with org filter — retrying without org scope.');
            effectiveOrgFilter = '';
            const fallbackQuery = `type:pr author:${username} created:${dateRange.start}..${dateRange.end} is:pr`;
            const res = await octokit.search.issuesAndPullRequests({ q: fallbackQuery, per_page: 100, page: prSearchPage });
            prSearchResults = res.data;
          } else {
            throw err;
          }
        }

        onProgress?.({ stage: 'pullRequests', current: contributions.pullRequests.length, total: prSearchResults.total_count });

        for (const pr of prSearchResults.items) {
          const repoMatch = pr.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
          if (repoMatch) {
            const owner = repoMatch[1];
            const repoName = repoMatch[2];
            const fullRepoName = `${owner}/${repoName}`;
            reposWithActivity.add(fullRepoName);

            try {
              const { data: fullPR } = await octokit.pulls.get({
                owner,
                repo: repoName,
                pull_number: pr.number,
              });

              const pullRequest: PullRequest = {
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
              };
              contributions.pullRequests.push(pullRequest);
            } catch (error) {
              console.error(`Error fetching PR details for ${fullRepoName}#${pr.number}:`, error);
            }
          }
        }

        hasMorePRs = prSearchResults.items.length === 100 && prSearchPage * 100 < prSearchResults.total_count;
        prSearchPage++;
        if (prSearchPage > 10) break;
      }
    } catch (error) {
      console.error('Error searching PRs:', error);
    }

    // Search for Issues
    onProgress?.({ stage: 'issues', current: 0 });
    try {
      let issueSearchPage = 1;
      let hasMoreIssues = true;

      while (hasMoreIssues) {
        const issueQuery = `type:issue author:${username} ${effectiveOrgFilter} created:${dateRange.start}..${dateRange.end}`.replace(/\s+/g, ' ').trim();
        let issueSearchResults: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data'];

        try {
          const res = await octokit.search.issuesAndPullRequests({ q: issueQuery, per_page: 100, page: issueSearchPage });
          issueSearchResults = res.data;
        } catch (err: unknown) {
          const httpErr = err as { status?: number };
          if (httpErr.status === 422 && effectiveOrgFilter) {
            console.warn('GitHub issue search 422 with org filter — retrying without org scope.');
            effectiveOrgFilter = '';
            const fallbackQuery = `type:issue author:${username} created:${dateRange.start}..${dateRange.end}`;
            const res = await octokit.search.issuesAndPullRequests({ q: fallbackQuery, per_page: 100, page: issueSearchPage });
            issueSearchResults = res.data;
          } else {
            throw err;
          }
        }

        onProgress?.({ stage: 'issues', current: contributions.issues.length, total: issueSearchResults.total_count });

        for (const issue of issueSearchResults.items) {
          const repoMatch = issue.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
          if (repoMatch) {
            const owner = repoMatch[1];
            const repoName = repoMatch[2];
            const fullRepoName = `${owner}/${repoName}`;
            reposWithActivity.add(fullRepoName);

            const issueData: Issue = {
              title: issue.title,
              number: issue.number,
              state: issue.state,
              url: issue.html_url,
              createdAt: issue.created_at,
              repo: organization ? repoName : fullRepoName,
              comments: issue.comments,
              source: 'github',
            };
            contributions.issues.push(issueData);
          }
        }

        hasMoreIssues = issueSearchResults.items.length === 100 && issueSearchPage * 100 < issueSearchResults.total_count;
        issueSearchPage++;
        if (issueSearchPage > 10) break;
      }
    } catch (error) {
      console.error('Error searching issues:', error);
    }

    // Fetch PR Reviews
    onProgress?.({ stage: 'reviews', current: 0 });
    try {
      let reviewSearchPage = 1;
      let hasMoreReviewPRs = true;
      const reviewedPRs = new Map<string, { owner: string; repo: string; fullRepo: string; number: number; title: string; url: string }>();

      while (hasMoreReviewPRs) {
        const reviewQuery = `type:pr reviewed-by:${username} ${effectiveOrgFilter} updated:${dateRange.start}..${dateRange.end}`.replace(/\s+/g, ' ').trim();
        let reviewSearchResults: Awaited<ReturnType<typeof octokit.search.issuesAndPullRequests>>['data'];

        try {
          const res = await octokit.search.issuesAndPullRequests({ q: reviewQuery, per_page: 100, page: reviewSearchPage });
          reviewSearchResults = res.data;
        } catch (err: unknown) {
          const httpErr = err as { status?: number };
          if (httpErr.status === 422 && effectiveOrgFilter) {
            console.warn('GitHub review search 422 with org filter — retrying without org scope.');
            effectiveOrgFilter = '';
            const fallbackQuery = `type:pr reviewed-by:${username} updated:${dateRange.start}..${dateRange.end}`;
            const res = await octokit.search.issuesAndPullRequests({ q: fallbackQuery, per_page: 100, page: reviewSearchPage });
            reviewSearchResults = res.data;
          } else {
            throw err;
          }
        }

        for (const prItem of reviewSearchResults.items) {
          const repoMatch = prItem.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/);
          if (repoMatch) {
            const owner = repoMatch[1];
            const repoName = repoMatch[2];
            const fullRepoName = `${owner}/${repoName}`;
            const key = `${fullRepoName}:${prItem.number}`;
            if (!reviewedPRs.has(key)) {
              reviewedPRs.set(key, {
                owner,
                repo: repoName,
                fullRepo: fullRepoName,
                number: prItem.number,
                title: prItem.title,
                url: prItem.html_url,
              });
            }
          }
        }

        hasMoreReviewPRs = reviewSearchResults.items.length === 100 && reviewSearchPage * 100 < reviewSearchResults.total_count;
        reviewSearchPage++;
        if (reviewSearchPage > 10) break;
      }

      let reviewCount = 0;
      for (const prData of Array.from(reviewedPRs.values()).slice(0, 100)) {
        try {
          const { data: reviews } = await octokit.pulls.listReviews({
            owner: prData.owner,
            repo: prData.repo,
            pull_number: prData.number,
          });

          const userReviews = reviews.filter(
            (review) => review.user?.login.toLowerCase() === username.toLowerCase()
          );

          for (const review of userReviews) {
            const reviewDate = parseISO(review.submitted_at || '');
            if (review.submitted_at && isAfter(reviewDate, start) && isBefore(reviewDate, end)) {
              const reviewData: Review = {
                state: review.state,
                body: review.body,
                url: review.html_url,
                createdAt: review.submitted_at,
                repo: organization ? prData.repo : prData.fullRepo,
                prNumber: prData.number,
                prTitle: prData.title,
                prUrl: prData.url,
                source: 'github',
              };
              contributions.reviews.push(reviewData);
              reviewCount++;
              onProgress?.({ stage: 'reviews', current: reviewCount });
            }
          }
        } catch (error) {
          console.error(`Error fetching reviews for ${prData.fullRepo}#${prData.number}:`, error);
        }
      }
    } catch (error) {
      console.error('Error searching for reviewed PRs:', error);
    }

    // Fetch Commits
    onProgress?.({ stage: 'commits', current: 0 });
    const reposToProcess = Array.from(reposWithActivity);
    for (const fullRepoName of reposToProcess) {
      const [owner, repoName] = fullRepoName.split('/');
      try {
        let commitPage = 1;
        let hasMoreCommits = true;

        while (hasMoreCommits) {
          const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo: repoName,
            author: username,
            since: dateRange.start,
            until: dateRange.end,
            per_page: 100,
            page: commitPage,
          });

          for (const commit of commits) {
            const commitData: Commit = {
              sha: commit.sha,
              message: commit.commit.message,
              url: commit.html_url,
              createdAt: commit.commit.author?.date,
              repo: organization ? repoName : fullRepoName,
              source: 'github',
            };
            contributions.commits.push(commitData);
          }

          onProgress?.({ stage: 'commits', current: contributions.commits.length });

          hasMoreCommits = commits.length === 100;
          commitPage++;
          if (commitPage > 5) break;
        }
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === 403) {
          console.error(`Access denied or rate limited for ${fullRepoName}`);
        } else {
          console.error(`Error fetching commits for ${fullRepoName}:`, error);
        }
      }
    }

    return contributions;
  }
}

export const createGitHubAdapter = (): DataSourceAdapter => new GitHubAdapter();
