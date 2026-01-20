'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';

type PullRequest = {
  title: string;
  number: number;
  state: string;
  url: string;
  createdAt: string;
  mergedAt: string | null;
  repo: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
};

type Issue = {
  title: string;
  number: number;
  state: string;
  url: string;
  createdAt: string;
  repo: string;
  comments: number;
};

type Review = {
  state: string;
  body: string | null;
  url: string;
  createdAt: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
};

type Commit = {
  sha: string;
  message: string;
  url: string;
  createdAt: string | undefined;
  repo: string;
};

type GitHubData = {
  contributions: {
    pullRequests: PullRequest[];
    issues: Issue[];
    reviews: Review[];
    commits: Commit[];
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

export default function ReviewForm({ data, claudeApiKey }: { data: GitHubData; claudeApiKey?: string }) {
  const { contributions, stats } = data;

  const [answers, setAnswers] = useState({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
  });

  const [aiSuggestions, setAiSuggestions] = useState({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
  });

  const [loadingAI, setLoadingAI] = useState({
    q1: false,
    q2: false,
    q3: false,
    q4: false,
    q5: false,
  });

  // Extract topics/areas from PR and issue titles
  const extractTopics = () => {
    const topicKeywords: { [key: string]: string[] } = {
      'Performance': ['performance', 'optimization', 'speed', 'latency', 'memory', 'cache'],
      'Security': ['security', 'vulnerability', 'auth', 'authentication', 'authorization', 'encryption', 'secure'],
      'Testing': ['test', 'testing', 'spec', 'coverage', 'jest', 'cypress', 'e2e'],
      'Documentation': ['docs', 'documentation', 'readme', 'guide', 'tutorial'],
      'UI/UX': ['ui', 'ux', 'design', 'component', 'button', 'modal', 'dialog', 'interface', 'user experience'],
      'API': ['api', 'endpoint', 'route', 'rest', 'graphql', 'backend'],
      'Bug Fixes': ['fix', 'bug', 'issue', 'error', 'crash', 'broken'],
      'Refactoring': ['refactor', 'cleanup', 'improve', 'restructure', 'reorganize'],
      'Feature': ['feature', 'add', 'implement', 'new', 'support'],
      'Accessibility': ['a11y', 'accessibility', 'aria', 'screen reader', 'keyboard'],
      'DevOps': ['ci', 'cd', 'deploy', 'pipeline', 'docker', 'kubernetes', 'infrastructure'],
      'Mobile': ['mobile', 'ios', 'android', 'react native'],
    };

    const topicCounts = new Map<string, number>();
    const topicPRs = new Map<string, string[]>();

    // Analyze merged PRs
    contributions.pullRequests
      .filter(pr => pr.state === 'merged' || pr.mergedAt)
      .forEach(pr => {
        const titleLower = pr.title.toLowerCase();
        let matched = false;

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
          if (keywords.some(keyword => titleLower.includes(keyword))) {
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            if (!topicPRs.has(topic)) {
              topicPRs.set(topic, []);
            }
            topicPRs.get(topic)!.push(pr.title);
            matched = true;
            break; // Only match to first topic
          }
        }

        // If no specific topic matched, check for common patterns
        if (!matched) {
          if (titleLower.includes('update') || titleLower.includes('upgrade')) {
            topicCounts.set('Maintenance', (topicCounts.get('Maintenance') || 0) + 1);
            if (!topicPRs.has('Maintenance')) {
              topicPRs.set('Maintenance', []);
            }
            topicPRs.get('Maintenance')!.push(pr.title);
          }
        }
      });

    // Get top topics
    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        count,
        examples: topicPRs.get(topic)?.slice(0, 3) || [],
      }));

    return topTopics;
  };

  // Generate insights and full suggestions based on contributions
  const generateInsights = () => {
    const insights = {
      q1: [] as string[],
      q2: [] as string[],
      q3: [] as string[],
    };
    const suggestions = {
      q1: '',
      q3: '',
    };

    const topics = extractTopics();

    // Q1 Insights - Progress and Impact
    if (stats.mergedPRs > 0) {
      insights.q1.push(
        `Merged ${stats.mergedPRs} pull request${stats.mergedPRs > 1 ? 's' : ''} across ${stats.reposContributed} repository${stats.reposContributed > 1 ? 'ies' : ''}`
      );
    }
    if (stats.totalAdditions > 0 || stats.totalDeletions > 0) {
      insights.q1.push(
        `Contributed ${stats.totalAdditions.toLocaleString()} lines added and ${stats.totalDeletions.toLocaleString()} lines deleted`
      );
    }
    if (stats.totalReviews > 0) {
      insights.q1.push(
        `Reviewed ${stats.totalReviews} pull request${stats.totalReviews > 1 ? 's' : ''}, approving ${stats.approvedReviews}`
      );
    }
    if (stats.totalIssues > 0) {
      insights.q1.push(
        `Opened ${stats.totalIssues} issue${stats.totalIssues > 1 ? 's' : ''}, demonstrating proactive problem identification`
      );
    }

    // Top repositories by contribution
    const repoStats = new Map<string, { prs: number; issues: number; reviews: number }>();
    contributions.pullRequests.forEach((pr) => {
      const current = repoStats.get(pr.repo) || { prs: 0, issues: 0, reviews: 0 };
      repoStats.set(pr.repo, { ...current, prs: current.prs + 1 });
    });
    contributions.issues.forEach((issue) => {
      const current = repoStats.get(issue.repo) || { prs: 0, issues: 0, reviews: 0 };
      repoStats.set(issue.repo, { ...current, issues: current.issues + 1 });
    });
    contributions.reviews.forEach((review) => {
      const current = repoStats.get(review.repo) || { prs: 0, issues: 0, reviews: 0 };
      repoStats.set(review.repo, { ...current, reviews: current.reviews + 1 });
    });

    const topRepos = Array.from(repoStats.entries())
      .sort((a, b) => {
        const totalA = a[1].prs + a[1].issues + a[1].reviews;
        const totalB = b[1].prs + b[1].issues + b[1].reviews;
        return totalB - totalA;
      })
      .slice(0, 3);

    if (topRepos.length > 0) {
      insights.q1.push(
        `Most active contributions in: ${topRepos.map(([repo]) => repo).join(', ')}`
      );
    }

    // Generate full written suggestion for Q1 with topics and impact
    if (insights.q1.length > 0) {
      const prText = stats.mergedPRs > 0 
        ? `I successfully merged ${stats.mergedPRs} pull request${stats.mergedPRs > 1 ? 's' : ''} across ${stats.reposContributed} repository${stats.reposContributed > 1 ? 'ies' : ''}, contributing ${stats.totalAdditions.toLocaleString()} lines of code added and ${stats.totalDeletions.toLocaleString()} lines removed.`
        : '';
      
      // Add topics and their impact
      let topicsText = '';
      if (topics.length > 0) {
        const topicDescriptions = topics.map(({ topic, count }) => {
          const impactMap: { [key: string]: string } = {
            'Performance': 'improved application performance and user experience',
            'Security': 'enhanced security posture and protected user data',
            'Testing': 'increased test coverage and code reliability',
            'Documentation': 'improved developer onboarding and knowledge sharing',
            'UI/UX': 'enhanced user interface and overall product experience',
            'API': 'expanded API capabilities and backend functionality',
            'Bug Fixes': 'resolved critical issues and improved product stability',
            'Refactoring': 'improved code maintainability and developer productivity',
            'Feature': 'delivered new features that expanded product capabilities',
            'Accessibility': 'made the product more accessible to all users',
            'DevOps': 'streamlined deployment processes and infrastructure reliability',
            'Mobile': 'enhanced mobile experience and platform support',
            'Maintenance': 'maintained codebase health and technical debt reduction',
          };

          const impact = impactMap[topic] || 'contributed to product improvements';
          return `${topic.toLowerCase()} (${count} contribution${count > 1 ? 's' : ''}), which ${impact}`;
        });

        topicsText = ` My contributions spanned several key areas: ${topicDescriptions.join('; ')}.`;
      }
      
      const reviewText = stats.totalReviews > 0
        ? ` Additionally, I reviewed ${stats.totalReviews} pull request${stats.totalReviews > 1 ? 's' : ''}, approving ${stats.approvedReviews}, which helped maintain code quality and supported my team members' work.`
        : '';
      
      const issueText = stats.totalIssues > 0
        ? ` I also opened ${stats.totalIssues} issue${stats.totalIssues > 1 ? 's' : ''}, demonstrating proactive problem identification and ownership.`
        : '';
      
      const repoText = topRepos.length > 0
        ? ` My most significant contributions were in the following repositories: ${topRepos.map(([repo]) => repo).join(', ')}.`
        : '';
      
      const impactText = ` These contributions have directly impacted our organization by improving product quality, enhancing user experience, and enabling the team to deliver value more efficiently.`;
      
      suggestions.q1 = `${prText}${topicsText}${reviewText}${issueText}${repoText}${impactText}`;
      
      // Add topics to key points
      if (topics.length > 0) {
        topics.forEach(({ topic, count }) => {
          insights.q1.push(
            `Contributed to ${topic.toLowerCase()}: ${count} merged PR${count > 1 ? 's' : ''}`
          );
        });
      }
    }

    // Q3 Insights - Values demonstrated
    if (stats.totalReviews > stats.totalPRs * 0.5) {
      insights.q3.push(
        'Demonstrated collaboration by reviewing more PRs than you opened, supporting team members'
      );
    }
    if (stats.mergedPRs / stats.totalPRs > 0.8) {
      insights.q3.push(
        'High merge rate indicates quality work and alignment with team standards'
      );
    }
    if (stats.totalIssues > 0) {
      insights.q3.push(
        'Proactive in identifying and reporting issues, showing ownership and initiative'
      );
    }
    if (stats.reposContributed > 5) {
      insights.q3.push(
        `Contributed across ${stats.reposContributed} repositories, showing versatility and broad impact`
      );
    }

    // Generate full written suggestion for Q3 - using company values
    // Company values: Kindness, Community, Evolution, Innovation, Impact
    if (insights.q3.length > 0) {
      let valueText = '';
      let exampleText = '';
      
      // Determine which value is most demonstrated
      if (stats.totalReviews > stats.totalPRs * 0.5 && stats.totalReviews > 5) {
        valueText = 'Community';
        exampleText = `I demonstrated Community by reviewing ${stats.totalReviews} pull request${stats.totalReviews > 1 ? 's' : ''}, which is more than the number of PRs I opened. This shows my commitment to cultivating interconnectedness and unlocking potential through collective effort - supporting team members and ensuring code quality across the organization.`;
      } else if (stats.mergedPRs / stats.totalPRs > 0.8 && stats.totalPRs > 0) {
        valueText = 'Impact';
        exampleText = `I demonstrated Impact through a high merge rate of ${Math.round((stats.mergedPRs / stats.totalPRs) * 100)}% and ${stats.mergedPRs} merged pull request${stats.mergedPRs > 1 ? 's' : ''}, delivering exceptional products and supporting the mission through persistent effort. My contributions directly improved our codebase and product quality.`;
      } else if (stats.reposContributed > 5) {
        valueText = 'Evolution';
        exampleText = `I demonstrated Evolution by contributing across ${stats.reposContributed} different repositories, showing my commitment to continuous growth and adapting to an ever-changing landscape. This versatility allowed me to work across multiple codebases and contexts.`;
      } else if (stats.totalIssues > 0) {
        valueText = 'Kindness';
        exampleText = `I demonstrated Kindness by proactively identifying and opening ${stats.totalIssues} issue${stats.totalIssues > 1 ? 's' : ''}, acting with intention and strength to improve our codebase and processes for the benefit of the entire team and ecosystem.`;
      } else if (stats.totalPRs > 0) {
        valueText = 'Impact';
        exampleText = `I demonstrated Impact through my contributions, including ${stats.mergedPRs} merged pull request${stats.mergedPRs > 1 ? 's' : ''} that directly improved our codebase and delivered value to the organization.`;
      }
      
      if (valueText && exampleText) {
        suggestions.q3 = `The value I've demonstrated most clearly is ${valueText}. ${exampleText}`;
      }
    }

    return { insights, suggestions };
  };

  const { insights, suggestions } = generateInsights();

  const handleAnswerChange = (question: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [question]: value }));
  };

  const generateAIAnswer = async (question: 'q1' | 'q2' | 'q3' | 'q4' | 'q5') => {
    if (!claudeApiKey) {
      alert('Please provide a Claude API key to use AI-generated answers');
      return;
    }

    setLoadingAI((prev) => ({ ...prev, [question]: true }));

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contributions,
          stats,
          question,
          claudeApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate AI answer');
      }

      setAiSuggestions((prev) => ({ ...prev, [question]: data.answer }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error generating AI answer: ${errorMessage}`);
      console.error(error);
    } finally {
      setLoadingAI((prev) => ({ ...prev, [question]: false }));
    }
  };

  const exportAnswers = () => {
    const content = `
PERFORMANCE REVIEW ANSWERS

1. What progress have you made on your goals and objectives over the last 6-months? Describe the impact on the success of your team, department, and organization. If applicable, also identify any blockers or challenges you faced.

${answers.q1 || '[Your answer here]'}

2. How are you utilizing AI in your day-to-day work?

Please provide two specific examples of how you have used AI to improve the quality, efficiency, or innovation of your work. Make sure to identify what did and did not work, as well as share any blockers or challenges you faced in using AI tools.

${answers.q2 || '[Your answer here]'}

3. What's one value that you feel like you've demonstrated over the last 6-months?

If you would like, provide 1-2 examples below. You can learn more about our core values here.

${answers.q3 || '[Your answer here]'}

4. What are 2-3 skills, knowledge, or behaviors you would like to develop over the next 6-months?

Describe how these will impact goals and performance for you, your team, or the organization.

${answers.q4 || '[Your answer here]'}

5. If you would like, provide any additional information that wasn't captured in the above form.

Remember to include specific behaviors and situations and describe their impact.

${answers.q5 || '[Your answer here]'}

---
Generated using Performance Review Helper
Date Range: ${format(parseISO(data.dateRange.start), 'MMM d, yyyy')} - ${format(parseISO(data.dateRange.end), 'MMM d, yyyy')}
Organization: ${data.organization}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-review-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Performance Review Questions</h2>
        <button
          onClick={exportAnswers}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Export Answers
        </button>
      </div>

      {/* Question 1 */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          1. What progress have you made on your goals and objectives over the last
          6-months? Describe the impact on the success of your team, department, and
          organization. If applicable, also identify any blockers or challenges you
          faced.
        </label>
        {insights.q1.length > 0 && (
          <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-semibold text-blue-900">
                💡 Suggested Answer:
              </div>
              {claudeApiKey && (
                <button
                  onClick={() => generateAIAnswer('q1')}
                  disabled={loadingAI.q1}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {loadingAI.q1 ? 'Generating...' : '✨ Generate with AI'}
                </button>
              )}
            </div>
            {aiSuggestions.q1 ? (
              <div>
                <p className="text-sm text-gray-900 mb-2 leading-relaxed font-medium">
                  AI-Generated Answer:
                </p>
                <p className="text-sm text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
                  {aiSuggestions.q1}
                </p>
                <button
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, q1: aiSuggestions.q1 }));
                  }}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mb-3"
                >
                  Use this answer
                </button>
                <div className="border-t border-blue-200 pt-3 mt-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">
                    Original Template Answer:
                  </p>
                </div>
              </div>
            ) : null}
            <p className="text-sm text-gray-900 mb-3 leading-relaxed">
              {suggestions.q1}
            </p>
            <div className="text-xs font-semibold text-blue-900 mb-1 mt-3 pt-3 border-t border-blue-200">
              Key Points to Include:
            </div>
            <ul className="text-xs text-gray-800 list-disc list-inside space-y-1">
              {insights.q1.map((insight, idx) => (
                <li key={idx}>{insight}</li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          value={answers.q1}
          onChange={(e) => handleAnswerChange('q1', e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe your progress, impact, and any challenges..."
        />
      </div>

      {/* Question 2 */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          2. How are you utilizing AI in your day-to-day work?
        </label>
        <p className="text-sm text-gray-900 mb-3">
          Please provide two specific examples of how you have used AI to improve the
          quality, efficiency, or innovation of your work. Make sure to identify what
          did and did not work, as well as share any blockers or challenges you faced
          in using AI tools.
        </p>
        {claudeApiKey && (
          <div className="mb-3">
            <button
              onClick={() => generateAIAnswer('q2')}
              disabled={loadingAI.q2}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loadingAI.q2 ? 'Generating...' : '✨ Generate with AI'}
            </button>
          </div>
        )}
        {aiSuggestions.q2 && (
          <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-gray-900 mb-2 leading-relaxed font-medium">
              AI-Generated Answer:
            </p>
            <p className="text-sm text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
              {aiSuggestions.q2}
            </p>
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, q2: aiSuggestions.q2 }));
              }}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Use this answer
            </button>
          </div>
        )}
        <textarea
          value={answers.q2}
          onChange={(e) => handleAnswerChange('q2', e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe your AI usage with specific examples..."
        />
      </div>

      {/* Question 3 */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          3. What&apos;s one value that you feel like you&apos;ve demonstrated over the last
          6-months?
        </label>
        <p className="text-sm text-gray-900 mb-3">
          If you would like, provide 1-2 examples below. You can learn more about our
          core values here.
        </p>
        {insights.q3.length > 0 && (
          <div className="mb-3 p-4 bg-purple-50 border border-purple-200 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-semibold text-purple-900">
                💡 Suggested Answer:
              </div>
              {claudeApiKey && (
                <button
                  onClick={() => generateAIAnswer('q3')}
                  disabled={loadingAI.q3}
                  className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed"
                >
                  {loadingAI.q3 ? 'Generating...' : '✨ Generate with AI'}
                </button>
              )}
            </div>
            {aiSuggestions.q3 ? (
              <div>
                <p className="text-sm text-gray-900 mb-2 leading-relaxed font-medium">
                  AI-Generated Answer:
                </p>
                <p className="text-sm text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
                  {aiSuggestions.q3}
                </p>
                <button
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, q3: aiSuggestions.q3 }));
                  }}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mb-3"
                >
                  Use this answer
                </button>
                <div className="border-t border-purple-200 pt-3 mt-3">
                  <p className="text-xs font-semibold text-purple-900 mb-1">
                    Original Template Answer:
                  </p>
                </div>
              </div>
            ) : null}
            <p className="text-sm text-gray-900 mb-3 leading-relaxed">
              {suggestions.q3}
            </p>
            <div className="text-xs font-semibold text-purple-900 mb-1 mt-3 pt-3 border-t border-purple-200">
              Key Points to Include:
            </div>
            <ul className="text-xs text-gray-800 list-disc list-inside space-y-1">
              {insights.q3.map((insight, idx) => (
                <li key={idx}>{insight}</li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          value={answers.q3}
          onChange={(e) => handleAnswerChange('q3', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the value you demonstrated with examples..."
        />
      </div>

      {/* Question 4 */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          4. What are 2-3 skills, knowledge, or behaviors you would like to develop
          over the next 6-months?
        </label>
        <p className="text-sm text-gray-900 mb-3">
          Describe how these will impact goals and performance for you, your team, or
          the organization.
        </p>
        {claudeApiKey && (
          <div className="mb-3">
            <button
              onClick={() => generateAIAnswer('q4')}
              disabled={loadingAI.q4}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loadingAI.q4 ? 'Generating...' : '✨ Generate with AI'}
            </button>
          </div>
        )}
        {aiSuggestions.q4 && (
          <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-gray-900 mb-2 leading-relaxed font-medium">
              AI-Generated Answer:
            </p>
            <p className="text-sm text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
              {aiSuggestions.q4}
            </p>
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, q4: aiSuggestions.q4 }));
              }}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Use this answer
            </button>
          </div>
        )}
        <textarea
          value={answers.q4}
          onChange={(e) => handleAnswerChange('q4', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="List skills you want to develop and their impact..."
        />
      </div>

      {/* Question 5 */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-900 mb-2">
          5. If you would like, provide any additional information that wasn&apos;t
          captured in the above form.
        </label>
        <p className="text-sm text-gray-900 mb-3">
          Remember to include specific behaviors and situations and describe their
          impact.
        </p>
        {claudeApiKey && (
          <div className="mb-3">
            <button
              onClick={() => generateAIAnswer('q5')}
              disabled={loadingAI.q5}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loadingAI.q5 ? 'Generating...' : '✨ Generate with AI'}
            </button>
          </div>
        )}
        {aiSuggestions.q5 && (
          <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-gray-900 mb-2 leading-relaxed font-medium">
              AI-Generated Answer:
            </p>
            <p className="text-sm text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
              {aiSuggestions.q5}
            </p>
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, q5: aiSuggestions.q5 }));
              }}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Use this answer
            </button>
          </div>
        )}
        <textarea
          value={answers.q5}
          onChange={(e) => handleAnswerChange('q5', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Any additional information..."
        />
      </div>

      {/* Quick Stats Reference */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md">
            <h3 className="font-semibold text-gray-900 mb-2">Quick Reference - Your Contributions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div>
            <span className="font-medium">PRs:</span> {stats.totalPRs} ({stats.mergedPRs}{' '}
            merged)
          </div>
          <div>
            <span className="font-medium">Issues:</span> {stats.totalIssues}
          </div>
          <div>
            <span className="font-medium">Reviews:</span> {stats.totalReviews}
          </div>
          <div>
            <span className="font-medium">Commits:</span> {stats.totalCommits}
          </div>
          <div>
            <span className="font-medium">Repos:</span> {stats.reposContributed}
          </div>
          <div>
            <span className="font-medium">Lines:</span> +{stats.totalAdditions.toLocaleString()}{' '}
            / -{stats.totalDeletions.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
