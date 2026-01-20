'use client';

import { format, parseISO } from 'date-fns';
import { FetchedData } from '@/app/types';

interface ContributionsViewProps {
  data: FetchedData;
}

export default function ContributionsView({ data }: ContributionsViewProps) {
  const { contributions, stats } = data;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span>📈</span>
        Your Contributions
      </h2>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="text-3xl font-bold text-blue-600">{stats.totalPRs}</div>
          <div className="text-sm text-gray-700 font-medium">Pull Requests</div>
          <div className="text-xs text-gray-600 mt-1">
            {stats.mergedPRs} merged
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="text-3xl font-bold text-green-600">{stats.totalIssues}</div>
          <div className="text-sm text-gray-700 font-medium">Issues</div>
          <div className="text-xs text-gray-600 mt-1">
            {stats.openIssues} open, {stats.closedIssues} closed
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="text-3xl font-bold text-purple-600">{stats.totalReviews}</div>
          <div className="text-sm text-gray-700 font-medium">PR Reviews</div>
          <div className="text-xs text-gray-600 mt-1">
            {stats.approvedReviews} approved
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
          <div className="text-3xl font-bold text-orange-600">{stats.totalCommits}</div>
          <div className="text-sm text-gray-700 font-medium">Commits</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="text-xl font-semibold text-green-600">
            +{stats.totalAdditions.toLocaleString()}
          </div>
          <div className="text-sm text-gray-700 font-medium">Lines Added</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="text-xl font-semibold text-red-600">
            -{stats.totalDeletions.toLocaleString()}
          </div>
          <div className="text-sm text-gray-700 font-medium">Lines Deleted</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="text-xl font-semibold text-gray-900">
            {stats.reposContributed}
          </div>
          <div className="text-sm text-gray-700 font-medium">Repositories</div>
        </div>
      </div>

      {/* Pull Requests */}
      {contributions.pullRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🔀</span>
            Pull Requests
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {contributions.pullRequests.map((pr, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate block"
                    >
                      #{pr.number} {pr.title}
                    </a>
                    <div className="text-sm text-gray-600 mt-1">
                      {pr.repo} • {format(parseISO(pr.createdAt), 'MMM d, yyyy')}
                    </div>
                    {pr.additions !== undefined && pr.deletions !== undefined && (
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="text-green-600">+{pr.additions}</span> / <span className="text-red-600">-{pr.deletions}</span> lines
                        {pr.changedFiles && ` • ${pr.changedFiles} files`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 ml-2 px-2 py-1 rounded text-xs font-medium ${
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
          <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🐛</span>
            Issues
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {contributions.issues.map((issue, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate block"
                    >
                      #{issue.number} {issue.title}
                    </a>
                    <div className="text-sm text-gray-600 mt-1">
                      {issue.repo} • {format(parseISO(issue.createdAt), 'MMM d, yyyy')}
                    </div>
                    {issue.comments > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        💬 {issue.comments} comments
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 ml-2 px-2 py-1 rounded text-xs font-medium ${
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
          <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>👀</span>
            PR Reviews
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {contributions.reviews.map((review, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={review.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate block"
                    >
                      Reviewed: {review.prTitle}
                    </a>
                    <div className="text-sm text-gray-600 mt-1">
                      {review.repo} • PR #{review.prNumber} •{' '}
                      {format(parseISO(review.createdAt), 'MMM d, yyyy')}
                    </div>
                    {review.body && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {review.body.substring(0, 150)}
                        {review.body.length > 150 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 ml-2 px-2 py-1 rounded text-xs font-medium ${
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
          <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📝</span>
            Commits
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {contributions.commits.slice(0, 50).map((commit, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium block truncate"
                >
                  {commit.message.split('\n')[0]}
                </a>
                <div className="text-sm text-gray-600 mt-1">
                  {commit.repo} • <code className="text-xs bg-gray-100 px-1 rounded">{commit.sha.substring(0, 7)}</code> •{' '}
                  {commit.createdAt &&
                    format(parseISO(commit.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
            {contributions.commits.length > 50 && (
              <div className="text-sm text-gray-600 text-center py-2">
                Showing first 50 of {contributions.commits.length} commits
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tickets (if any) */}
      {contributions.tickets && contributions.tickets.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🎫</span>
            Tickets
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {contributions.tickets.map((ticket, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={ticket.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      [{ticket.key}] {ticket.title}
                    </a>
                    <div className="text-sm text-gray-600 mt-1">
                      {ticket.type} • {format(parseISO(ticket.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <span className="shrink-0 ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {ticket.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
