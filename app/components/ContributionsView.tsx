'use client';

import { format, parseISO } from 'date-fns';

type GitHubData = {
  contributions: {
    pullRequests: any[];
    issues: any[];
    reviews: any[];
    commits: any[];
  };
  stats: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    closedPRs: number;
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    totalReviews: number;
    approvedReviews: number;
    totalCommits: number;
    totalAdditions: number;
    totalDeletions: number;
    reposContributed: number;
  };
  dateRange: { start: string; end: string };
  organization: string;
};

export default function ContributionsView({ data }: { data: GitHubData }) {
  const { contributions, stats } = data;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Contributions</h2>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalPRs}</div>
          <div className="text-sm text-gray-900 font-medium">Pull Requests</div>
          <div className="text-xs text-gray-700 mt-1">
            {stats.mergedPRs} merged
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.totalIssues}</div>
          <div className="text-sm text-gray-900 font-medium">Issues</div>
          <div className="text-xs text-gray-700 mt-1">
            {stats.openIssues} open, {stats.closedIssues} closed
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{stats.totalReviews}</div>
          <div className="text-sm text-gray-900 font-medium">PR Reviews</div>
          <div className="text-xs text-gray-700 mt-1">
            {stats.approvedReviews} approved
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{stats.totalCommits}</div>
          <div className="text-sm text-gray-900 font-medium">Commits</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">
            {stats.totalAdditions.toLocaleString()}
          </div>
          <div className="text-sm text-gray-900 font-medium">Lines Added</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">
            {stats.totalDeletions.toLocaleString()}
          </div>
          <div className="text-sm text-gray-900 font-medium">Lines Deleted</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">
            {stats.reposContributed}
          </div>
          <div className="text-sm text-gray-900 font-medium">Repositories</div>
        </div>
      </div>

      {/* Pull Requests */}
      {contributions.pullRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Pull Requests</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contributions.pullRequests.map((pr, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-md p-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      #{pr.number} {pr.title}
                    </a>
                    <div className="text-sm text-gray-700 mt-1">
                      {pr.repo} • {format(parseISO(pr.createdAt), 'MMM d, yyyy')}
                    </div>
                    {pr.additions && pr.deletions && (
                      <div className="text-xs text-gray-600 mt-1">
                        +{pr.additions} / -{pr.deletions} lines • {pr.changedFiles} files
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      pr.state === 'merged' || pr.mergedAt
                        ? 'bg-purple-100 text-purple-700'
                        : pr.state === 'open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pr.state === 'merged' || pr.mergedAt ? 'Merged' : pr.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {contributions.issues.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Issues</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contributions.issues.map((issue, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-md p-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      #{issue.number} {issue.title}
                    </a>
                    <div className="text-sm text-gray-700 mt-1">
                      {issue.repo} • {format(parseISO(issue.createdAt), 'MMM d, yyyy')}
                    </div>
                    {issue.comments > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        {issue.comments} comments
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      issue.state === 'open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {issue.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {contributions.reviews.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">PR Reviews</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contributions.reviews.map((review, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-md p-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a
                      href={review.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Reviewed: {review.prTitle}
                    </a>
                    <div className="text-sm text-gray-700 mt-1">
                      {review.repo} • PR #{review.prNumber} •{' '}
                      {format(parseISO(review.createdAt), 'MMM d, yyyy')}
                    </div>
                    {review.body && (
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {review.body.substring(0, 150)}
                        {review.body.length > 150 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      review.state === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : review.state === 'CHANGES_REQUESTED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {review.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commits */}
      {contributions.commits.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Commits</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contributions.commits.slice(0, 50).map((commit, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-md p-3 hover:bg-gray-50"
              >
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  {commit.message.split('\n')[0]}
                </a>
                <div className="text-sm text-gray-700 mt-1">
                  {commit.repo} • {commit.sha.substring(0, 7)} •{' '}
                  {commit.createdAt &&
                    format(parseISO(commit.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
            {contributions.commits.length > 50 && (
              <div className="text-sm text-gray-700 text-center py-2">
                Showing first 50 of {contributions.commits.length} commits
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
