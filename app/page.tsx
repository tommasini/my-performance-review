'use client';

import { useState, useEffect } from 'react';
import { format, subMonths, startOfYear, endOfYear } from 'date-fns';
import ContributionsView from './components/ContributionsView';
import ReviewForm from './components/ReviewForm';

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

export default function Home() {
  const [organization, setOrganization] = useState('MetaMask');
  const [username, setUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  // Initialize with empty strings to avoid hydration mismatch
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GitHubData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set dates on client-side only to avoid hydration mismatch
  useEffect(() => {
    if (!startDate && !endDate) {
      const now = new Date();
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  }, [startDate, endDate]);

  const handleDateRangePreset = (preset: 'h2' | 'full') => {
    const now = new Date();
    if (preset === 'h2') {
      // Second half of year (July 1 to Dec 31)
      const year = now.getFullYear();
      setStartDate(format(new Date(year, 6, 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(year, 11, 31), 'yyyy-MM-dd'));
    } else {
      // Full year
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(now), 'yyyy-MM-dd'));
    }
  };

  const fetchData = async () => {
    if (!organization || !username) {
      setError('Please provide organization and username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Add timeout of 4 minutes (API has 5 minute max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minutes

      const response = await fetch('/api/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization,
          username,
          githubToken: githubToken || undefined,
          startDate,
          endDate,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to fetch data';
        const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
        throw new Error(errorMessage + errorDetails);
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. The organization may be too large. Try using a GitHub token or narrowing the date range.');
      } else {
        setError(err.message || 'An error occurred');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Performance Review Helper
          </h1>
          <p className="text-gray-900">
            Generate your performance review based on your GitHub contributions
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MetaMask"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Your GitHub Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your-username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                GitHub Token (Optional)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ghp_..."
              />
              <p className="text-xs text-gray-700 mt-1">
                Increases rate limits. Create at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  github.com/settings/tokens
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Claude API Key (Optional)
              </label>
              <input
                type="password"
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-gray-700 mt-1">
                For AI-generated, contextual answers. Get at{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleDateRangePreset('h2')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Second Half of Year
            </button>
            <button
              onClick={() => handleDateRangePreset('full')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Full Year
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading... (This may take 2-5 minutes for large organizations)' : 'Fetch Contributions'}
          </button>

          {loading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Fetching your contributions...</p>
                <p className="text-xs">
                  Using GitHub search to find only repositories where you have activity. 
                  This is much faster than checking all repositories!
                </p>
                <p className="text-xs mt-1">
                  💡 Tip: Using a GitHub token increases rate limits and speeds up the process.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
        </div>

        {data && (
          <>
            <ContributionsView data={data} />
            <ReviewForm data={data} claudeApiKey={claudeApiKey} />
          </>
        )}
      </div>
    </div>
  );
}
