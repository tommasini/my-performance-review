import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { parseISO, isAfter, isBefore } from 'date-fns';

// Note: Next.js API routes have a default timeout
// For Vercel deployments, consider using Edge Runtime or increasing timeout in vercel.json

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization, startDate, endDate, githubToken, username } = body;

    if (!organization || !startDate || !endDate || !username) {
      return NextResponse.json(
        { error: 'Missing required parameters: organization, startDate, endDate, and username are required' },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: githubToken || undefined,
    });

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Use GitHub Search API to find repositories where user has activity
    // This is much more efficient than checking all repos
    const reposWithActivity = new Set<string>();
    const contributions = {
      pullRequests: [] as any[],
      issues: [] as any[],
      reviews: [] as any[],
      commits: [] as any[],
    };

    console.log('Searching for repositories with user activity...');

    // Search for Pull Requests by user in the organization
    try {
      // GitHub search uses format: created:YYYY-MM-DD..YYYY-MM-DD
      const prQuery = `type:pr author:${username} org:${organization} created:${startDate}..${endDate} is:pr`;
      let prSearchPage = 1;
      let hasMorePRs = true;

      while (hasMorePRs) {
        const { data: prSearchResults } = await octokit.search.issuesAndPullRequests({
          q: prQuery,
          per_page: 100,
          page: prSearchPage,
        });

        for (const pr of prSearchResults.items) {
          // Extract repo name from URL (format: https://api.github.com/repos/org/repo)
          const repoMatch = pr.repository_url.match(/\/repos\/[^/]+\/([^/]+)$/);
          if (repoMatch) {
            const repoName = repoMatch[1];
            reposWithActivity.add(repoName);
            
            // Get full PR details
            try {
              const { data: fullPR } = await octokit.pulls.get({
                owner: organization,
                repo: repoName,
                pull_number: pr.number,
              });

              contributions.pullRequests.push({
                title: fullPR.title,
                number: fullPR.number,
                state: fullPR.state === 'closed' && fullPR.merged_at ? 'merged' : fullPR.state,
                url: fullPR.html_url,
                createdAt: fullPR.created_at,
                mergedAt: fullPR.merged_at,
                repo: repoName,
                additions: fullPR.additions,
                deletions: fullPR.deletions,
                changedFiles: fullPR.changed_files,
              });
            } catch (error) {
              // Skip if we can't access full PR details
              console.error(`Error fetching PR details for ${repoName}#${pr.number}:`, error);
            }
          }
        }

        hasMorePRs = prSearchResults.items.length === 100 && prSearchPage * 100 < prSearchResults.total_count;
        prSearchPage++;
        // Limit to prevent timeout
        if (prSearchPage > 10) break;
      }
    } catch (error: any) {
      console.error('Error searching PRs:', error);
      // Continue with other searches
    }

    // Search for Issues by user in the organization
    try {
      const issueQuery = `type:issue author:${username} org:${organization} created:${startDate}..${endDate}`;
      let issueSearchPage = 1;
      let hasMoreIssues = true;

      while (hasMoreIssues) {
        const { data: issueSearchResults } = await octokit.search.issuesAndPullRequests({
          q: issueQuery,
          per_page: 100,
          page: issueSearchPage,
        });

        for (const issue of issueSearchResults.items) {
          const repoMatch = issue.repository_url.match(/\/repos\/[^/]+\/([^/]+)$/);
          if (repoMatch) {
            const repoName = repoMatch[1];
            reposWithActivity.add(repoName);

            contributions.issues.push({
              title: issue.title,
              number: issue.number,
              state: issue.state,
              url: issue.html_url,
              createdAt: issue.created_at,
              repo: repoName,
              comments: issue.comments,
            });
          }
        }

        hasMoreIssues = issueSearchResults.items.length === 100 && issueSearchPage * 100 < issueSearchResults.total_count;
        issueSearchPage++;
        if (issueSearchPage > 10) break;
      }
    } catch (error: any) {
      console.error('Error searching issues:', error);
    }

    // Convert Set to Array for processing
    const reposToProcess = Array.from(reposWithActivity);
    console.log(`Found ${reposToProcess.length} repositories with activity: ${reposToProcess.join(', ')}`);

    if (reposToProcess.length === 0) {
      return NextResponse.json(
        { 
          error: `No contributions found for user "${username}" in organization "${organization}" for the selected date range.`,
          contributions,
          stats: {
            totalPRs: 0,
            mergedPRs: 0,
            openPRs: 0,
            closedPRs: 0,
            totalIssues: 0,
            openIssues: 0,
            closedIssues: 0,
            totalReviews: 0,
            approvedReviews: 0,
            totalCommits: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            reposContributed: 0,
          },
          dateRange: { start: startDate, end: endDate },
          organization,
        },
        { status: 200 }
      );
    }

    // Note: PRs and Issues are already fetched via search above
    // Now fetch additional data (reviews, commits) for repos with activity

    // Fetch PR Reviews - Use search API to find PRs reviewed by user
    console.log('Fetching PR reviews...');
    try {
      // Search for PRs reviewed by the user in the organization
      const reviewQuery = `type:pr reviewed-by:${username} org:${organization} updated:${startDate}..${endDate}`;
      let reviewSearchPage = 1;
      let hasMoreReviewPRs = true;
      const reviewedPRs = new Map<string, any[]>(); // Map of "repo:prNumber" -> PR data

      while (hasMoreReviewPRs) {
        const { data: reviewSearchResults } = await octokit.search.issuesAndPullRequests({
          q: reviewQuery,
          per_page: 100,
          page: reviewSearchPage,
        });

        for (const prItem of reviewSearchResults.items) {
          // Extract repo name from URL
          const repoMatch = prItem.repository_url.match(/\/repos\/[^/]+\/([^/]+)$/);
          if (repoMatch) {
            const repoName = repoMatch[1];
            const key = `${repoName}:${prItem.number}`;
            if (!reviewedPRs.has(key)) {
              reviewedPRs.set(key, {
                repo: repoName,
                number: prItem.number,
                title: prItem.title,
                url: prItem.html_url,
              });
            }
          }
        }

        hasMoreReviewPRs = reviewSearchResults.items.length === 100 && reviewSearchPage * 100 < reviewSearchResults.total_count;
        reviewSearchPage++;
        // Limit to prevent timeout
        if (reviewSearchPage > 10) break;
      }

      // Now fetch actual reviews for these PRs
      for (const prData of Array.from(reviewedPRs.values()).slice(0, 100)) {
        try {
          const { data: reviews } = await octokit.pulls.listReviews({
            owner: organization,
            repo: prData.repo,
            pull_number: prData.number,
          });

          const userReviews = reviews.filter(
            (review) =>
              review.user?.login.toLowerCase() === username.toLowerCase()
          );

          for (const review of userReviews) {
            const reviewDate = parseISO(review.submitted_at || review.created_at);
            if (isAfter(reviewDate, start) && isBefore(reviewDate, end)) {
              contributions.reviews.push({
                state: review.state,
                body: review.body,
                url: review.html_url,
                createdAt: review.submitted_at || review.created_at,
                repo: prData.repo,
                prNumber: prData.number,
                prTitle: prData.title,
                prUrl: prData.url,
              });
            }
          }
        } catch (error) {
          // Skip if we can't access reviews
          console.error(`Error fetching reviews for ${prData.repo}#${prData.number}:`, error);
        }
      }
    } catch (error: any) {
      console.error('Error searching for reviewed PRs:', error);
      // Fallback: try the old method for repos with activity
      console.log('Falling back to repo-based review search...');
      for (const repo of reposToProcess.slice(0, 20)) {
        try {
          // Search for PRs in this repo
          const reviewQuery = `type:pr org:${organization} repo:${organization}/${repo} updated:${startDate}..${endDate}`;
          const { data: prSearchResults } = await octokit.search.issuesAndPullRequests({
            q: reviewQuery,
            per_page: 30,
          });

          for (const prItem of prSearchResults.items.slice(0, 20)) {
            try {
              const { data: reviews } = await octokit.pulls.listReviews({
                owner: organization,
                repo,
                pull_number: prItem.number,
              });

              const userReviews = reviews.filter(
                (review) =>
                  review.user?.login.toLowerCase() === username.toLowerCase()
              );

              for (const review of userReviews) {
                const reviewDate = parseISO(review.submitted_at || review.created_at);
                if (isAfter(reviewDate, start) && isBefore(reviewDate, end)) {
                  contributions.reviews.push({
                    state: review.state,
                    body: review.body,
                    url: review.html_url,
                    createdAt: review.submitted_at || review.created_at,
                    repo,
                    prNumber: prItem.number,
                    prTitle: prItem.title,
                    prUrl: prItem.html_url,
                  });
                }
              }
            } catch (error) {
              // Skip if we can't access reviews
            }
          }
        } catch (error: any) {
          if (error.status !== 403) {
            console.error(`Error fetching reviews for ${repo}:`, error);
          }
        }
      }
    }

    // Fetch Commits - Only for repos with activity
    console.log('Fetching commits...');
    for (const repo of reposToProcess) {
      try {
        let commitPage = 1;
        let hasMoreCommits = true;

        while (hasMoreCommits) {
          const { data: commits } = await octokit.repos.listCommits({
            owner: organization,
            repo,
            author: username,
            since: startDate,
            until: endDate,
            per_page: 100,
            page: commitPage,
          });

          contributions.commits.push(
            ...commits.map((commit) => ({
              sha: commit.sha,
              message: commit.commit.message,
              url: commit.html_url,
              createdAt: commit.commit.author?.date,
              repo,
            }))
          );

          hasMoreCommits = commits.length === 100;
          commitPage++;
          // Limit to 5 pages per repo
          if (commitPage > 5) break;
        }
      } catch (error: any) {
        if (error.status === 403) {
          console.error(`Access denied or rate limited for ${repo}`);
        } else {
          console.error(`Error fetching commits for ${repo}:`, error);
        }
      }
    }

    // Calculate statistics
    const stats = {
      totalPRs: contributions.pullRequests.length,
      mergedPRs: contributions.pullRequests.filter((pr) => pr.state === 'merged' || pr.mergedAt).length,
      openPRs: contributions.pullRequests.filter((pr) => pr.state === 'open').length,
      closedPRs: contributions.pullRequests.filter((pr) => pr.state === 'closed' && !pr.mergedAt).length,
      totalIssues: contributions.issues.length,
      openIssues: contributions.issues.filter((i) => i.state === 'open').length,
      closedIssues: contributions.issues.filter((i) => i.state === 'closed').length,
      totalReviews: contributions.reviews.length,
      approvedReviews: contributions.reviews.filter((r) => r.state === 'APPROVED').length,
      totalCommits: contributions.commits.length,
      totalAdditions: contributions.pullRequests.reduce((sum, pr) => sum + (pr.additions || 0), 0),
      totalDeletions: contributions.pullRequests.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
      reposContributed: new Set([
        ...contributions.pullRequests.map((pr) => pr.repo),
        ...contributions.issues.map((i) => i.repo),
        ...contributions.reviews.map((r) => r.repo),
        ...contributions.commits.map((c) => c.repo),
      ]).size,
    };

    return NextResponse.json({
      contributions,
      stats,
      dateRange: { start: startDate, end: endDate },
      organization,
    });
  } catch (error: any) {
    console.error('Error fetching GitHub data:', error);
    
    // Handle specific GitHub API errors
    if (error.status === 403) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded or access denied. Please use a GitHub token to increase rate limits.',
          details: error.message 
        },
        { status: 403 }
      );
    }
    
    if (error.status === 401) {
      return NextResponse.json(
        { 
          error: 'Authentication failed. Please check your GitHub token.',
          details: error.message 
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch GitHub data',
        details: error.response?.data?.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
